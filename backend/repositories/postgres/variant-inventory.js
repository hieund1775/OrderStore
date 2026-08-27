import postgresDb from '../../config/db-postgres.js';
import { CatalogV2Error } from './catalog-v2.js';

export function createVariantInventoryRepository(database = postgresDb) {
  return {
    async getInventoryBalance(storeId, variantId) {
      const [rows] = await database.query(
        `SELECT bvi.*, pv.sku, p.name AS product_name, p.stock_mode
         FROM branch_variant_inventory bvi
         JOIN product_variants pv ON pv.id = bvi.variant_id
         JOIN products p ON p.id = pv.product_id
         WHERE bvi.store_id = $1 AND bvi.variant_id = $2`,
        [storeId, variantId],
      );
      return rows[0] || {
        store_id: Number(storeId),
        variant_id: Number(variantId),
        on_hand: 0,
        reserved: 0,
        available_quantity: 0,
        version: 0,
      };
    },

    async recordMovement(storeId, data, { createdBy = null } = {}) {
      return await database.transaction(async (tx) => {
        // Row lock current balance or initialize if not exists
        await tx.query(
          `INSERT INTO branch_variant_inventory (store_id, variant_id, on_hand, reserved, version)
           VALUES ($1, $2, 0, 0, 1)
           ON CONFLICT (store_id, variant_id) DO NOTHING`,
          [storeId, data.variant_id],
        );

        const [currRows] = await tx.query(
          `SELECT * FROM branch_variant_inventory
           WHERE store_id = $1 AND variant_id = $2
           FOR UPDATE`,
          [storeId, data.variant_id],
        );
        const current = currRows[0];

        const beforeOnHand = current.on_hand;
        const beforeReserved = current.reserved;
        let afterOnHand = beforeOnHand;
        let afterReserved = beforeReserved;

        if (data.movement_type === 'receive') {
          if (data.quantity <= 0) throw new CatalogV2Error('Nhập kho phải có số lượng dương', 400);
          afterOnHand = beforeOnHand + data.quantity;
        } else if (data.movement_type === 'adjust') {
          afterOnHand = beforeOnHand + data.quantity;
          if (afterOnHand < 0) {
            throw new CatalogV2Error('Tồn kho thực tế không thể âm sau điều chỉnh', 400);
          }
          if (afterOnHand < beforeReserved) {
            throw new CatalogV2Error(`Tồn kho (${afterOnHand}) không thể nhỏ hơn lượng đang giữ cho đơn hàng (${beforeReserved})`, 400);
          }
        } else if (data.movement_type === 'reserve') {
          if (data.quantity <= 0) throw new CatalogV2Error('Giữ hàng (reserve) phải có số lượng dương', 400);
          const available = beforeOnHand - beforeReserved;
          if (available < data.quantity) {
            throw new CatalogV2Error(`Không đủ tồn kho khả dụng để giữ hàng (khả dụng: ${available}, yêu cầu: ${data.quantity})`, 409);
          }
          afterReserved = beforeReserved + data.quantity;
        } else if (data.movement_type === 'release') {
          if (data.quantity <= 0) throw new CatalogV2Error('Hủy giữ hàng (release) phải có số lượng dương', 400);
          afterReserved = Math.max(0, beforeReserved - data.quantity);
        } else if (data.movement_type === 'sale') {
          if (data.quantity <= 0) throw new CatalogV2Error('Xuất bán (sale) phải có số lượng dương', 400);
          afterOnHand = beforeOnHand - data.quantity;
          afterReserved = Math.max(0, beforeReserved - data.quantity);
          if (afterOnHand < 0) throw new CatalogV2Error('Tồn kho không đủ để xuất bán', 409);
        }

        // Update inventory balance
        const [updatedRows] = await tx.query(
          `UPDATE branch_variant_inventory
           SET on_hand = $1, reserved = $2, version = version + 1, updated_at = CURRENT_TIMESTAMP
           WHERE store_id = $3 AND variant_id = $4
           RETURNING *`,
          [afterOnHand, afterReserved, storeId, data.variant_id],
        );

        // Append to immutable ledger
        const [movRows] = await tx.query(
          `INSERT INTO inventory_movements (
             store_id, variant_id, movement_type, quantity, before_on_hand, after_on_hand,
             before_reserved, after_reserved, reference_type, reference_id, reason, created_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            storeId,
            data.variant_id,
            data.movement_type,
            data.quantity,
            beforeOnHand,
            afterOnHand,
            beforeReserved,
            afterReserved,
            data.reference_type || null,
            data.reference_id || null,
            data.reason || null,
            createdBy,
          ],
        );

        return {
          inventory: updatedRows[0],
          movement: movRows[0],
        };
      });
    },

    async listMovements(storeId, { variantId, limit = 50, offset = 0 } = {}) {
      const params = [storeId];
      let where = 'WHERE im.store_id = $1';

      if (variantId) {
        params.push(Number(variantId));
        where += ` AND im.variant_id = $${params.length}`;
      }

      params.push(limit);
      const limitParam = `$${params.length}`;
      params.push(offset);
      const offsetParam = `$${params.length}`;

      const [rows] = await database.query(
        `SELECT im.*, pv.sku, p.name AS product_name, u.fullname AS created_by_name
         FROM inventory_movements im
         JOIN product_variants pv ON pv.id = im.variant_id
         JOIN products p ON p.id = pv.product_id
         LEFT JOIN users u ON u.id = im.created_by
         ${where}
         ORDER BY im.id DESC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params,
      );
      return rows;
    },
  };
}
