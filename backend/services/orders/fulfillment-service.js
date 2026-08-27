import fulfillmentRepository from '../../repositories/postgres/fulfillment.js';
import postgresDb from '../../config/db-postgres.js';

export function createFulfillmentService({
  repository = fulfillmentRepository,
  database = postgresDb,
} = {}) {
  return {
    async splitAndCreateTasksForOrder({ orderId, branchId, items }, client = database) {
      if (!orderId || !branchId || !items || !Array.isArray(items)) {
        return [];
      }

      // Group items into lanes
      const laneItemsMap = {
        kitchen: [],
        packing: [],
      };

      for (const item of items) {
        // Determine lane from item or default to kitchen for drinks
        const lane = item.fulfillment_lane === 'packing' || item.lane === 'packing'
          ? 'packing'
          : 'kitchen';

        laneItemsMap[lane].push({
          order_item_id: item.id || item.order_item_id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          sku: item.sku,
          product_name: item.product_name,
          quantity: item.qty || item.quantity || 1,
          modifiers_snapshot: item.modifiers_snapshot || {
            size: item.size_label,
            sugar: item.sugar_level,
            ice: item.ice_level,
            base: item.base_tea,
            toppings: item.toppings,
          },
          note: item.note,
        });
      }

      return repository.createTasksForOrder({ orderId, branchId, laneItemsMap }, client);
    },

    async listTasks({ user, branchId = null, lane = null, statuses = null, limit = 50 }) {
      const effectiveBranchId = user?.admin_role === 'super'
        ? (branchId || null)
        : (user?.admin_branch_id || branchId || null);

      let effectiveLane = lane;
      if (user?.admin_role === 'kitchen') {
        effectiveLane = 'kitchen';
      } else if (user?.admin_role === 'packing') {
        effectiveLane = 'packing';
      }

      return repository.listTasks({
        branchId: effectiveBranchId,
        lane: effectiveLane,
        statuses,
        limit,
      });
    },

    async getTaskDetails({ taskId, user }) {
      const task = await repository.getTaskById(taskId);
      if (!task) {
        const err = new Error('Không tìm thấy nhiệm vụ chuẩn bị đơn hàng');
        err.status = 404;
        throw err;
      }

      // RBAC check
      if (user?.admin_role === 'kitchen' && task.lane !== 'kitchen') {
        const err = new Error('Bạn không có quyền truy cập nhiệm vụ thuộc luồng đóng gói');
        err.status = 403;
        throw err;
      }

      if (user?.admin_role === 'packing' && task.lane !== 'packing') {
        const err = new Error('Bạn không có quyền truy cập nhiệm vụ thuộc luồng pha chế');
        err.status = 403;
        throw err;
      }

      if (user?.admin_role !== 'super' && user?.admin_branch_id && user.admin_branch_id !== Number(task.branch_id)) {
        const err = new Error('Bạn không có quyền truy cập nhiệm vụ của chi nhánh khác');
        err.status = 403;
        throw err;
      }

      return task;
    },

    async updateTaskStatus({ taskId, user, status, notes = null }) {
      const allowedStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        const err = new Error(`Trạng thái không hợp lệ: ${status}`);
        err.status = 400;
        throw err;
      }

      // Verify task and permissions
      const task = await this.getTaskDetails({ taskId, user });

      const updatedTask = await repository.updateTaskStatus({
        taskId,
        status,
        assignedTo: user?.id || null,
        notes,
      });

      // Check if all tasks for this order are now ready/completed
      const allTasksCompleted = await repository.areAllTasksCompletedForOrder(task.order_id);

      return {
        task: updatedTask,
        allTasksCompleted,
        orderId: task.order_id,
      };
    },
  };
}

export const fulfillmentService = createFulfillmentService();
export default fulfillmentService;
