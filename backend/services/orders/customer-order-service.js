import crypto from 'node:crypto';
import { isPayOSConfigured } from '../payos.js';
import { validateOrderCreationInput, buildPublicLookupDto } from '../public-dto.js';
import { evaluateOrderTransition } from '../order-transition-policy.js';
import { buildPageInfo } from '../cursor-pagination.js';
import { batchLoadPostgresOrderDetails } from '../order-batch-loader.js';
import { hashOrderRequest } from '../order-idempotency.js';
import { OrderDomainError } from './order-errors.js';
import defaultOrdersRepository from '../../repositories/postgres/orders.js';
import { createOnlinePayOSOrder as defaultCreateOnlinePayOSOrder } from '../online-payos-order.js';
import defaultPaymentsRepository from '../../repositories/postgres/payments.js';
import { reconcilePayOSOrder } from '../payos-reconciliation.js';

export function createCustomerOrderService({
  repository = defaultOrdersRepository,
  createPayOSOrder = defaultCreateOnlinePayOSOrder,
  checkPayOSConfigured = isPayOSConfigured,
  batchLoader = batchLoadPostgresOrderDetails,
  paymentsRepository = defaultPaymentsRepository,
} = {}) {
  return {
    async create({ input, userId = null, idempotencyKey = '' }) {
      const inputValidation = validateOrderCreationInput(input);
      if (!inputValidation.valid) {
        throw new OrderDomainError(inputValidation.error, { status: 400, code: 'ORDER_VALIDATION_ERROR', expose: true });
      }

      const normalizedSource = input.source || 'online';
      const normalizedOrderType = input.order_type || 'Take-away';
      const normalizedPaymentMethod = input.payment_method || 'VietQR';
      const isPosOrder = normalizedOrderType === 'POS' || normalizedSource === 'pos';

      if (!input.store_id || !Array.isArray(input.items) || input.items.length === 0) {
        throw new OrderDomainError('Thiếu thông tin đơn hàng bắt buộc (store_id, danh sách món)', { status: 400, code: 'ORDER_REQUIRED_FIELDS', expose: true });
      }

      if (!isPosOrder && (!input.customer_name || !input.customer_phone)) {
        throw new OrderDomainError('Thiếu thông tin đơn hàng bắt buộc (tên, SĐT, danh sách món)', { status: 400, code: 'ORDER_REQUIRED_FIELDS', expose: true });
      }

      if (normalizedOrderType === 'Delivery' && (!input.delivery_addr || !input.delivery_addr.trim())) {
        throw new OrderDomainError('Đơn hàng Giao tận nơi bắt buộc phải nhập địa chỉ giao hàng', { status: 400, code: 'DELIVERY_ADDRESS_REQUIRED', expose: true });
      }

      if (normalizedSource === 'online' && !userId) {
        throw new OrderDomainError('Vui lòng đăng nhập tài khoản trước khi đặt hàng', { status: 401, code: 'CUSTOMER_AUTH_REQUIRED', expose: true });
      }

      let payment_provider = 'cod';
      if (normalizedSource === 'pos') {
        if (normalizedPaymentMethod === 'VietQR') {
          payment_provider = 'manual_vietqr';
        } else if (normalizedPaymentMethod === 'COD') {
          payment_provider = 'cod';
        } else {
          payment_provider = normalizedPaymentMethod.toLowerCase();
        }
      } else {
        if (normalizedPaymentMethod === 'VietQR') {
          if (checkPayOSConfigured()) {
            payment_provider = 'payos';
          } else {
            throw new OrderDomainError('Cổng thanh toán trực tuyến PayOS chưa được kích hoạt trên hệ thống', { status: 400, code: 'PAYOS_NOT_CONFIGURED', expose: true });
          }
        } else if (normalizedPaymentMethod === 'COD') {
          payment_provider = 'cod';
        } else {
          payment_provider = normalizedPaymentMethod.toLowerCase();
        }
      }

      let rawCancelToken = null;
      let cancelTokenHash = null;
      if (!userId && normalizedSource === 'online') {
        rawCancelToken = crypto.randomBytes(32).toString('hex');
        cancelTokenHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');
      }

      if (normalizedSource === 'online' && normalizedPaymentMethod === 'VietQR') {
        const payosOrder = await createPayOSOrder({
          input,
          userId,
          cancelTokenHash,
          cancelToken: rawCancelToken,
          idempotencyKey,
        });
        return { ...payosOrder, status: 'Đang chuẩn bị' };
      }

      const order = await repository.createPublicOrder({
        input,
        userId,
        cancelTokenHash,
        cancelToken: rawCancelToken,
        idempotencyKey,
        requestHash: hashOrderRequest(input),
        paymentProvider: payment_provider,
      });
      return { ...order, status: 'Đang chuẩn bị' };
    },

    async lookup({ code, tokenUser = null }) {
      if (!code) {
        throw new OrderDomainError('Thiếu mã đơn', { status: 400, code: 'ORDER_LOOKUP_EMPTY', expose: true });
      }
      const order = await repository.findPublicOrder(code);
      if (!order) {
        throw new OrderDomainError('Không tìm thấy đơn hàng', { status: 404, code: 'ORDER_NOT_FOUND', expose: true });
      }

      await reconcilePayOSOrder({ order, paymentRepository: paymentsRepository });
      const refreshedOrder = order.payment_provider === 'payos' && order.payment_status === 'unpaid'
        ? await repository.findPublicOrder(code)
        : order;
      const mappedItems = await repository.loadPublicDetails(refreshedOrder.id);
      const history = await repository.loadStatusHistory(order.id);
      const safeOrder = buildPublicLookupDto(refreshedOrder, tokenUser, mappedItems, history);
      return { order: safeOrder };
    },

    async cancel({ identifier, userId = null, cancelToken = '', reason }) {
      const result = await repository.cancelCustomerOrder({
        identifier,
        userId,
        cancelToken,
        reason,
        evaluateTransition: evaluateOrderTransition,
      });
      return { ...result, message: 'Đã hủy đơn hàng thành công' };
    },

    async listCustomerHistory({ userId, limit, cursor = null, paginated = false }) {
      const rows = await repository.listCustomerOrders({ userId, limit, cursor });
      const { rows: pagedOrders, page_info } = buildPageInfo({ rows, limit });
      await batchLoader(pagedOrders);
      if (paginated) {
        return { orders: pagedOrders, page_info };
      }
      return pagedOrders;
    },
  };
}

export const customerOrderService = createCustomerOrderService();
export default customerOrderService;
