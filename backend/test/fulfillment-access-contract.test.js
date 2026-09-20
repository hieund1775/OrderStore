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
    const managerBranch1 = { sub: 10, role: 'manager', branch_id: 1 };

    await assert.rejects(
      async () => service.getTaskDetails({ taskId: 55, user: managerBranch1 }),
      (err) => err.status === 403 || /Bạn không có quyền quản lý đơn hàng của chi nhánh khác/.test(err.message),
    );
  });

  await t.test('Super Admin can query fulfillment tasks across all branches without specifying a branch', async () => {
    let capturedBranchId = undefined;
    const mockRepo = {
      async listTasks({ branchId }) {
        capturedBranchId = branchId;
        return [{ id: 1, lane: 'packing' }];
      },
    };

    const service = createFulfillmentService({ repository: mockRepo });
    const superAdmin = { sub: 1, role: 'super', branch_id: null };

    // Super Admin calling listTasks without branchId queries across all branches (branchId: null)
    const tasks = await service.listTasks({ lane: 'packing', user: superAdmin });
    assert.equal(capturedBranchId, null, 'Super Admin without branchId must query all branches');
    assert.equal(tasks.length, 1);
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
    const kitchenUser = { sub: 5, role: 'kitchen', branch_id: 1 };

    await assert.rejects(
      async () => service.updateTaskStatus({
        taskId: 77,
        user: kitchenUser,
        status: 'preparing',
      }),
      (err) => err.status === 403 || /Bạn không có quyền truy cập nhiệm vụ thuộc luồng đóng gói/.test(err.message),
    );
  });

  await t.test('Super Admin token bypasses branch scope for task detail and status update', async () => {
    let updateInput = null;
    const mockRepo = {
      async getTaskById(taskId) {
        return { id: taskId, order_id: 103, branch_id: 2, lane: 'kitchen', status: 'pending' };
      },
      async updateTaskStatus(input) {
        updateInput = input;
        return { id: input.taskId, order_id: 103, status: input.status };
      },
      async areAllTasksCompletedForOrder() {
        return false;
      },
    };
    const service = createFulfillmentService({ repository: mockRepo });
    const superAdmin = { sub: 1, role: 'super', branch_id: null };

    const task = await service.getTaskDetails({ taskId: 88, user: superAdmin });
    assert.equal(task.branch_id, 2);

    const result = await service.updateTaskStatus({ taskId: 88, user: superAdmin, status: 'preparing' });
    assert.equal(result.task.status, 'preparing');
    assert.equal(updateInput.taskId, 88);
  });
});
