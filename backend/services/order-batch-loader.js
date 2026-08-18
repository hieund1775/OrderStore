import postgresDb from '../config/db-postgres.js';

/**
 * PostgreSQL Order Batch Loader Service
 *
 * Eliminates N+1 query patterns across Order History and KDS workflows.
 * Fetches all order_items and order_item_toppings in exactly 2 batched queries
 * regardless of the number of orders in the page.
 */
export async function batchLoadPostgresOrderDetails(orders = [], q = postgresDb.query) {
  if (!Array.isArray(orders) || orders.length === 0) return orders;
  const orderIds = orders.map((order) => Number(order.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (!orderIds.length) return orders;

  const [items] = await q(
    `SELECT id, order_id, product_id, product_name, qty, size_label, base_tea, sugar_level, ice_level, note, unit_price, line_total
     FROM order_items WHERE order_id = ANY($1::bigint[]) ORDER BY order_id, id ASC`,
    [orderIds],
  );
  const itemIds = items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0);
  const [toppings] = itemIds.length
    ? await q(
      `SELECT id, order_item_id, topping_name, topping_price FROM order_item_toppings
       WHERE order_item_id = ANY($1::bigint[]) ORDER BY order_item_id, id ASC`,
      [itemIds],
    )
    : [[]];
  const toppingsByItemId = new Map();
  for (const topping of toppings) {
    const list = toppingsByItemId.get(String(topping.order_item_id)) || [];
    list.push({ id: topping.id, name: topping.topping_name, price: topping.topping_price });
    toppingsByItemId.set(String(topping.order_item_id), list);
  }
  const itemsByOrderId = new Map();
  for (const item of items) {
    const list = itemsByOrderId.get(String(item.order_id)) || [];
    list.push({ ...item, toppings: toppingsByItemId.get(String(item.id)) || [] });
    itemsByOrderId.set(String(item.order_id), list);
  }
  for (const order of orders) order.items = itemsByOrderId.get(String(order.id)) || [];
  return orders;
}

export const batchLoadOrderDetails = batchLoadPostgresOrderDetails;
