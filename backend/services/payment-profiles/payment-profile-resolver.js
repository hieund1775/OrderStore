import postgresDb from '../../config/db-postgres.js';
import paymentProfilesRepository from '../../repositories/postgres/payment-profiles.js';
import { isPayOSConfigured } from '../payos.js';

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

  // Fallback system profile helper (no silent DB catch)
  const getSystemLongProfile = async () => {
    let longProfile = await profilesRepo.getProfileByCode('LONG_GROUPED_CHECKOUT');
    if (!longProfile) {
      longProfile = await profilesRepo.getProfileByCode('DEFAULT_LONG');
    }
    if (longProfile) return longProfile;

    // Ephemeral fallback object for system continuity if DB row is not yet seeded
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
  };

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

  // 2. Group items by root category (strict fail-closed if product is unmapped/missing in DB)
  const rootGroupsMap = new Map();
  for (const item of items) {
    const prodInfo = productMap.get(Number(item.product_id));
    if (!prodInfo) {
      throw new PaymentResolverError(`Sản phẩm #${item.product_id} không tồn tại hoặc chưa gán danh mục`, 400, 'PRODUCT_CATEGORY_MISSING');
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

  const isConfigured = mappedProfile ? isPayOSConfigured(mappedProfile.code) : false;

  if (mappedProfile && mappedProfile.status === 'active' && isConfigured) {
    return {
      isGrouped: false,
      profile: mappedProfile,
      rootCategory: singleRoot,
      rootGroups,
    };
  }

  // Fallback to Long profile ONLY for valid business conditions:
  // 1. Root category has no profile mapped (mappedProfile == null)
  // 2. Mapped profile is not active (status !== 'active')
  // 3. Mapped profile is missing ENV (isConfigured == false)
  const reason = !mappedProfile
    ? 'chưa gán profile'
    : mappedProfile.status !== 'active'
      ? 'profile chưa kích hoạt'
      : 'chưa cấu hình đủ biến môi trường ENV';

  const auditPayload = {
    event: 'PAYMENT_PROFILE_FALLBACK',
    rootCategoryId: singleRoot.rootCategoryId,
    rootCategoryName: singleRoot.rootCategoryName,
    reason,
    targetProfileCode: 'LONG_GROUPED_CHECKOUT',
    timestamp: new Date().toISOString(),
  };
  console.info(`⚠️ [Payment Profile Fallback]: ${JSON.stringify(auditPayload)}`);

  try {
    if (database && typeof database.query === 'function') {
      await database.query(
        `INSERT INTO audit_logs (action, target_type, target_id, details)
         VALUES ('PAYMENT_PROFILE_FALLBACK', 'root_category', $1, $2::jsonb)`,
        [singleRoot.rootCategoryId, JSON.stringify(auditPayload)],
      );
    }
  } catch {}

  const fallbackLongProfile = await getSystemLongProfile();
  return {
    isGrouped: false,
    profile: fallbackLongProfile,
    isFallback: true,
    fallbackReason: reason,
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
  const totalSubtotal = rootGroupsWithSubtotal.reduce((sum, g) => sum + Math.round(Number(g.subtotal || 0)), 0);
  const totalDiscount = Math.min(Math.round(Number(voucherDiscount || 0)), totalSubtotal);

  let remainingDiscount = totalDiscount;
  const allocations = [];

  for (let i = 0; i < rootGroupsWithSubtotal.length; i++) {
    const group = rootGroupsWithSubtotal[i];
    const isLast = i === rootGroupsWithSubtotal.length - 1;
    const subtotal = Math.round(Number(group.subtotal || 0));

    let allocatedDiscount = 0;
    if (totalSubtotal > 0 && totalDiscount > 0) {
      if (isLast) {
        allocatedDiscount = remainingDiscount;
      } else {
        // Integer-safe multiplication before division
        allocatedDiscount = Math.floor((subtotal * totalDiscount) / totalSubtotal);
        remainingDiscount -= allocatedDiscount;
      }
    }

    const allocatedShipping = i === 0 ? Math.round(Number(shippingFee || 0)) : 0;
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
    shippingFee: Math.round(Number(shippingFee || 0)),
    totalAmount: allocations.reduce((sum, a) => sum + a.allocatedTotal, 0),
    allocations,
  };
}
