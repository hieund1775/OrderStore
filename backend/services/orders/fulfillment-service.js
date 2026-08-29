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

      // Check if tasks already exist for this order (Idempotency)
      if (typeof repository.getTasksForOrder === 'function') {
        const existing = await repository.getTasksForOrder(orderId, client);
        if (existing && existing.length > 0) {
          return existing;
        }
      }

      // Group items into lanes
      const laneItemsMap = {
        kitchen: [],
        packing: [],
      };

      for (const item of items) {
        const lane = item.fulfillment_lane || item.lane;
        if (!lane) {
          const err = new Error(`Luồng xử lý không hợp lệ hoặc chưa được thiết lập cho sản phẩm "${item.product_name || item.id}"`);
          err.status = 400;
          err.code = 'FULFILLMENT_LANE_REQUIRED';
          throw err;
        }

        const normalizedLane = String(lane).trim().toLowerCase();
        if (!['kitchen', 'packing'].includes(normalizedLane)) {
          const err = new Error(`Luồng xử lý ${lane} không được hỗ trợ`);
          err.status = 400;
          err.code = 'FULFILLMENT_LANE_UNSUPPORTED';
          throw err;
        }

        if (typeof repository.isLaneActive === 'function') {
          const active = await repository.isLaneActive(normalizedLane);
          if (!active) {
            const err = new Error(`Luồng xử lý ${lane} đang tạm ngừng hoạt động`);
            err.status = 409;
            err.code = 'FULFILLMENT_LANE_INACTIVE';
            throw err;
          }
        }

        laneItemsMap[normalizedLane].push({
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
      if (user?.admin_role === 'super' && !branchId) {
        const err = new Error('Vui lòng chọn chi nhánh cụ thể để xem danh sách vận hành');
        err.status = 400;
        err.code = 'FULFILLMENT_BRANCH_REQUIRED';
        throw err;
      }

      const effectiveBranchId = user?.admin_role === 'super'
        ? branchId
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

      if (user?.admin_role !== 'super' && user?.admin_branch_id && Number(user.admin_branch_id) !== Number(task.branch_id)) {
        const err = new Error('Bạn không có quyền quản lý đơn hàng của chi nhánh khác');
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

    async cancelTasksForOrder(orderId, client = database) {
      if (!orderId) return [];
      if (typeof repository.cancelTasksForOrder === 'function') {
        return await repository.cancelTasksForOrder(orderId, client);
      }
      const tasks = await repository.getTasksForOrder(orderId, client);
      const results = [];
      for (const t of tasks || []) {
        if (t.status !== 'completed') {
          if (typeof repository.cancelTask === 'function') {
            const res = await repository.cancelTask(t.id, client);
            results.push(res);
          } else if (typeof repository.updateTaskStatus === 'function') {
            const res = await repository.updateTaskStatus({ taskId: t.id, status: 'cancelled' }, client);
            results.push(res);
          }
        }
      }
      return results;
    },

    async areAllTasksCompletedForOrder(orderId, client = database) {
      if (!orderId) return false;
      return await repository.areAllTasksCompletedForOrder(orderId, client);
    },
  };
}

export const fulfillmentService = createFulfillmentService();
export default fulfillmentService;
