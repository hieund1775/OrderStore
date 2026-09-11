/**
 * Mobile-only POS safeguards. Server authorization remains authoritative;
 * these helpers prevent the client from silently choosing a different branch
 * or displaying an expired voucher quote.
 */
/**
 * @param {{ role?: string | null, branchId?: number | null, selectedStoreId?: number | null, availableStoreIds?: number[] }} input
 */
export function resolvePosStoreId({ role, branchId, selectedStoreId, availableStoreIds = [] }) {
  const available = new Set(availableStoreIds.map(Number));
  const requested = selectedStoreId == null ? null : Number(selectedStoreId);

  if (role === 'super') {
    if (requested && available.has(requested)) return requested;
    return availableStoreIds.length ? Number(availableStoreIds[0]) : null;
  }

  const assigned = branchId == null ? null : Number(branchId);
  return assigned && available.has(assigned) ? assigned : null;
}

/**
 * @param {{ discountAmount?: number, subtotal?: number, storeId?: number, customerPhone?: string } | null} voucher
 * @param {{ subtotal: number, storeId: number | null, customerPhone?: string }} context
 */
export function isVoucherContextCurrent(voucher, { subtotal, storeId, customerPhone }) {
  if (!voucher || !Number.isFinite(Number(voucher.discountAmount))) return false;
  return Number(voucher.subtotal) === Number(subtotal)
    && Number(voucher.storeId) === Number(storeId)
    && String(voucher.customerPhone || '') === String(customerPhone || '');
}
