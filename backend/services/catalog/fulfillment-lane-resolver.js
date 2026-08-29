export function resolveFulfillmentLane({ product, lineage = [], categories = [] } = {}) {
  // 1. Explicit product override
  if (product?.fulfillment_lane) {
    return product.fulfillment_lane;
  }

  // 2. Lineage ancestor categories from leaf upwards to root
  if (lineage && lineage.length > 0) {
    for (let i = lineage.length - 1; i >= 0; i--) {
      if (lineage[i].default_fulfillment_lane) {
        return lineage[i].default_fulfillment_lane;
      }
    }
  }

  // 3. Category tree walk
  if (product?.category_id && categories && categories.length > 0) {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    let cur = catMap.get(product.category_id);
    while (cur) {
      if (cur.default_fulfillment_lane) {
        return cur.default_fulfillment_lane;
      }
      cur = cur.parent_id ? catMap.get(cur.parent_id) : null;
    }
  }

  const err = new Error(`Không thể xác định luồng xử lý cho sản phẩm "${product?.name || product?.id}"`);
  err.code = 'FULFILLMENT_LANE_REQUIRED';
  err.status = 400;
  throw err;
}
