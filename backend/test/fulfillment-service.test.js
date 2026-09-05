import test from 'node:test';
import assert from 'node:assert/strict';
import { createFulfillmentService } from '../services/orders/fulfillment-service.js';

test('Fulfillment Lane & Task Splitting Suite', async (t) => {
  await t.test('splits mixed order items into kitchen and packing lanes', async () => {
    let capturedOrder = null;
    const mockRepo = {
      async isLaneActive() {
        return true;
      },
      async createTasksForOrder(payload) {
        capturedOrder = payload;
        return [
          { id: 1, lane: 'kitchen', status: 'pending' },
          { id: 2, lane: 'packing', status: 'pending' },
        ];
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    const items = [
      { id: 101, product_name: 'Trà Sữa Ô Long', fulfillment_lane: 'kitchen', qty: 2 },
      { id: 102, product_name: 'Áo Thun TeaPlus', fulfillment_lane: 'packing', qty: 1 },
    ];

    const tasks = await service.splitAndCreateTasksForOrder({
      orderId: 99,
      branchId: 1,
      items,
    });

    assert.equal(tasks.length, 2);
    assert.equal(capturedOrder.laneItemsMap.kitchen.length, 1);
    assert.equal(capturedOrder.laneItemsMap.kitchen[0].product_name, 'Trà Sữa Ô Long');
    assert.equal(capturedOrder.laneItemsMap.packing.length, 1);
    assert.equal(capturedOrder.laneItemsMap.packing[0].product_name, 'Áo Thun TeaPlus');
  });

  await t.test('enforces RBAC so kitchen staff cannot access packing lane tasks', async () => {
    const mockRepo = {
      async getTaskById(id) {
        return { id, lane: 'packing', branch_id: 1, status: 'pending' };
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    const kitchenUser = { sub: 5, role: 'kitchen', branch_id: 1 };

    await assert.rejects(
      async () => service.getTaskDetails({ taskId: 10, user: kitchenUser }),
      /Bạn không có quyền truy cập nhiệm vụ thuộc luồng đóng gói/,
    );
  });

  await t.test('enforces RBAC so packing staff cannot access kitchen lane tasks', async () => {
    const mockRepo = {
      async getTaskById(id) {
        return { id, lane: 'kitchen', branch_id: 1, status: 'pending' };
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    const packingUser = { sub: 6, role: 'packing', branch_id: 1 };

    await assert.rejects(
      async () => service.getTaskDetails({ taskId: 11, user: packingUser }),
      /Bạn không có quyền truy cập nhiệm vụ thuộc luồng pha chế/,
    );
  });

  await t.test('detects all tasks completed for order', async () => {
    const mockRepo = {
      async getTaskById(id) {
        return { id, lane: 'packing', branch_id: 1, order_id: 88, status: 'preparing' };
      },
      async updateTaskStatus({ taskId, status }) {
        return { id: taskId, status, order_id: 88 };
      },
      async areAllTasksCompletedForOrder(orderId) {
        return true;
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    const managerUser = { sub: 1, role: 'manager', branch_id: 1 };

    const result = await service.updateTaskStatus({
      taskId: 20,
      user: managerUser,
      status: 'ready',
    });

    assert.equal(result.task.status, 'ready');
    assert.equal(result.allTasksCompleted, true);
    assert.equal(result.orderId, 88);
  });

  await t.test('rejects regression from a terminal task status', async () => {
    const mockRepo = {
      async getTaskById(id) {
        return { id, lane: 'kitchen', branch_id: 1, order_id: 88, status: 'completed' };
      },
      async updateTaskStatus() {
        throw new Error('must not update');
      },
    };
    const service = createFulfillmentService({ repository: mockRepo });
    await assert.rejects(
      service.updateTaskStatus({
        taskId: 20,
        user: { sub: 1, role: 'manager', branch_id: 1 },
        status: 'preparing',
      }),
      (err) => err?.status === 409 && err?.code === 'FULFILLMENT_STATUS_TRANSITION_INVALID',
    );
  });

  await t.test('rejects a missing fulfillment lane instead of silently routing it to kitchen', async () => {
    const mockRepo = {
      async createTasksForOrder() {
        return [];
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });

    await assert.rejects(
      async () => service.splitAndCreateTasksForOrder({
        orderId: 100,
        branchId: 1,
        items: [{ id: 301, product_name: 'Unknown Item', fulfillment_lane: null, qty: 1 }],
      }),
      (err) => err?.status === 400 && err?.code === 'FULFILLMENT_LANE_REQUIRED',
    );
  });

  await t.test('rejects an unsupported fulfillment lane instead of silently routing it to kitchen', async () => {
    const mockRepo = {
      async createTasksForOrder() {
        return [];
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });

    await assert.rejects(
      async () => service.splitAndCreateTasksForOrder({
        orderId: 100,
        branchId: 1,
        items: [{ id: 302, product_name: 'Robot Item', fulfillment_lane: 'drone_delivery', qty: 1 }],
      }),
      (err) => err?.status === 400 && err?.code === 'FULFILLMENT_LANE_UNSUPPORTED',
    );
  });

  await t.test('rejects a registered but inactive fulfillment lane', async () => {
    const mockRepo = {
      async isLaneActive(lane) {
        assert.equal(lane, 'packing');
        return false;
      },
      async createTasksForOrder() {
        return [];
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    await assert.rejects(
      async () => service.splitAndCreateTasksForOrder({
        orderId: 100,
        branchId: 1,
        items: [{ id: 303, product_name: 'Inactive lane item', fulfillment_lane: 'packing', qty: 1 }],
      }),
      (err) => err?.status === 409 && err?.code === 'FULFILLMENT_LANE_INACTIVE',
    );
  });
});
