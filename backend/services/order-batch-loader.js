import db from '../config/db.js';
import postgresDb from '../config/db-postgres.js';

/**
 * Production Order Batch Loader Service
 *
 * Eliminates N+1 query patterns across Order History and KDS workflows.
 * Fetches all order_items and order_item_toppings in exactly 2 batched queries
 * regardless of the number of orders in the page.
 */
export async function batchLoadOrderDetails(orders = [], q = db.query) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return orders;
  }

  const orderIds = orders.map((o) => Number(o.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (orderIds.length === 0) return orders;

  // 1. Batch load all order_items in a single query
  const itemPlaceholders = orderIds.map(() => '?').join(',');
  const [itemRows] = await q(
    `SELECT id, order_id, product_id, product_name, qty, size_label, base_tea, sugar_level, ice_level, note, unit_price, line_total
     FROM order_items
     WHERE order_id IN (${itemPlaceholders})
     ORDER BY order_id, id ASC`,
    orderIds
  );

  const items = itemRows || [];
  const itemIds = items.map((i) => Number(i.id)).filter((id) => Number.isInteger(id) && id > 0);

  // 2. Batch load all order_item_toppings in a single query
  const toppingsByItemId = new Map();
  if (itemIds.length > 0) {
    const toppingPlaceholders = itemIds.map(() => '?').join(',');
    const [toppingRows] = await q(
      `SELECT id, order_item_id, topping_name, topping_price
       FROM order_item_toppings
       WHERE order_item_id IN (${toppingPlaceholders})
       ORDER BY order_item_id, id ASC`,
      itemIds
    );

    for (const t of toppingRows || []) {
      const list = toppingsByItemId.get(t.order_item_id) || [];
      list.push({
        id: t.id,
        name: t.topping_name,
        price: t.topping_price,
      });
      toppingsByItemId.set(t.order_item_id, list);
    }
  }

  // 3. Group items and toppings by order_id
  const itemsByOrderId = new Map();
  for (const item of items) {
    const toppings = toppingsByItemId.get(item.id) || [];
    const enrichedItem = {
      ...item,
      toppings,
    };
    const list = itemsByOrderId.get(item.order_id) || [];
    list.push(enrichedItem);
    itemsByOrderId.set(item.order_id, list);
  }

  // 4. Attach items back to original orders preserving order
  for (const order of orders) {
    order.items = itemsByOrderId.get(order.id) || [];
  }

  return orders;
}

/**
 * PostgreSQL counterpart for public order history.  It retains the same DTO
 * shape while using array parameters instead of SQL Server placeholder lists.
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
