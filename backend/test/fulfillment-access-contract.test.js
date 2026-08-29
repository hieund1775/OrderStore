import test from 'node:test';
import assert from 'node:assert/strict';
import { createFulfillmentService } from '../services/orders/fulfillment-service.js';

test('Fulfillment Access & Multi-Branch RBAC Contract Suite', async (t) => {
  await t.test('Red Behavior: Manager can only access fulfillment tasks belonging to their assigned branch', async () => {
    const mockRepo = {
      async getTaskById(taskId) {
        return {
          id: taskId,
          order_id: 101,
          branch_id: 2, // Branch 2
          lane: 'kitchen',
          status: 'pending',
        };
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    const managerBranch1 = { id: 10, admin_role: 'manager', admin_branch_id: 1 };

    await assert.rejects(
      async () => service.getTaskDetails({ taskId: 55, user: managerBranch1 }),
      (err) => err.status === 403 || /Bạn không có quyền quản lý đơn hàng của chi nhánh khác/.test(err.message),
    );
  });

  await t.test('Super Admin must specify a branch explicitly before loading board tasks', async () => {
    let repositoryCalled = false;
    const mockRepo = {
      async listTasks() {
        repositoryCalled = true;
        return [];
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    const superAdmin = { id: 1, admin_role: 'super', admin_branch_id: null };

    // Super Admin calling listTasksByLane without branchId must fail with 400
    await assert.rejects(
      async () => service.listTasks({ lane: 'kitchen', user: superAdmin }),
      (err) => err?.status === 400 && err?.code === 'FULFILLMENT_BRANCH_REQUIRED',
    );
    assert.equal(repositoryCalled, false, 'Invalid board scope must be rejected before querying tasks');
  });

  await t.test('Red Behavior: Kitchen user cannot update packing task status', async () => {
    const mockRepo = {
      async getTaskById(taskId) {
        return {
          id: taskId,
          order_id: 102,
          branch_id: 1,
          lane: 'packing',
          status: 'pending',
        };
      },
      async updateTaskStatus() {
        throw new Error('Should not update');
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    const kitchenUser = { id: 5, admin_role: 'kitchen', admin_branch_id: 1 };

    await assert.rejects(
      async () => service.updateTaskStatus({
        taskId: 77,
        user: kitchenUser,
        status: 'preparing',
      }),
      (err) => err.status === 403 || /Bạn không có quyền truy cập nhiệm vụ thuộc luồng đóng gói/.test(err.message),
    );
  });
});
