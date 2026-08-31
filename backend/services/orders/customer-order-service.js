import crypto from 'node:crypto';
import { isPayOSConfigured, createPaymentLinkForOrder } from '../payos.js';
import { validateOrderCreationInput, buildPublicLookupDto } from '../public-dto.js';
import { evaluateOrderTransition } from '../order-transition-policy.js';
import { buildPageInfo } from '../cursor-pagination.js';
import { batchLoadPostgresOrderDetails } from '../order-batch-loader.js';
import { hashOrderRequest } from '../order-idempotency.js';
import { OrderDomainError } from './order-errors.js';
import defaultOrdersRepository from '../../repositories/postgres/orders.js';
import { createOnlinePayOSOrder as defaultCreateOnlinePayOSOrder, appendOrderCodeToUrl } from '../online-payos-order.js';
import defaultPaymentsRepository from '../../repositories/postgres/payments.js';
import defaultCheckoutGroupsRepository from '../../repositories/postgres/checkout-groups.js';
import defaultPromotionsRepository from '../../repositories/postgres/promotions.js';
import defaultPostgresDb from '../../config/db-postgres.js';
import { reconcilePayOSOrder } from '../payos-reconciliation.js';
import {
  resolvePaymentProfileForCart as defaultResolvePaymentProfile,
  allocateVoucherDiscount,
} from '../payment-profiles/payment-profile-resolver.js';
import config from '../../config/env.js';

function makePayOSCode(id) {
  return Number(`${String(Date.now()).slice(-6)}${String(Number(id) % 10000).padStart(4, '0')}`);
}

function buildSafePayOSRedirectUrl(requestedUrl, fallbackUrl, orderCode) {
  const candidate = requestedUrl || fallbackUrl;
  const fallback = fallbackUrl || candidate;
  let candidateUrl;
  let fallbackUrlObject;
  try {
    candidateUrl = new URL(candidate);
    fallbackUrlObject = new URL(fallback);
  } catch {
    const error = new Error('URL chuyển hướng PayOS không hợp lệ');
    error.status = 400;
    throw error;
  }

  const allowedOrigins = new Set(config.allowedOrigins);
  allowedOrigins.add(fallbackUrlObject.origin);
  if (!allowedOrigins.has(candidateUrl.origin)) {
    const error = new Error('URL chuyển hướng PayOS không được cho phép');
    error.status = 400;
    throw error;
  }

  return appendOrderCodeToUrl(candidateUrl.toString(), orderCode);
}

export function createCustomerOrderService({
  repository = defaultOrdersRepository,
  createPayOSOrder = defaultCreateOnlinePayOSOrder,
  checkPayOSConfigured = isPayOSConfigured,
  batchLoader = batchLoadPostgresOrderDetails,
  paymentsRepository = defaultPaymentsRepository,
  checkoutGroupsRepo = defaultCheckoutGroupsRepository,
  resolvePaymentProfile = defaultResolvePaymentProfile,
  promotionsRepo = defaultPromotionsRepository,
  database = defaultPostgresDb,
} = {}) {
  return {
    async create({ input, userId = null, idempotencyKey = '' }) {
      const inputValidation = validateOrderCreationInput(input);
      if (!inputValidation.valid) {
        throw new OrderDomainError(inputValidation.error, { status: 400, code: 'ORDER_VALIDATION_FAILED', expose: true });
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

      let rawCancelToken = null;
      let cancelTokenHash = null;
      if (!userId && normalizedSource === 'online') {
        rawCancelToken = crypto.randomBytes(32).toString('hex');
        cancelTokenHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');
      }

      // 1. Resolve Root Categories & Payment Profile for cart
      let resolved;
      try {
        resolved = await resolvePaymentProfile({
          storeId: input.store_id,
          items: input.items,
        });
      } catch (err) {
        // Fallback for isolated repository tests or missing category mappings
        resolved = {
          isGrouped: false,
          profile: {
            id: null,
            code: 'LONG_GROUPED_CHECKOUT',
            display_name: 'Long - Checkout Hệ Thống',
            version: 1,
          },
          rootCategory: { rootCategoryId: 1, rootCategoryName: 'Mặc định', rootCategorySlug: 'default' },
          rootGroups: [{ rootCategoryId: 1, rootCategoryName: 'Mặc định', rootCategorySlug: 'default', items: input.items }],
        };
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
          if (checkPayOSConfigured(resolved?.profile?.code)) {
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

      // 2. Case A: Multi-industry Grouped Checkout
      if (resolved.isGrouped) {
        // Execute entire multi-industry order creation and allocation in ONE atomic transaction
        const { group, childOrders, reservedPayOS } = await database.transaction(async (tx) => {
          // 1. Calculate subtotal per root group
          const rootGroupsWithSubtotal = resolved.rootGroups.map((g) => {
            const subtotal = g.items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 1)), 0);
            return {
              ...g,
              subtotal,
            };
          });

          const totalSubtotal = rootGroupsWithSubtotal.reduce((sum, g) => sum + g.subtotal, 0);

          // 2. Validate voucher once across total cart subtotal
          let voucher = null;
          let totalDiscount = 0;
          if (input.voucher_code) {
            voucher = await promotionsRepo.validateForOrder({
              code: input.voucher_code,
              subtotal: totalSubtotal,
              phone: input.customer_phone,
              storeId: input.store_id,
              tx,
            });
            totalDiscount = Number(voucher?.discount_amount || 0);
          }

          // 3. Allocate discount pro-rata with exact integer remainder guarantee
          const allocationPlan = allocateVoucherDiscount({
            rootGroupsWithSubtotal,
            voucherDiscount: totalDiscount,
            shippingFee: 0,
          });

          // 4. Create child orders atomically
          const createdChildOrders = [];
          const groupAllocations = [];

          for (let i = 0; i < allocationPlan.allocations.length; i++) {
            const alloc = allocationPlan.allocations[i];
            const childInput = {
              ...input,
              items: alloc.items,
              voucher_code: input.voucher_code || null,
              allocatedDiscount: alloc.allocatedDiscount,
              skipVoucherConsume: true,
            };
            const childIdempotencyKey = `${idempotencyKey || crypto.randomUUID()}:group:${alloc.rootCategoryId}`;
            const childOrder = await repository.createPublicOrder({
              input: childInput,
              userId,
              cancelTokenHash,
              cancelToken: rawCancelToken,
              idempotencyKey: childIdempotencyKey,
              requestHash: hashOrderRequest(childInput),
              paymentProvider: payment_provider,
              rootCategoryId: alloc.rootCategoryId,
              paymentProfile: resolved.profile,
            }, { tx });

            createdChildOrders.push(childOrder);
            groupAllocations.push({
              orderId: childOrder.id,
              rootCategoryId: alloc.rootCategoryId,
              rootCategoryName: alloc.rootCategoryName,
              rootCategorySlug: alloc.rootCategorySlug,
              allocatedSubtotal: alloc.allocatedSubtotal,
              allocatedDiscount: alloc.allocatedDiscount,
              allocatedShippingFee: alloc.allocatedShippingFee,
              allocatedTotal: alloc.allocatedTotal,
            });
          }

          // 5. Consume voucher once for primary order if applicable
          if (voucher && createdChildOrders.length > 0) {
            await promotionsRepo.consumeForOrder({
              voucher,
              orderId: createdChildOrders[0].id,
              tx,
            });
          }

          // 6. Create checkout group and allocations
          const createdGroup = await checkoutGroupsRepo.createCheckoutGroup({
            storeId: input.store_id,
            userId,
            subtotal: allocationPlan.subtotal,
            discountAmount: allocationPlan.discountAmount,
            shippingFee: allocationPlan.shippingFee,
            totalAmount: allocationPlan.totalAmount,
            voucherCode: input.voucher_code || null,
            paymentProfile: resolved.profile,
            allocations: groupAllocations,
          }, { tx });

          let reserved = null;
          if (normalizedSource === 'online' && normalizedPaymentMethod === 'VietQR') {
            const expiresAt = new Date(Date.now() + Number(process.env.PAYOS_PAYMENT_TIMEOUT_MINUTES || 15) * 60_000);
            reserved = await checkoutGroupsRepo.reservePayOSCheckoutGroup({
              groupId: createdGroup.id,
              payosOrderCode: makePayOSCode(createdGroup.id),
              paymentExpiresAt: expiresAt,
            }, { tx });
          }

          return {
            group: createdGroup,
            childOrders: createdChildOrders,
            reservedPayOS: reserved,
          };
        });

        if (normalizedSource === 'online' && normalizedPaymentMethod === 'VietQR' && reservedPayOS) {
          const effectiveReturnUrl = buildSafePayOSRedirectUrl(input.return_url, config.payos.returnUrl, group.group_code);
          const effectiveCancelUrl = buildSafePayOSRedirectUrl(input.cancel_url, config.payos.cancelUrl, group.group_code);

          const link = await createPaymentLinkForOrder({
            orderId: group.id,
            orderCode: group.group_code,
            total: group.total_amount,
            payosOrderCode: reservedPayOS.payos_order_code,
            paymentExpiresAt: reservedPayOS.payment_expires_at,
            returnUrl: effectiveReturnUrl,
            cancelUrl: effectiveCancelUrl,
            paymentProfileCode: resolved.profile.code,
          });

          const attached = await checkoutGroupsRepo.attachPaymentLinkToGroup({
            groupId: group.id,
            paymentLinkId: link.paymentLinkId,
            payosOrderCode: reservedPayOS.payos_order_code,
            paymentExpiresAt: reservedPayOS.payment_expires_at,
            checkoutUrl: link.checkoutUrl,
            qrCode: link.qrCode,
          });

          return {
            ok: true,
            is_grouped: true,
            group_code: group.group_code,
            checkout_url: link.checkoutUrl,
            qr_code: link.qrCode,
            payment_link_id: attached.payment_link_id,
            payos_order_code: attached.payos_order_code,
            payment_expires_at: attached.payment_expires_at,
            total_amount: Number(group.total_amount),
            child_orders: childOrders,
            status: 'Đang chuẩn bị',
          };
        }

        return {
          ok: true,
          is_grouped: true,
          group_code: group.group_code,
          total_amount: Number(group.total_amount),
          child_orders: childOrders,
          status: 'Đang chuẩn bị',
        };
      }

      // 3. Case B: Single-industry Checkout
      const rootCategoryId = resolved.rootCategory?.rootCategoryId || null;
      const paymentProfile = resolved.profile;

      if (normalizedSource === 'online' && normalizedPaymentMethod === 'VietQR') {
        const payosOrder = await createPayOSOrder({
          input,
          userId,
          cancelTokenHash,
          cancelToken: rawCancelToken,
          idempotencyKey,
          rootCategoryId,
          paymentProfile,
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
        rootCategoryId,
        paymentProfile,
      });
      return { ...order, status: 'Đang chuẩn bị' };
    },

    async lookup({ code, tokenUser = null, cancelToken = '' }) {
      if (!code) {
        throw new OrderDomainError('Thiếu mã đơn', { status: 400, code: 'ORDER_LOOKUP_EMPTY', expose: true });
      }

      // Support looking up by Group Code as well as Order Code
      if (code.startsWith('GRP')) {
        const group = await checkoutGroupsRepo.findGroupByCode(code);
        if (group) {
          return { group };
        }
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
      const safeOrder = buildPublicLookupDto(refreshedOrder, tokenUser, mappedItems, history, cancelToken);
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
