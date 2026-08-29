import test from 'node:test';
import assert from 'node:assert/strict';
import { createFulfillmentRepository } from '../repositories/postgres/fulfillment.js';
import { createFulfillmentService } from '../services/orders/fulfillment-service.js';

test('Fulfillment Task Idempotency & Lifecycle Suite', async (t) => {
  await t.test('mixed order creates exactly one task per lane for the same order and branch', async () => {
    let capturedPayload = null;
    const repository = {
      async createTasksForOrder(payload) {
        capturedPayload = payload;
        return Object.entries(payload.laneItemsMap)
          .filter(([, items]) => items.length > 0)
          .map(([lane, items], index) => ({
            id: index + 1,
            order_id: payload.orderId,
            branch_id: payload.branchId,
            lane,
            status: 'pending',
            items,
          }));
      },
    };

    const service = createFulfillmentService({ repository });
    const tasks = await service.splitAndCreateTasksForOrder({
      orderId: 501,
      branchId: 1,
      items: [
        { id: 1, product_name: 'Trà đào', fulfillment_lane: 'kitchen', qty: 1 },
        { id: 2, product_name: 'Trà vải', fulfillment_lane: 'kitchen', qty: 2 },
        { id: 3, product_name: 'Áo polo', fulfillment_lane: 'packing', qty: 1 },
      ],
    });

    assert.equal(tasks.length, 2);
    assert.equal(capturedPayload.laneItemsMap.kitchen.length, 2);
    assert.equal(capturedPayload.laneItemsMap.packing.length, 1);
  });

  await t.test('repository retry never deletes existing task items and inserts items idempotently', async () => {
    const statements = [];
    const fakeDatabase = {
      async query(sql) {
        statements.push(sql.replace(/\s+/g, ' ').trim());
        if (sql.includes('INSERT INTO fulfillment_tasks')) {
          return [[{
            id: 10,
            order_id: 502,
            branch_id: 1,
            lane: 'kitchen',
            status: 'preparing',
          }]];
        }
        return [[], 0];
      },
    };

    const repository = createFulfillmentRepository(fakeDatabase);
    await repository.createTasksForOrder({
      orderId: 502,
      branchId: 1,
      laneItemsMap: {
        kitchen: [{ order_item_id: 1, product_name: 'Trà đào', quantity: 1 }],
        packing: [],
      },
    });

    assert.equal(
      statements.some((sql) => /^DELETE FROM fulfillment_task_items/i.test(sql)),
      false,
      'Retry must not delete task items that staff may already be processing',
    );

    const taskItemInsert = statements.find((sql) => /^INSERT INTO fulfillment_task_items/i.test(sql));
    assert.match(
      taskItemInsert || '',
      /ON CONFLICT/i,
      'Task item insertion needs a database-backed idempotency key',
    );
  });

  await t.test('an order that requires fulfillment is not complete when it has zero tasks', async () => {
    const repository = createFulfillmentRepository({
      async query(sql) {
        assert.match(sql, /SELECT status FROM fulfillment_tasks/);
        return [[]];
      },
    });

    assert.equal(await repository.areAllTasksCompletedForOrder(999), false);
  });

  await t.test('cancelling one order preserves completed tasks and tasks of sibling orders', async () => {
    const tasks = [
      { id: 21, order_id: 601, status: 'pending', lane: 'kitchen' },
      { id: 22, order_id: 601, status: 'completed', lane: 'packing' },
      { id: 23, order_id: 602, status: 'pending', lane: 'kitchen' },
    ];
    const repository = {
      async getTasksForOrder(orderId) {
        return tasks.filter((task) => task.order_id === orderId);
      },
      async cancelTask(taskId) {
        const task = tasks.find((candidate) => candidate.id === taskId);
        if (task && task.status !== 'completed') task.status = 'cancelled';
        return task;
      },
    };
    const service = createFulfillmentService({ repository });

    assert.equal(
      typeof service.cancelTasksForOrder,
      'function',
      'Fulfillment service must expose order-scoped cancellation',
    );
    await service.cancelTasksForOrder(601);

    assert.equal(tasks.find((task) => task.id === 21)?.status, 'cancelled');
    assert.equal(tasks.find((task) => task.id === 22)?.status, 'completed');
    assert.equal(tasks.find((task) => task.id === 23)?.status, 'pending');
  });
});
