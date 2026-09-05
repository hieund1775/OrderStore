import fulfillmentRepository from '../../repositories/postgres/fulfillment.js';
import postgresDb from '../../config/db-postgres.js';

export function createFulfillmentService({
  repository = fulfillmentRepository,
  database = postgresDb,
} = {}) {
  return {
    async splitAndCreateTasksForOrder({ orderId, branchId, items }, client = database) {
      if (!Number.isInteger(Number(orderId)) || Number(orderId) <= 0
        || !Number.isInteger(Number(branchId)) || Number(branchId) <= 0
        || !Array.isArray(items) || items.length === 0) {
        const err = new Error('Dữ liệu tạo nhiệm vụ vận hành không hợp lệ');
        err.status = 400;
        err.code = 'FULFILLMENT_INPUT_INVALID';
        throw err;
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

        if (typeof repository.isLaneActive !== 'function') {
          const err = new Error('Không thể xác minh trạng thái luồng xử lý');
          err.status = 500;
          err.code = 'FULFILLMENT_LANE_VALIDATION_UNAVAILABLE';
          throw err;
        }
        const active = await repository.isLaneActive(normalizedLane, client);
        if (!active) {
          const err = new Error(`Luồng xử lý ${lane} đang tạm ngừng hoạt động`);
          err.status = 409;
          err.code = 'FULFILLMENT_LANE_INACTIVE';
          throw err;
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
      if (user?.role === 'super' && !branchId) {
        const err = new Error('Vui lòng chọn chi nhánh cụ thể để xem danh sách vận hành');
        err.status = 400;
        err.code = 'FULFILLMENT_BRANCH_REQUIRED';
        throw err;
      }

      const requestedBranchId = branchId == null ? null : Number(branchId);
      const assignedBranchId = user?.branch_id == null ? null : Number(user.branch_id);
      if (user?.role !== 'super') {
        if (!assignedBranchId) {
          const err = new Error('Tài khoản vận hành chưa được gán chi nhánh');
          err.status = 403;
          err.code = 'FULFILLMENT_BRANCH_ASSIGNMENT_REQUIRED';
          throw err;
        }
        if (requestedBranchId && requestedBranchId !== assignedBranchId) {
          const err = new Error('Bạn không có quyền truy cập nhiệm vụ của chi nhánh khác');
          err.status = 403;
          err.code = 'FULFILLMENT_BRANCH_FORBIDDEN';
          throw err;
        }
      }

      const effectiveBranchId = user?.role === 'super' ? requestedBranchId : assignedBranchId;

      let effectiveLane = lane;
      if (user?.role === 'kitchen') {
        if (lane && lane !== 'kitchen') {
          const err = new Error('Tài khoản bếp không có quyền truy cập luồng khác');
          err.status = 403;
          err.code = 'FULFILLMENT_LANE_FORBIDDEN';
          throw err;
        }
        effectiveLane = 'kitchen';
      } else if (user?.role === 'packing') {
        if (lane && lane !== 'packing') {
          const err = new Error('Tài khoản đóng gói không có quyền truy cập luồng khác');
          err.status = 403;
          err.code = 'FULFILLMENT_LANE_FORBIDDEN';
          throw err;
        }
        effectiveLane = 'packing';
      }

      if (effectiveLane && !['kitchen', 'packing'].includes(effectiveLane)) {
        const err = new Error(`Luồng xử lý ${effectiveLane} không được hỗ trợ`);
        err.status = 400;
        err.code = 'FULFILLMENT_LANE_UNSUPPORTED';
        throw err;
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
      if (user?.role === 'kitchen' && task.lane !== 'kitchen') {
        const err = new Error('Bạn không có quyền truy cập nhiệm vụ thuộc luồng đóng gói');
        err.status = 403;
        throw err;
      }

      if (user?.role === 'packing' && task.lane !== 'packing') {
        const err = new Error('Bạn không có quyền truy cập nhiệm vụ thuộc luồng pha chế');
        err.status = 403;
        throw err;
      }

      if (user?.role !== 'super' && (
        user?.branch_id == null
        || Number(user.branch_id) !== Number(task.branch_id)
      )) {
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

      const allowedTransitions = {
        pending: new Set(['preparing', 'cancelled']),
        preparing: new Set(['ready', 'cancelled']),
        ready: new Set(['completed', 'cancelled']),
        completed: new Set(),
        cancelled: new Set(),
      };
      if (!allowedTransitions[task.status]?.has(status)) {
        const err = new Error(`KhÃ´ng thá»ƒ chuyá»ƒn nhiá»‡m vá»¥ tá»« ${task.status} sang ${status}`);
        err.status = 409;
        err.code = 'FULFILLMENT_STATUS_TRANSITION_INVALID';
        throw err;
      }

      const updatedTask = await repository.updateTaskStatus({
        taskId,
        status,
        assignedTo: user?.id || null,
        notes,
        expectedStatus: task.status,
      });
      if (!updatedTask) {
        const err = new Error('Nhiá»‡m vá»¥ vá»«a Ä‘Æ°á»£c cáº­p nháº­t bá»Ÿi ngÆ°á»i khÃ¡c, vui lÃ²ng táº£i láº¡i');
        err.status = 409;
        err.code = 'FULFILLMENT_STATUS_CONFLICT';
        throw err;
      }

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
