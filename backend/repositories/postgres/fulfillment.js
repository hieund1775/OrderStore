import postgresDb from '../../config/db-postgres.js';

export function createFulfillmentRepository(database = postgresDb) {
  return {
    async getTasksForOrder(orderId, client = database) {
      const [rows] = await client.query(
        `SELECT id, order_id, branch_id, lane, status, assigned_to, started_at, completed_at, notes, created_at, updated_at
         FROM fulfillment_tasks
         WHERE order_id = $1`,
        [Number(orderId)],
      );
      return rows;
    },

    async createTasksForOrder({ orderId, branchId, laneItemsMap }, client = database) {
      const createdTasks = [];

      for (const [lane, items] of Object.entries(laneItemsMap)) {
        if (!items || items.length === 0) continue;

        // Insert task idempotently without resetting status or dates
        const [taskRows] = await client.query(
          `INSERT INTO fulfillment_tasks (order_id, branch_id, lane, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT (order_id, lane) DO UPDATE
           SET updated_at = CURRENT_TIMESTAMP
           RETURNING id, order_id, branch_id, lane, status, created_at, updated_at`,
          [orderId, branchId, lane],
        );

        const task = taskRows[0];
        if (!task) continue;

        // Insert task items using ON CONFLICT (task_id, order_item_id) DO NOTHING (never delete existing)
        for (const item of items) {
          if (item.order_item_id) {
            await client.query(
              `INSERT INTO fulfillment_task_items
               (task_id, order_item_id, product_id, variant_id, sku, product_name, quantity, modifiers_snapshot, item_notes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (task_id, order_item_id) DO NOTHING`,
              [
                task.id,
                item.order_item_id,
                item.product_id || null,
                item.variant_id || null,
                item.sku || null,
                item.product_name,
                item.quantity || item.qty || 1,
                item.modifiers_snapshot ? JSON.stringify(item.modifiers_snapshot) : null,
                item.note || item.item_notes || null,
              ],
            );
          } else {
            await client.query(
              `INSERT INTO fulfillment_task_items
               (task_id, order_item_id, product_id, variant_id, sku, product_name, quantity, modifiers_snapshot, item_notes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                task.id,
                null,
                item.product_id || null,
                item.variant_id || null,
                item.sku || null,
                item.product_name,
                item.quantity || item.qty || 1,
                item.modifiers_snapshot ? JSON.stringify(item.modifiers_snapshot) : null,
                item.note || item.item_notes || null,
              ],
            );
          }
        }

        createdTasks.push(task);
      }

      return createdTasks;
    },

    async listTasks({ branchId = null, lane = null, statuses = null, limit = 50 }, client = database) {
      const conditions = [];
      const values = [];
      let idx = 1;

      if (branchId) {
        conditions.push(`t.branch_id = $${idx++}`);
        values.push(branchId);
      }

      if (lane) {
        conditions.push(`t.lane = $${idx++}`);
        values.push(lane);
      }

      if (statuses && Array.isArray(statuses) && statuses.length > 0) {
        conditions.push(`t.status = ANY($${idx++})`);
        values.push(statuses);
      } else if (typeof statuses === 'string') {
        conditions.push(`t.status = $${idx++}`);
        values.push(statuses);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      values.push(limit);

      const [taskRows] = await client.query(
        `SELECT
           t.id, t.order_id, t.branch_id, t.lane, t.status,
           t.assigned_to, t.started_at, t.completed_at, t.notes,
           t.created_at, t.updated_at,
           o.order_code, o.order_type, o.table_id, o.location_name,
           o.user_id, u.fullname AS customer_name, u.phone AS customer_phone,
           s.name AS store_name
         FROM fulfillment_tasks t
         JOIN orders o ON o.id = t.order_id
         JOIN stores s ON s.id = t.branch_id
         LEFT JOIN users u ON u.id = o.user_id
         ${whereClause}
         ORDER BY
           CASE t.status
             WHEN 'preparing' THEN 1
             WHEN 'pending' THEN 2
             WHEN 'ready' THEN 3
             WHEN 'completed' THEN 4
             WHEN 'cancelled' THEN 5
             ELSE 6
           END ASC,
           t.created_at ASC
         LIMIT $${idx}`,
        values,
      );

      if (taskRows.length === 0) return [];

      const taskIds = taskRows.map((t) => t.id);
      const [itemRows] = await client.query(
        `SELECT
           ti.id, ti.task_id, ti.order_item_id, ti.product_id, ti.variant_id,
           ti.sku, ti.product_name, ti.quantity, ti.modifiers_snapshot, ti.item_notes
         FROM fulfillment_task_items ti
         WHERE ti.task_id = ANY($1::bigint[])
         ORDER BY ti.id ASC`,
        [taskIds],
      );

      const itemsByTaskId = new Map();
      for (const item of itemRows) {
        const list = itemsByTaskId.get(item.task_id) || [];
        list.push(item);
        itemsByTaskId.set(item.task_id, list);
      }

      return taskRows.map((task) => ({
        ...task,
        items: itemsByTaskId.get(task.id) || [],
      }));
    },

    async getTaskById(taskId, client = database) {
      const [taskRows] = await client.query(
        `SELECT
           t.id, t.order_id, t.branch_id, t.lane, t.status,
           t.assigned_to, t.started_at, t.completed_at, t.notes,
           t.created_at, t.updated_at,
           o.order_code, o.order_type, o.table_id, o.location_name,
           o.user_id, u.fullname AS customer_name, u.phone AS customer_phone,
           s.name AS store_name
         FROM fulfillment_tasks t
         JOIN orders o ON o.id = t.order_id
         JOIN stores s ON s.id = t.branch_id
         LEFT JOIN users u ON u.id = o.user_id
         WHERE t.id = $1`,
        [taskId],
      );

      const task = taskRows[0];
      if (!task) return null;

      const [itemRows] = await client.query(
        `SELECT
           ti.id, ti.task_id, ti.order_item_id, ti.product_id, ti.variant_id,
           ti.sku, ti.product_name, ti.quantity, ti.modifiers_snapshot, ti.item_notes
         FROM fulfillment_task_items ti
         WHERE ti.task_id = $1
         ORDER BY ti.id ASC`,
        [taskId],
      );

      return {
        ...task,
        items: itemRows,
      };
    },

    async updateTaskStatus({ taskId, status, assignedTo = null, notes = null }, client = database) {
      let timeUpdateSql = '';
      if (status === 'preparing') {
        timeUpdateSql = ', started_at = COALESCE(started_at, CURRENT_TIMESTAMP)';
      } else if (status === 'ready' || status === 'completed') {
        timeUpdateSql = ', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)';
      }

      const [rows] = await client.query(
        `UPDATE fulfillment_tasks
         SET status = $2,
             assigned_to = COALESCE($3, assigned_to),
             notes = COALESCE($4, notes),
             updated_at = CURRENT_TIMESTAMP
             ${timeUpdateSql}
         WHERE id = $1
         RETURNING id, order_id, branch_id, lane, status, assigned_to, started_at, completed_at, notes, updated_at`,
        [taskId, status, assignedTo, notes],
      );

      return rows[0] || null;
    },

    async cancelTasksForOrder(orderId, client = database) {
      const [rows] = await client.query(
        `UPDATE fulfillment_tasks
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1 AND status <> 'completed'
         RETURNING id, order_id, status`,
        [Number(orderId)],
      );
      return rows;
    },

    async areAllTasksCompletedForOrder(orderId, client = database) {
      const [rows] = await client.query(
        `SELECT status FROM fulfillment_tasks WHERE order_id = $1`,
        [orderId],
      );

      if (!rows || rows.length === 0) return false;

      // All non-cancelled tasks must be 'ready' or 'completed'
      const activeTasks = rows.filter((r) => r.status !== 'cancelled');
      if (activeTasks.length === 0) return false;

      return activeTasks.every((r) => r.status === 'ready' || r.status === 'completed');
    },
  };
}

export const fulfillmentRepository = createFulfillmentRepository();
export default fulfillmentRepository;
