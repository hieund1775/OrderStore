import postgresDb from '../../config/db-postgres.js';
import paymentProfilesRepository from '../../repositories/postgres/payment-profiles.js';

export class PaymentResolverError extends Error {
  constructor(message, status = 400, code = 'PAYMENT_RESOLVER_ERROR') {
    super(message);
    this.name = 'PaymentResolverError';
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

/**
 * Resolve root category for a list of items and determine payment profile.
 */
export async function resolvePaymentProfileForCart({
  storeId,
  items = [],
  database = postgresDb,
  profilesRepo = paymentProfilesRepository,
}) {
  if (!items || items.length === 0) {
    throw new PaymentResolverError('Giỏ hàng không có sản phẩm', 400);
  }

  // 1. Load product root categories for all items
  const productIds = [...new Set(items.map((it) => Number(it.product_id)).filter(Number.isInteger))];
  if (productIds.length === 0) {
    throw new PaymentResolverError('Danh sách sản phẩm không hợp lệ', 400);
  }

  const [productRows] = await database.query(
    `SELECT p.id AS product_id, p.name AS product_name, p.price,
            c.id AS category_id, c.name AS category_name, c.depth, c.parent_id,
            COALESCE(root.id, c.id) AS root_category_id,
            COALESCE(root.name, c.name) AS root_category_name,
            COALESCE(root.slug, c.slug) AS root_category_slug
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories root ON root.id = c.parent_id
     WHERE p.id = ANY($1::bigint[])`,
    [productIds],
  );

  const productMap = new Map();
  for (const row of productRows) {
    productMap.set(Number(row.product_id), {
      productId: Number(row.product_id),
      productName: row.product_name,
      rootCategoryId: Number(row.root_category_id),
      rootCategoryName: row.root_category_name,
      rootCategorySlug: row.root_category_slug,
    });
  }

  // 2. Group items by root category
  const rootGroupsMap = new Map();
  for (const item of items) {
    const prodInfo = productMap.get(Number(item.product_id));
    if (!prodInfo) {
      throw new PaymentResolverError(`Sản phẩm #${item.product_id} không tồn tại hoặc chưa gán danh mục`, 400);
    }
    const rootId = prodInfo.rootCategoryId;
    if (!rootGroupsMap.has(rootId)) {
      rootGroupsMap.set(rootId, {
        rootCategoryId: rootId,
        rootCategoryName: prodInfo.rootCategoryName,
        rootCategorySlug: prodInfo.rootCategorySlug,
        items: [],
      });
    }
    rootGroupsMap.get(rootId).items.push(item);
  }

  const rootGroups = Array.from(rootGroupsMap.values());

  // 3. Fallback system profiles
  const getSystemLongProfile = async () => {
    let longProfile = await profilesRepo.getProfileByCode('LONG_GROUPED_CHECKOUT');
    if (!longProfile) {
      longProfile = await profilesRepo.getProfileByCode('DEFAULT_LONG');
    }
    if (!longProfile) {
      // Ephemeral fallback object for system continuity
      return {
        id: null,
        code: 'LONG_GROUPED_CHECKOUT',
        display_name: 'Long - Checkout Hệ Thống',
        bank_name: null,
        bank_bin: null,
        account_number: null,
        account_holder: null,
        env_prefix: 'PAYOS_PROFILE_LONG_GROUPED_CHECKOUT',
        status: 'active',
        version: 1,
        is_env_configured: true,
      };
    }
    return longProfile;
  };

  // Case A: Cart spans multiple root industries
  if (rootGroups.length > 1) {
    const longProfile = await getSystemLongProfile();
    return {
      isGrouped: true,
      profile: longProfile,
      rootGroups,
    };
  }

  // Case B: Cart belongs to exactly 1 root industry
  const singleRoot = rootGroups[0];
  const mappedProfile = await profilesRepo.getActiveProfileByRootCategoryId(singleRoot.rootCategoryId);

  if (mappedProfile && mappedProfile.status === 'active') {
    return {
      isGrouped: false,
      profile: mappedProfile,
      rootCategory: singleRoot,
      rootGroups,
    };
  }

  // Fallback to Long profile if unmapped or inactive
  console.warn(
    `⚠️ [Payment Profile Fallback]: Ngành "${singleRoot.rootCategoryName}" (ID: ${singleRoot.rootCategoryId}) chưa có profile active, fallback về LONG_GROUPED_CHECKOUT`,
  );
  const fallbackLongProfile = await getSystemLongProfile();
  return {
    isGrouped: false,
    profile: fallbackLongProfile,
    isFallback: true,
    rootCategory: singleRoot,
    rootGroups,
  };
}

/**
 * Allocate voucher discount and compute totals pro-rata with exact integer remainder guarantee.
 */
export function allocateVoucherDiscount({
  rootGroupsWithSubtotal = [],
  voucherDiscount = 0,
  shippingFee = 0,
}) {
  const totalSubtotal = rootGroupsWithSubtotal.reduce((sum, g) => sum + Number(g.subtotal || 0), 0);
  const totalDiscount = Math.min(Number(voucherDiscount || 0), totalSubtotal);

  let remainingDiscount = totalDiscount;
  const allocations = [];

  for (let i = 0; i < rootGroupsWithSubtotal.length; i++) {
    const group = rootGroupsWithSubtotal[i];
    const isLast = i === rootGroupsWithSubtotal.length - 1;
    const subtotal = Number(group.subtotal || 0);

    let allocatedDiscount = 0;
    if (totalSubtotal > 0 && totalDiscount > 0) {
      if (isLast) {
        allocatedDiscount = remainingDiscount;
      } else {
        allocatedDiscount = Math.floor((subtotal / totalSubtotal) * totalDiscount);
        remainingDiscount -= allocatedDiscount;
      }
    }

    const allocatedShipping = i === 0 ? Number(shippingFee || 0) : 0; // Shipping assigned to primary child order
    const allocatedTotal = Math.max(0, subtotal - allocatedDiscount + allocatedShipping);

    allocations.push({
      rootCategoryId: group.rootCategoryId,
      rootCategoryName: group.rootCategoryName,
      rootCategorySlug: group.rootCategorySlug,
      allocatedSubtotal: subtotal,
      allocatedDiscount,
      allocatedShippingFee: allocatedShipping,
      allocatedTotal,
      items: group.items,
    });
  }

  return {
    subtotal: totalSubtotal,
    discountAmount: totalDiscount,
    shippingFee: Number(shippingFee || 0),
    totalAmount: allocations.reduce((sum, a) => sum + a.allocatedTotal, 0),
    allocations,
  };
}
