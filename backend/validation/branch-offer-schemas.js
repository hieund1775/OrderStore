/**
 * Branch Offer Validation Schemas
 */

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function validateBranchOfferInput(input) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Payload branch offer phải là một object');
  }

  const variantId = Number(input.variant_id);
  if (!Number.isInteger(variantId) || variantId <= 0) {
    throw badRequest('variant_id phải là số nguyên dương');
  }

  const price = Number(input.price);
  if (!Number.isInteger(price) || price < 0) {
    throw badRequest('Giá bán (price) phải là số nguyên không âm');
  }

  const compareAtPrice =
    input.compare_at_price !== undefined && input.compare_at_price !== null && input.compare_at_price !== ''
      ? Number(input.compare_at_price)
      : null;

  if (compareAtPrice !== null && (!Number.isInteger(compareAtPrice) || compareAtPrice < 0)) {
    throw badRequest('Giá so sánh (compare_at_price) phải là số nguyên không âm hoặc null');
  }

  if (input.is_available !== undefined && typeof input.is_available !== 'boolean') {
    throw badRequest('is_available phải là boolean');
  }
  const isAvailable = input.is_available ?? true;

  return {
    variant_id: variantId,
    price,
    compare_at_price: compareAtPrice,
    is_available: isAvailable,
  };
}
