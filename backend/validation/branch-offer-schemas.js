/**
 * Branch Offer Validation Schemas
 */

export function validateBranchOfferInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Payload branch offer phải là một object');
  }

  const variantId = Number(input.variant_id);
  if (!Number.isInteger(variantId) || variantId <= 0) {
    throw new Error('variant_id phải là số nguyên dương');
  }

  const price = Number(input.price);
  if (!Number.isInteger(price) || price < 0) {
    throw new Error('Giá bán (price) phải là số nguyên không âm');
  }

  const compareAtPrice =
    input.compare_at_price !== undefined && input.compare_at_price !== null && input.compare_at_price !== ''
      ? Number(input.compare_at_price)
      : null;

  if (compareAtPrice !== null && (!Number.isInteger(compareAtPrice) || compareAtPrice < 0)) {
    throw new Error('Giá so sánh (compare_at_price) phải là số nguyên không âm hoặc null');
  }

  const isAvailable = input.is_available !== undefined ? Boolean(input.is_available) : true;

  return {
    variant_id: variantId,
    price,
    compare_at_price: compareAtPrice,
    is_available: isAvailable,
  };
}
