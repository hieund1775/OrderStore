import crypto from 'node:crypto';
import { isPayOSConfigured, createPaymentLinkForOrder } from '../payos.js';
import { validateOrderCreationInput, buildPublicLookupDto } from '../public-dto.js';
import { evaluateOrderTransition } from '../order-transition-policy.js';
import { buildPageInfo } from '../cursor-pagination.js';
import { batchLoadPostgresOrderDetails } from '../order-batch-loader.js';
import { hashOrderRequest, claimOrderIdempotency, completeOrderIdempotency } from '../order-idempotency.js';
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

let customResolvePaymentProfileForTest = null;
export function setResolvePaymentProfileForTest(resolver = null) {
  customResolvePaymentProfileForTest = resolver;
}

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

function buildSingleIndustryPaymentSummary({ order, rootCategoryId, rootCategoryName, items = [] }) {
  const subtotal = Number(order.subtotal || 0);
  const discountAmount = Number(order.discount_amount || 0);
  const shippingFee = Number(order.shipping_fee || 0);
  const totalAmount = Number(order.total || 0);

  return {
    is_grouped: false,
    group_code: null,
    subtotal,
    discount_amount: discountAmount,
    shipping_fee: shippingFee,
    total_amount: totalAmount,
    industries: [
      {
        root_category_id: rootCategoryId ? String(rootCategoryId) : null,
        root_category_name: rootCategoryName || 'Chưa phân loại',
        order_id: String(order.id || ''),
        order_code: order.order_code || '',
        subtotal,
        discount_amount: discountAmount,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        status: order.current_status || order.status || 'Đang chuẩn bị',
        payment_status: order.payment_status || 'unpaid',
        items: items.map((it) => ({
          product_id: String(it.product_id || it.id || ''),
          product_name: it.product_name || it.name || '',
          quantity: Number(it.quantity || it.qty || 1),
          unit_price: Number(it.unit_price || it.price || 0),
          line_total: Number(it.line_total != null ? it.line_total : (Number(it.unit_price || it.price || 0) * Number(it.quantity || it.qty || 1))),
        })),
      },
    ],
  };
}

/**
 * Shared, fail-closed DB line subtotal calculation.
 * Never falls back to client-provided prices on error.
 */
async function calculateDbLineSubtotal(items, tx) {
  let subtotal = 0;
  for (const item of items) {
    const qty = Number(item.qty || 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      throw new OrderDomainError('Số lượng phải từ 1 đến 50', { status: 400, code: 'INVALID_QUANTITY', expose: true });
    }

    const [products] = await tx.query(
      `SELECT p.id, p.name, p.price, p.category_id,
              COALESCE(
                p.fulfillment_lane,
                (
                  WITH RECURSIVE ancestors AS (
                    SELECT c.id, c.parent_id, c.depth, c.default_fulfillment_lane
                    FROM categories c WHERE c.id = p.category_id
                    UNION ALL
                    SELECT parent.id, parent.parent_id, parent.depth, parent.default_fulfillment_lane
                    FROM categories parent
                    JOIN ancestors child ON child.parent_id = parent.id
                  )
                  SELECT default_fulfillment_lane FROM ancestors
                  WHERE default_fulfillment_lane IS NOT NULL
                  ORDER BY depth DESC LIMIT 1
                )
              ) AS fulfillment_lane
       FROM products p
       WHERE p.id = $1 AND p.is_available = TRUE AND p.status = 'active'`,
      [item.product_id],
    );
    if (!products || !products[0]) {
      throw new OrderDomainError('Sản phẩm không tồn tại hoặc đã ngừng bán', { status: 400, code: 'PRODUCT_UNAVAILABLE', expose: true });
    }

    if (item.variant_id != null) {
      const [variants] = await tx.query(
        'SELECT id, sku, price, is_active FROM product_variants WHERE id = $1 AND product_id = $2',
        [item.variant_id, item.product_id],
      );
      if (!variants || !variants[0] || variants[0].is_active === false) {
        throw new OrderDomainError('Biến thể sản phẩm không hợp lệ hoặc đã ngừng bán', { status: 400, code: 'VARIANT_UNAVAILABLE', expose: true });
      }
    }

    let sizeExtra = 0;
    if (item.size_id != null) {
      const [sizes] = await tx.query('SELECT label, price_extra FROM size_options WHERE id = $1', [item.size_id]);
      if (!sizes || !sizes[0]) {
        throw new OrderDomainError('Size không hợp lệ', { status: 400, code: 'SIZE_INVALID', expose: true });
      }
      sizeExtra = Number(sizes[0].price_extra || 0);
    }

    const rawToppings = item.topping_ids || (Array.isArray(item.toppings) ? item.toppings.map((t) => (typeof t === 'object' && t !== null ? t.topping_id : t)) : []);
    const toppingIds = [...new Set(rawToppings.map(Number).filter(Number.isInteger))];
    let toppingTotal = 0;
    if (toppingIds.length) {
      const [toppings] = await tx.query('SELECT id, name, price FROM toppings WHERE id = ANY($1::bigint[]) AND is_available = TRUE', [toppingIds]);
      if (!toppings || toppings.length !== toppingIds.length) {
        throw new OrderDomainError('Topping không hợp lệ hoặc đã ngừng bán', { status: 400, code: 'TOPPING_INVALID', expose: true });
      }
      toppingTotal = toppings.reduce((sum, top) => sum + Number(top.price || 0), 0);
    }

    const unitPrice = Number(products[0].price) + sizeExtra;
    const lineTotal = (unitPrice + toppingTotal) * qty;
    subtotal += lineTotal;
  }
  return subtotal;
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

      // 1. Resolve Root Categories & Payment Profile for cart (propagating controlled 5xx if database fails)
      const effectiveResolver = customResolvePaymentProfileForTest || resolvePaymentProfile;
      const resolved = await effectiveResolver({
        storeId: input.store_id,
        items: input.items,
        paymentMethod: normalizedPaymentMethod,
        database,
      });

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
        const groupScope = userId
          ? `online-group:user:${userId}`
          : `online-group:guest:${rawCancelToken ? crypto.createHash('sha256').update(rawCancelToken).digest('hex') : input.customer_phone}`;
        const groupRequestHash = hashOrderRequest(input);

        // Execute entire multi-industry order creation and allocation in ONE atomic transaction
        const txnResult = await database.transaction(async (tx) => {
          // Idempotency check at Group level
          if (idempotencyKey && tx && typeof tx.query === 'function') {
            try {
              const idempotency = await claimOrderIdempotency(tx, {
                key: idempotencyKey,
                scope: groupScope,
                requestHash: groupRequestHash,
              });
              if (idempotency.replay) {
                return { replay: true, response: idempotency.response };
              }
            } catch (err) {
              if (err.status) throw err;
            }
          }

          // 1. Calculate true DB-derived subtotal per root group (fail-closed, never trusting client price)
          const rootGroupsWithSubtotal = [];
          for (const g of resolved.rootGroups) {
            let dbSubtotal;
            if (tx && typeof tx.query === 'function') {
              dbSubtotal = await calculateDbLineSubtotal(g.items, tx);
            } else {
              dbSubtotal = g.items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 1)), 0);
            }
            rootGroupsWithSubtotal.push({
              ...g,
              subtotal: dbSubtotal,
            });
          }

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
              originalPaymentProfile: alloc.originalPaymentProfile,
              groupAllocatedAmount: alloc.allocatedTotal,
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
              originalPaymentProfile: alloc.originalPaymentProfile,
            });
          }

          // Financial Invariant Verification Check
          const sumChildSubtotal = createdChildOrders.reduce((sum, co) => sum + Number(co.subtotal || 0), 0);
          const sumChildDiscount = createdChildOrders.reduce((sum, co) => sum + Number(co.discount_amount || 0), 0);
          const sumChildTotal = createdChildOrders.reduce((sum, co) => sum + Number(co.total || 0), 0);

          if (
            sumChildSubtotal !== allocationPlan.subtotal ||
            sumChildDiscount !== allocationPlan.discountAmount ||
            sumChildTotal !== allocationPlan.totalAmount
          ) {
            throw new OrderDomainError('Lỗi kiểm tra toàn vẹn tài chính: Tổng tiền các đơn con không khớp tổng đơn gộp', { status: 500 });
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

          const paymentSummary = {
            is_grouped: true,
            group_code: createdGroup.group_code,
            subtotal: Number(createdGroup.subtotal || allocationPlan.subtotal),
            discount_amount: Number(createdGroup.discount_amount || allocationPlan.discountAmount),
            shipping_fee: Number(createdGroup.shipping_fee || allocationPlan.shippingFee || 0),
            total_amount: Number(createdGroup.total_amount || allocationPlan.totalAmount),
            industries: allocationPlan.allocations.map((alloc, idx) => {
              const co = createdChildOrders[idx] || {};
              return {
                root_category_id: alloc.rootCategoryId ? String(alloc.rootCategoryId) : null,
                root_category_name: alloc.rootCategoryName || 'Chưa phân loại',
                order_id: String(co.id || ''),
                order_code: co.order_code || '',
                subtotal: Number(co.subtotal ?? alloc.allocatedSubtotal),
                discount_amount: Number(co.discount_amount ?? alloc.allocatedDiscount),
                shipping_fee: Number(alloc.allocatedShippingFee || 0),
                total_amount: Number(co.total ?? alloc.allocatedTotal),
                status: co.status || 'Đang chuẩn bị',
                payment_status: co.payment_status || 'unpaid',
                items: (alloc.items || []).map((it) => ({
                  product_id: String(it.product_id || it.id || ''),
                  product_name: it.product_name || it.name || '',
                  quantity: Number(it.quantity || it.qty || 1),
                  unit_price: Number(it.price || it.unit_price || 0),
                  line_total: Number((it.price || it.unit_price || 0) * (it.quantity || it.qty || 1)),
                })),
              };
            }),
          };

          const baseResponse = {
            ok: true,
            is_grouped: true,
            group_code: createdGroup.group_code,
            total_amount: Number(createdGroup.total_amount),
            child_orders: createdChildOrders,
            status: 'Đang chuẩn bị',
            payment_summary: paymentSummary,
          };

          return {
            replay: false,
            group: createdGroup,
            childOrders: createdChildOrders,
            reservedPayOS: reserved,
            baseResponse,
          };
        });

        // If replay: verify if PayOS link is attached and usable (C2)
        if (txnResult.replay) {
          const replayResp = txnResult.response;
          if (normalizedSource === 'online' && normalizedPaymentMethod === 'VietQR') {
            if (!replayResp.checkout_url && replayResp.group_code) {
              const refreshed = await checkoutGroupsRepo.renewGroupPayOSLink({
                groupCode: replayResp.group_code,
                userId,
                cancelToken: rawCancelToken,
              });
              const updatedReplay = {
                ...replayResp,
                replay: true,
                checkout_url: refreshed.payment_checkout_url,
                qr_code: refreshed.payment_qr_code,
                payment_link_id: refreshed.payment_link_id,
                payos_order_code: refreshed.payos_order_code,
                payment_expires_at: refreshed.payment_expires_at,
              };

              if (idempotencyKey && database && typeof database.transaction === 'function') {
                try {
                  await database.transaction(async (tx) => {
                    await completeOrderIdempotency(tx, {
                      key: idempotencyKey,
                      responseStatus: 201,
                      response: updatedReplay,
                    });
                  });
                } catch {}
              }

              return updatedReplay;
            }
          }
          return { ...replayResp, replay: true };
        }

        const { group, childOrders, reservedPayOS, baseResponse } = txnResult;

        if (normalizedSource === 'online' && normalizedPaymentMethod === 'VietQR' && reservedPayOS) {
          const effectiveReturnUrl = buildSafePayOSRedirectUrl(input.return_url, config.payos.returnUrl, group.group_code);
          const effectiveCancelUrl = buildSafePayOSRedirectUrl(input.cancel_url, config.payos.cancelUrl, group.group_code);

          try {
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

            const finalResponse = {
              ...baseResponse,
              checkout_url: link.checkoutUrl,
              qr_code: link.qrCode,
              payment_link_id: attached?.payment_link_id || link.paymentLinkId,
              payos_order_code: attached?.payos_order_code || reservedPayOS.payos_order_code,
              payment_expires_at: attached?.payment_expires_at || reservedPayOS.payment_expires_at,
            };

            // Store complete response in idempotency record
            if (idempotencyKey && database && typeof database.transaction === 'function') {
              try {
                await database.transaction(async (tx) => {
                  await completeOrderIdempotency(tx, {
                    key: idempotencyKey,
                    responseStatus: 201,
                    response: finalResponse,
                  });
                });
              } catch {}
            }

            return finalResponse;
          } catch (payosErr) {
            // Failure link: mark idempotency completed with baseResponse so key is resumable and not stuck in_progress (C2)
            if (idempotencyKey && database && typeof database.transaction === 'function') {
              try {
                await database.transaction(async (tx) => {
                  await completeOrderIdempotency(tx, {
                    key: idempotencyKey,
                    responseStatus: 201,
                    response: baseResponse,
                  });
                });
              } catch {}
            }

            throw new OrderDomainError(
              `Không thể khởi tạo liên kết thanh toán PayOS cho đơn ${group.group_code}. Vui lòng thử lại.`,
              { status: 502, code: 'PAYOS_LINK_CREATION_FAILED', expose: true, groupCode: group.group_code },
            );
          }
        }

        // Store base response in idempotency record for non-VietQR orders
        if (idempotencyKey && database && typeof database.transaction === 'function') {
          try {
            await database.transaction(async (tx) => {
              await completeOrderIdempotency(tx, {
                key: idempotencyKey,
                responseStatus: 201,
                response: baseResponse,
              });
            });
          } catch {}
        }

        return baseResponse;
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
        const paymentSummary = buildSingleIndustryPaymentSummary({
          order: payosOrder,
          rootCategoryId,
          rootCategoryName: resolved.rootCategory?.rootCategoryName || 'Chưa phân loại',
          items: input.items,
        });
        return { ...payosOrder, status: 'Đang chuẩn bị', payment_summary: paymentSummary };
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
      const paymentSummary = buildSingleIndustryPaymentSummary({
        order,
        rootCategoryId,
        rootCategoryName: resolved.rootCategory?.rootCategoryName || 'Chưa phân loại',
        items: input.items,
      });
      return { ...order, status: 'Đang chuẩn bị', payment_summary: paymentSummary };
    },

    async lookup({ code, tokenUser = null, cancelToken = '' }) {
      if (!code) {
        throw new OrderDomainError('Thiếu mã đơn', { status: 400, code: 'ORDER_LOOKUP_EMPTY', expose: true });
      }

      // Support looking up Group by Group Code with STRICT ownership verification
      if (code.startsWith('GRP')) {
        const userId = tokenUser ? Number(tokenUser.id || tokenUser.sub) : null;
        const group = await checkoutGroupsRepo.findGroupForCustomerLookup(code, {
          userId,
          cancelToken: (cancelToken || '').trim() || null,
        });
        if (!group) {
          throw new OrderDomainError('Không tìm thấy đơn hàng gộp', { status: 404, code: 'ORDER_NOT_FOUND', expose: true });
        }
        return { group };
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
