import postgresDb from '../../config/db-postgres.js';
import { CatalogV2Error } from './catalog-v2.js';

export function createBranchOffersRepository(database = postgresDb) {
  const repository = {
    async getVariantFulfillmentContext(variantId, client = database) {
      const [rows] = await client.query(
        `WITH RECURSIVE category_lineage AS (
           SELECT c.id, c.parent_id, c.depth, c.default_fulfillment_lane
           FROM product_variants pv
           JOIN products p ON p.id = pv.product_id
           JOIN categories c ON c.id = p.category_id
           WHERE pv.id = $1
           UNION ALL
           SELECT parent.id, parent.parent_id, parent.depth, parent.default_fulfillment_lane
           FROM categories parent
           JOIN category_lineage child ON child.parent_id = parent.id
         )
         SELECT pv.id AS variant_id, p.id AS product_id, p.name AS product_name,
                COALESCE(
                  p.fulfillment_lane,
                  (SELECT default_fulfillment_lane
                   FROM category_lineage
                   WHERE default_fulfillment_lane IS NOT NULL
                   ORDER BY depth DESC LIMIT 1)
                ) AS fulfillment_lane
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.id = $1`,
        [Number(variantId)],
      );
      return rows[0] || null;
    },

    async hasFulfillmentCapability(storeId, lane, client = database) {
      const [rows] = await client.query(
        `SELECT 1
         FROM branch_fulfillment_capabilities bfc
         JOIN fulfillment_lane_registry flr ON flr.code = bfc.lane_code
         WHERE bfc.store_id = $1 AND bfc.lane_code = $2
           AND bfc.is_enabled = TRUE AND flr.is_active = TRUE`,
        [Number(storeId), lane],
      );
      return Boolean(rows[0]);
    },

    async assertVariantsCanBeOffered(storeId, variantIds, client = database) {
      for (const variantId of variantIds) {
        const context = await repository.getVariantFulfillmentContext(variantId, client);
        if (!context) throw new CatalogV2Error(`Biến thể SKU #${variantId} không tồn tại`, 404);
        if (!context.fulfillment_lane) {
          const err = new CatalogV2Error(`Sản phẩm "${context.product_name}" chưa được thiết lập luồng xử lý`, 409);
          err.code = 'FULFILLMENT_LANE_REQUIRED';
          throw err;
        }
        if (!await repository.hasFulfillmentCapability(storeId, context.fulfillment_lane, client)) {
          const err = new CatalogV2Error(
            `Chi nhánh #${storeId} không hỗ trợ luồng vận hành "${context.fulfillment_lane}" cho sản phẩm "${context.product_name}"`,
            409,
          );
          err.code = 'BRANCH_CAPABILITY_REQUIRED';
          throw err;
        }
      }
      return true;
    },

    async listBranchOffers(storeId, { categoryId, isAvailable, search } = {}) {
      const params = [storeId];
      let where = "WHERE p.status <> 'archived' AND pv.status <> 'archived'";

      if (categoryId) {
        params.push(Number(categoryId));
        where += ` AND p.category_id = $${params.length}`;
      }
      if (isAvailable !== undefined) {
        params.push(Boolean(isAvailable));
        where += ` AND COALESCE(bvo.is_available, FALSE) = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (p.name ILIKE $${params.length} OR pv.sku ILIKE $${params.length})`;
      }

      const [rows] = await database.query(
        `SELECT pv.id AS variant_id, pv.sku, pv.name_suffix, pv.variant_signature,
                p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
                p.price AS base_price, p.image_url, p.stock_mode, p.fulfillment_lane,
                c.id AS category_id, c.name AS category_name,
                bvo.id AS offer_id, bvo.price, bvo.compare_at_price,
                COALESCE(bvo.is_available, FALSE) AS is_available,
                bvo.version, bvo.updated_at,
                COALESCE(bvi.on_hand, 0) AS on_hand,
                COALESCE(bvi.reserved, 0) AS reserved,
                (COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0)) AS available_quantity
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $1
         LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv.id AND bvi.store_id = $1
         ${where}
         ORDER BY p.id DESC, pv.id ASC`,
        params,
      );
      return rows;
    },

    async getBranchOffer(storeId, variantId) {
      const [rows] = await database.query(
        `SELECT bvo.*, pv.sku, p.name AS product_name, p.stock_mode
         FROM branch_variant_offers bvo
         JOIN product_variants pv ON pv.id = bvo.variant_id
         JOIN products p ON p.id = pv.product_id
         WHERE bvo.store_id = $1 AND bvo.variant_id = $2`,
        [storeId, variantId],
      );
      return rows[0] || null;
    },

    async upsertBranchOffer(storeId, data) {
      return database.transaction(async (tx) => {
        const [variantRows] = await tx.query(
          `SELECT pv.id, pv.status, p.status AS product_status
           FROM product_variants pv
           JOIN products p ON p.id = pv.product_id
           WHERE pv.id = $1
           FOR UPDATE`,
          [data.variant_id],
        );
        const variant = variantRows[0];
        if (!variant) throw new CatalogV2Error('Biến thể SKU không tồn tại', 404);
        if (variant.product_status === 'archived' || variant.status === 'archived') {
          throw new CatalogV2Error('Không thể cập nhật giá cho sản phẩm đã lưu trữ', 400);
        }
        if (data.is_available) {
          await repository.assertVariantsCanBeOffered(storeId, [data.variant_id], tx);
        }

        const [rows] = await tx.query(
          `INSERT INTO branch_variant_offers (store_id, variant_id, price, compare_at_price, is_available, version)
           VALUES ($1, $2, $3, $4, $5, 1)
           ON CONFLICT (store_id, variant_id)
           DO UPDATE SET
             price = EXCLUDED.price,
             compare_at_price = EXCLUDED.compare_at_price,
             is_available = EXCLUDED.is_available,
             version = branch_variant_offers.version + 1,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [storeId, data.variant_id, data.price, data.compare_at_price, data.is_available],
        );
        return rows[0];
      });
    },

    async batchSetAvailability(storeId, variantIds, isAvailable) {
      if (!Array.isArray(variantIds) || variantIds.length === 0) return [];
      return database.transaction(async (tx) => {
        if (isAvailable) await repository.assertVariantsCanBeOffered(storeId, variantIds, tx);
        const [rows] = await tx.query(
          `UPDATE branch_variant_offers
           SET is_available = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
           WHERE store_id = $2 AND variant_id = ANY($3::bigint[])
           RETURNING *`,
          [isAvailable, storeId, variantIds],
        );
        return rows;
      });
    },
  };

  return repository;
}
