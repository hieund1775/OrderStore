import fs from 'fs';
import path from 'path';
import yaml from '../node_modules/yaml/index.js';
import { schemas, securitySchemes, commonParameters, routes } from './openapi-base.mjs';

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'TeaPlus Order & Store Management API',
    version: '1.0.0',
    description: `Toàn bộ HTTP API routes cho hệ thống TeaPlus — Tiệm Trà Vườn Xanh, bao gồm luồng đặt hàng online, gọi món tại quầy (POS), đặt bàn & cọc tiệc trước (Preorder), màn hình bếp (KDS), khu vực đóng gói (Packing lane), cổng thanh toán PayOS / VietQR đa ngành hàng (Grouped Checkout), đối soát thanh toán (Reconciliation) và quản trị vận hành.`
  },
  servers: [
    {
      url: '{base_url}',
      description: 'Dynamic Base URL (Production / Staging / Test)',
      variables: {
        base_url: {
          default: 'https://teaplus-order-backend.onrender.com',
          description: 'Production or Staging backend URL'
        }
      }
    },
    {
      url: 'http://localhost:5000',
      description: 'Local Node.js Development Server'
    }
  ],
  tags: [
    { name: 'Health', description: 'System health, liveness, readiness, and runtime build metadata probes' },
    { name: 'Auth', description: 'Customer & staff authentication, OTP verification, password reset, and session identity' },
    { name: 'Payments', description: 'Universal payment status, QR regeneration, PayOS gateway integration & sandbox' },
    { name: 'Payment Profiles', description: 'Multi-industry merchant profile configurations & root category key bindings' },
    { name: 'Group Checkout', description: 'Multi-industry checkout aggregation, split order generation, and unified payment links' },
    { name: 'VietQR', description: 'VietQR payment code generation, polling status, and QR renewal' },
    { name: 'Webhooks', description: 'Asynchronous payment settlement callbacks from PayOS' },
    { name: 'Reconciliation', description: 'Automated & manual payment reconciliation, transaction dispute resolution, and settlement audits' },
    { name: 'Orders', description: 'Customer order creation, guest lookup, status tracking, and cancellation' },
    { name: 'Preorders', description: 'Preorder reservations, table slot availability, deposit checkout, and customer check-in' },
    { name: 'Admin', description: 'Internal store management, staff privileges, operations, and auditing' },
    { name: 'POS', description: 'In-store point of sale counter orders with branch-scoped cashier execution' },
    { name: 'Kitchen (KDS)', description: 'Real-time kitchen display system queues and order line task status' },
    { name: 'Fulfillment', description: 'Dual-lane fulfillment tasks (Kitchen & Packing lanes) and shipper handovers' },
    { name: 'Catalog', description: 'Multi-level categories, dynamic attributes, variants, presets, and public menu display' },
    { name: 'Inventory', description: 'Ingredient tracking, SKU variant stock levels, adjustments, and branch-specific offers' },
    { name: 'Stores & Tables', description: 'Physical store branches, dining tables, and table-side QR security tokens' },
    { name: 'Promotions & Vouchers', description: 'Discount campaigns, voucher validation, and order settlement discounts' },
    { name: 'Reviews', description: 'Customer product reviews, media attachments, admin moderation, and public display' },
    { name: 'Recruitment', description: 'Career openings and candidate application lifecycle management' },
    { name: 'Customers & Engagement', description: 'Customer loyalty tiers, points reward redemptions, wishlists, and notifications' },
    { name: 'Reports & Dashboard', description: 'Real-time business performance KPIs, revenue distribution, and operational metrics' },
    { name: 'Admin Settings', description: 'Staff accounts, role assignments, invitation onboarding, and system audit logs' },
    { name: 'Admin Notifications', description: 'Staff incident notifications, system alerts, and broadcasts' }
  ],
  paths: {},
  components: {
    schemas,
    securitySchemes,
    parameters: commonParameters
  }
};

// Helper to convert Express path to OpenAPI path
function toOpenApiPath(p) {
  return p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
}

// Helper to format path param
function makePathParam(name) {
  let description = `Identifier: ${name}`;
  let schema = { type: 'string' };

  if (name === 'id' || name === 'productId' || name === 'reviewId' || name === 'notificationId' || name === 'variant_id' || name === 'storeId' || name === 'attributeId' || name === 'targetId' || name === 'rootId' || name === 'orderItemId') {
    schema = { type: 'integer' };
  }
  if (name === 'storeId') description = 'Branch store ID';
  if (name === 'variant_id') description = 'Product variant SKU ID';
  if (name === 'slug') description = 'Unique SEO URL slug';
  if (name === 'code' || name === 'orderCode') {
    schema = { type: 'string' };
    description = 'Public unique order or preorder code (e.g. TP-1024, PO-20260925-01, or GRP...)';
  }
  if (name === 'targetType') {
    schema = { type: 'string', enum: ['category', 'product'] };
    description = 'Preset target type entity';
  }

  return {
    name,
    in: 'path',
    required: true,
    description,
    schema
  };
}

// Generate an operation definition for each route
function buildOperation(route) {
  const method = route.method.toUpperCase();
  const rawPath = route.path;
  const oPath = toOpenApiPath(rawPath);
  const middlewares = route.middlewares || [];

  const pathParamNames = (rawPath.match(/:[a-zA-Z0-9_]+/g) || []).map(m => m.slice(1));
  const parameters = pathParamNames.map(makePathParam);

  let tags = [];
  let summary = '';
  let description = '';
  let requestBody = null;
  let responses = {
    '200': {
      description: 'Operation successful',
      content: { 'application/json': { schema: { type: 'object' } } }
    },
    '400': {
      description: 'Validation or business rule error',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
    },
    '500': {
      description: 'Internal server or database error',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
    }
  };

  const isSecured = middlewares.some(m => ['authenticate', 'requireRole', 'requireCustomerSelf', 'requireCustomerWishlistOwner', 'requireCustomerNotificationOwner', 'requireSuperAdmin', 'customerOnly'].includes(m)) ||
    (rawPath.startsWith('/admin') && rawPath !== '/admin/login');

  const security = isSecured ? [{ BearerAuth: [] }] : undefined;

  if (isSecured) {
    responses['401'] = {
      description: 'Authentication token missing, invalid, or expired',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
    };
    if (middlewares.some(m => ['requireRole', 'requireSuperAdmin', 'customerOnly'].includes(m)) || rawPath.startsWith('/admin')) {
      responses['403'] = {
        description: 'Forbidden: Insufficient privileges or store scope boundary exceeded',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
      };
    }
  }

  // --- HEALTH & META ---
  if (rawPath === '/live') {
    tags = ['Health'];
    summary = 'Liveness Probe';
    description = 'Kubernetes / Render liveness probe verifying event loop responsiveness without database dependency.';
    responses['200'] = { description: 'Process alive', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } } } };
  } else if (rawPath === '/health' || rawPath === '/api/health') {
    tags = ['Health'];
    summary = 'Root Health Check';
    description = 'Reports API runtime status, service name, server timestamp, and uptime.';
    responses['200'] = { description: 'API operational', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } } } };
  } else if (rawPath === '/ready') {
    tags = ['Health'];
    summary = 'Readiness Probe';
    description = 'Readiness probe verifying PostgreSQL connection pool health with a 3-second timeout.';
    responses['200'] = { description: 'Database connected and service ready', content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessStatus' } } } };
    responses['503'] = { description: 'Database connection failed or timed out', content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessStatus' } } } };
  } else if (rawPath === '/api/runtime-build') {
    tags = ['Health'];
    summary = 'Runtime Build Marker';
    description = 'Returns active server build marker and contract versions.';
    responses['200'] = { description: 'Build metadata', content: { 'application/json': { schema: { $ref: '#/components/schemas/RuntimeBuild' } } } };
  } else if (rawPath === '/api-docs.json') {
    tags = ['Health'];
    summary = 'OpenAPI JSON Spec';
    description = 'Raw OpenAPI JSON specification for developer inspection.';

  // --- AUTH ---
  } else if (rawPath === '/admin/login') {
    tags = ['Auth', 'Admin'];
    summary = 'Staff / Admin Login';
    description = 'Authenticates store staff (super, manager, cashier, kitchen, packing) using username or phone number.';
    requestBody = {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminLoginInput' } } }
    };
    responses['200'] = {
      description: 'Login successful, returns JWT bearer token and staff profile',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'Staff JWT bearer token' },
              user: { $ref: '#/components/schemas/StaffProfile' }
            }
          }
        }
      }
    };
  } else if (rawPath === '/admin/me') {
    tags = ['Auth', 'Admin'];
    summary = 'Staff Identity Check';
    description = 'Retrieves current authenticated staff profile and store branch association.';
    responses['200'] = { content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/StaffProfile' } } } } } };
  } else if (rawPath === '/api/auth/register') {
    tags = ['Auth'];
    summary = 'Customer Registration';
    description = 'Registers a new customer account using verified phone number and password.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerRegisterInput' } } } };
    responses['201'] = { description: 'Customer registered successfully', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/CustomerProfile' } } } } } };
  } else if (rawPath === '/api/auth/login') {
    tags = ['Auth'];
    summary = 'Customer Login';
    description = 'Authenticates customer using phone number and password.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthLoginInput' } } } };
    responses['200'] = { description: 'Customer authenticated', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/CustomerProfile' } } } } } };
  } else if (rawPath === '/api/auth/send-otp') {
    tags = ['Auth'];
    summary = 'Send Phone OTP';
    description = 'Dispatches 6-digit SMS OTP to target phone number for customer onboarding or verification.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SendOtpInput' } } } };
  } else if (rawPath === '/api/auth/verify-otp') {
    tags = ['Auth'];
    summary = 'Verify Phone OTP';
    description = 'Validates customer phone OTP for registration or profile modification.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyOtpInput' } } } };
  } else if (rawPath === '/api/auth/google') {
    tags = ['Auth'];
    summary = 'Google Sign-In';
    description = 'Authenticates or links customer account via Google OAuth ID token.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GoogleAuthInput' } } } };
    responses['200'] = { content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/CustomerProfile' } } } } } };
  } else if (rawPath === '/api/auth/forgot-password/verify-phone') {
    tags = ['Auth'];
    summary = 'Verify Phone for Password Reset';
    description = 'Checks if customer phone number is registered before triggering reset OTP.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordVerifyPhoneInput' } } } };
  } else if (rawPath === '/api/auth/forgot-password/send-otp') {
    tags = ['Auth'];
    summary = 'Send Password Reset OTP';
    description = 'Dispatches OTP code specifically for forgot-password verification.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordSendOtpInput' } } } };
  } else if (rawPath === '/api/auth/forgot-password/reset') {
    tags = ['Auth'];
    summary = 'Reset Password via OTP';
    description = 'Resets account password upon confirming valid OTP code.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordResetInput' } } } };
  } else if (rawPath === '/api/auth/profile/send-email-otp') {
    tags = ['Auth'];
    summary = 'Send Email Verification OTP';
    description = 'Sends email verification OTP to update customer profile email.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SendEmailOtpInput' } } } };
  } else if (rawPath === '/api/auth/profile/verify-email') {
    tags = ['Auth'];
    summary = 'Verify Customer Email';
    description = 'Verifies OTP sent to email and binds email address to customer profile.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyEmailInput' } } } };
  } else if (rawPath === '/api/auth/staff-invitation/accept') {
    tags = ['Auth', 'Admin'];
    summary = 'Accept Staff Invitation';
    description = 'Allows invited staff members to complete onboarding, set their password, and activate account.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StaffInvitationAcceptInput' } } } };
  } else if (rawPath === '/api/auth/me') {
    tags = ['Auth'];
    summary = 'Customer Profile Identity';
    description = 'Returns active customer profile details, tier level, points balance, and preferences.';
    responses['200'] = { content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/CustomerProfile' } } } } } };

  // --- PAYMENTS & PAYOS & GROUP CHECKOUT & RECONCILIATION ---
  } else if (rawPath === '/api/payments/payos/webhook') {
    tags = ['Webhooks', 'Payments'];
    summary = 'PayOS Webhook Callback';
    description = `Nhận webhook thanh toán tự động từ PayOS.
Bypass rate limiter chung, xác thực chữ ký số HMAC-SHA256 checksum_key theo từng Payment Profile tương ứng với ngành hàng.
Hỗ trợ cả đơn lẻ và đơn nhóm đa ngành (Grouped Checkout).
Trả HTTP 200 { ok: true } khi thành công/trùng lặp; trả HTTP 500 khi lỗi hạ tầng để PayOS retry.`;
    requestBody = {
      required: true,
      description: 'Payload webhook chứa dữ liệu giao dịch và chữ ký kiểm tra',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/PayOSWebhookPayload' } } }
    };
    responses['200'] = { description: 'Webhook acknowledged or processed', content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookResult' } } } };
  } else if (rawPath === '/api/payments/status' || rawPath === '/api/payments/payos/status') {
    tags = ['Payments', 'Group Checkout', 'Reconciliation', 'VietQR'];
    summary = 'Universal Payment Status & Reconciliation';
    description = `Tra cứu trạng thái thanh toán theo mã đơn hàng hoặc mã nhóm GRP...
Tự động đối soát trực tiếp với PayOS (reconcilePayOSOrder / reconcilePayOSCheckoutGroup) nếu đơn đang ở trạng thái unpaid/expired.
Hỗ trợ guest customer với header x-cancel-token hoặc query cancel_token.`;
    parameters.push(
      { name: 'code', in: 'query', required: true, description: 'Order code (e.g. TP-1024) or Grouped checkout code (e.g. GRP260920XYZ)', schema: { type: 'string' } },
      { name: 'cancel_token', in: 'query', required: false, description: 'Guest cancel token for unauthenticated lookup', schema: { type: 'string' } },
      { $ref: '#/components/parameters/CancelTokenHeader' }
    );
    responses['200'] = { description: 'Current payment status', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentStatusResult' } } } };
    responses['404'] = { description: 'Order or grouped checkout not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } };
  } else if (rawPath === '/api/payments/regenerate' || rawPath === '/api/payments/payos/regenerate-qr') {
    tags = ['Payments', 'Group Checkout', 'VietQR'];
    summary = 'Regenerate Payment QR & Link';
    description = `Tạo lại liên kết thanh toán PayOS / VietQR mới khi liên kết cũ hết hạn hoặc bị hủy.
Hỗ trợ cả đơn lẻ (order_code) và đơn nhóm (GRP...). Cập nhật payment_expires_at mới.`;
    parameters.push({ $ref: '#/components/parameters/CancelTokenHeader' });
    requestBody = {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentRegenerateInput' } } }
    };
    responses['200'] = { description: 'New payment link & QR generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentRegenerateResult' } } } };
  } else if (rawPath === '/api/payments/sandbox/session') {
    tags = ['Payments'];
    summary = 'Sandbox Payment Session Lookup';
    description = 'Lấy thông tin phiên thanh toán trong chế độ Sandbox (dành cho môi trường test/staging).';
    parameters.push({ name: 'token', in: 'query', required: true, description: 'Sandbox payment session token', schema: { type: 'string' } });
  } else if (rawPath === '/api/payments/sandbox/transfer') {
    tags = ['Payments'];
    summary = 'Sandbox Exact Amount Transfer';
    description = 'Mô phỏng chuyển khoản chính xác trong môi trường Sandbox không cần tiền thật.';
    requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              token: { type: 'string', example: 'sbx_tok_123' },
              amount: { type: 'number', example: 50000 }
            },
            required: ['token', 'amount']
          }
        }
      }
    };
  } else if (rawPath === '/api/payments/payos/simulate-success') {
    tags = ['Payments'];
    summary = 'Simulate Payment Success (Disabled)';
    description = 'Endpoint thử nghiệm trước đây, hiện đã bị vô hiệu hóa hoàn toàn trên hệ thống (trả 404).';
    responses['404'] = { description: 'Endpoint disabled' };

  // --- PAYMENT PROFILES ---
  } else if (rawPath === '/admin/payment-profiles') {
    tags = ['Payment Profiles', 'Admin'];
    if (method === 'GET') {
      summary = 'List Payment Profiles';
      description = 'Super Admin only: Danh sách cấu hình tài khoản thanh toán PayOS theo từng ngành hàng hoặc fallback (số tài khoản đã được mask bảo mật).';
      parameters.push({ name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['active', 'inactive'] } });
      responses['200'] = { content: { 'application/json': { schema: { type: 'object', properties: { profiles: { type: 'array', items: { $ref: '#/components/schemas/PaymentProfile' } } } } } } };
    } else if (method === 'POST') {
      summary = 'Create Payment Profile';
      description = 'Super Admin only: Tạo mới profile thanh toán gắn với mục đích (industry, grouped_checkout, fallback). Khóa bí mật cấu hình qua biến môi trường.';
      requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePaymentProfileInput' } } } };
      responses['201'] = { content: { 'application/json': { schema: { type: 'object', properties: { profile: { $ref: '#/components/schemas/PaymentProfile' } } } } } };
    }
  } else if (rawPath === '/admin/payment-profiles/:id') {
    tags = ['Payment Profiles', 'Admin'];
    if (method === 'GET') {
      summary = 'Get Payment Profile Detail';
      description = 'Super Admin only: Xem thông tin chi tiết một payment profile.';
      responses['200'] = { content: { 'application/json': { schema: { type: 'object', properties: { profile: { $ref: '#/components/schemas/PaymentProfile' } } } } } };
    } else if (method === 'PUT') {
      summary = 'Update Payment Profile';
      description = 'Super Admin only: Cập nhật tên hiển thị, mục đích (purpose) hoặc trạng thái profile.';
      requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePaymentProfileInput' } } } };
      responses['200'] = { content: { 'application/json': { schema: { type: 'object', properties: { profile: { $ref: '#/components/schemas/PaymentProfile' } } } } } };
    }
  } else if (rawPath === '/admin/payment-profiles/:id/assign-root') {
    tags = ['Payment Profiles', 'Admin'];
    summary = 'Assign Profile to Root Category';
    description = 'Super Admin only: Gán ngành hàng gốc (root category) vào tài khoản PayOS tương ứng để nhận tiền.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignRootCategoryInput' } } } };
  } else if (rawPath === '/admin/payment-profiles/assign-root/:rootId') {
    tags = ['Payment Profiles', 'Admin'];
    summary = 'Unassign Profile from Root Category';
    description = 'Super Admin only: Hủy liên kết giữa ngành hàng gốc và tài khoản thanh toán.';

  // --- ORDERS (PUBLIC) ---
  } else if (rawPath === '/api/orders') {
    tags = ['Orders', 'Group Checkout'];
    summary = 'Create Customer Order';
    description = `Tạo đơn hàng mới cho khách (Giao tận nơi, Mang về, Ăn tại quán, hoặc Quét QR tại bàn).
Nếu giỏ hàng chứa sản phẩm từ nhiều ngành hàng khác nhau có cấu hình PayOS riêng, hệ thống tự động sinh Grouped Checkout (mã GRP...) với liên kết thanh toán gộp PayOS.
Hỗ trợ Idempotency-Key để chống đặt trùng lặp khi mạng chập chờn.`;
    parameters.push({ $ref: '#/components/parameters/IdempotencyKey' });
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrderInput' } } } };
    responses['201'] = {
      description: 'Order created successfully (or replayed on duplicate idempotency key)',
      content: { 'application/json': { schema: { type: 'object' } } }
    };
  } else if (rawPath === '/api/orders/lookup' || rawPath === '/api/orders/track') {
    tags = ['Orders'];
    summary = 'Lookup Order by Code';
    description = 'Tra cứu hành trình và trạng thái đơn hàng theo mã đơn (ví dụ TP-1024). Thông tin số điện thoại/tên được mask bảo vệ quyền riêng tư nếu không có cancel token.';
    parameters.push(
      { name: 'code', in: 'query', required: true, description: 'Order code (e.g. TP-1024)', schema: { type: 'string' } },
      { name: 'cancel_token', in: 'query', required: false, description: 'Guest cancel token', schema: { type: 'string' } },
      { $ref: '#/components/parameters/CancelTokenHeader' }
    );
    responses['200'] = { content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicOrderLookup' } } } };
  } else if (rawPath === '/api/orders/cancel' || rawPath === '/api/orders/:id/cancel') {
    tags = ['Orders'];
    summary = 'Customer Cancel Order';
    description = 'Khách hàng hủy đơn khi đơn còn ở trạng thái Chờ xác nhận hoặc Chưa thanh toán.';
    parameters.push({ $ref: '#/components/parameters/CancelTokenHeader' });
    requestBody = { content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderCancelInput' } } } };

  // --- ADMIN ORDERS & RECONCILIATION & POS ---
  } else if (rawPath === '/admin/orders') {
    tags = ['Orders', 'Admin'];
    summary = 'List Store Orders';
    description = 'Quản lý danh sách đơn hàng có phân quyền theo chi nhánh, hỗ trợ lọc theo trạng thái, khoảng thời gian, tìm kiếm và phân trang con trỏ (cursor pagination).';
    parameters.push(
      { name: 'status', in: 'query', schema: { type: 'string', enum: ['Chờ xác nhận', 'Đang chuẩn bị', 'Đã chuẩn bị xong', 'Đang giao', 'Hoàn thành', 'Đã hủy'] } },
      { name: 'store_id', in: 'query', schema: { type: 'integer' } },
      { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'search', in: 'query', schema: { type: 'string' } },
      { name: 'cursor', in: 'query', schema: { type: 'string' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
    );
    responses['200'] = { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AdminOrderListItem' } } } } };
  } else if (rawPath === '/admin/orders/:id') {
    tags = ['Orders', 'Admin'];
    summary = 'Get Order Details';
    description = 'Lấy chi tiết toàn diện đơn hàng: snapshot món, công thức tùy chọn, thông tin shipper, lịch sử chuyển trạng thái và thông tin thanh toán.';
    responses['200'] = { content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOrderDetail' } } } };
  } else if (rawPath === '/admin/orders/:id/status') {
    tags = ['Orders', 'Admin'];
    summary = 'Update Order Status';
    description = 'Cập nhật trạng thái quy trình đơn hàng (Chờ xác nhận -> Đang chuẩn bị -> Đã chuẩn bị xong -> Đang giao -> Hoàn thành / Đã hủy). Tự động gắn nhiệm vụ fulfillment và ghi nhật ký kiểm toán.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderStatusUpdateInput' } } } };
  } else if (rawPath === '/admin/orders/:id/cancel') {
    tags = ['Orders', 'Admin'];
    summary = 'Admin Cancel Order';
    description = 'Nhân viên quản lý hủy đơn hàng kèm lý do hủy bắt buộc.';
    requestBody = { required: true, content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string', example: 'Hết nguyên liệu pha chế' } }, required: ['reason'] } } } };
  } else if (rawPath === '/admin/orders/:id/payment/confirm') {
    tags = ['Reconciliation', 'Admin', 'Orders'];
    summary = 'Manual Payment Confirmation & Reconciliation';
    description = 'Super / Manager / Cashier: Xác nhận thu tiền thủ công đối với đơn thanh toán tiền mặt (COD) hoặc đối soát khi khách chuyển khoản trực tiếp ngoài luồng PayOS.';
    responses['200'] = { description: 'Payment marked as paid', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, payment_status: { type: 'string', example: 'paid' } } } } } };
  } else if (rawPath === '/admin/orders/:id/print') {
    tags = ['Orders', 'Admin'];
    summary = 'Mark Order Receipt Printed';
    description = 'Đánh dấu đơn hàng đã được in phiếu thanh toán/bill order ra máy in nhiệt tại quầy.';
  } else if (rawPath === '/admin/pos/orders') {
    tags = ['POS', 'Admin', 'Orders'];
    summary = 'Create POS Counter Order';
    description = 'Tạo đơn gọi món tại quầy thanh toán tiền mặt (POS COD). Server tự động gán chi nhánh theo tài khoản thu ngân đang đăng nhập.';
    parameters.push({ $ref: '#/components/parameters/IdempotencyKey' });
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PosOrderInput' } } } };
    responses['201'] = { content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOrderDetail' } } } };

  // --- PREORDERS ---
  } else if (rawPath === '/api/preorders/stores') {
    tags = ['Preorders'];
    summary = 'List Preorder Available Stores';
    description = 'Danh sách các chi nhánh có kích hoạt tính năng đặt bàn và nhận đơn đặt trước.';
  } else if (rawPath === '/api/preorders/availability') {
    tags = ['Preorders'];
    summary = 'Check Preorder Availability';
    description = 'Tra cứu khung giờ còn chỗ trong ngày tại chi nhánh đã chọn.';
    parameters.push(
      { name: 'store_id', in: 'query', required: true, schema: { type: 'integer' } },
      { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
    );
  } else if (rawPath === '/api/preorders/tables') {
    tags = ['Preorders'];
    summary = 'List Preorder Available Tables';
    description = 'Danh sách bàn trống phù hợp với số lượng khách (người lớn & trẻ em) trong khung giờ chỉ định.';
    parameters.push(
      { name: 'store_id', in: 'query', required: true, schema: { type: 'integer' } },
      { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
      { name: 'time_slot', in: 'query', required: true, schema: { type: 'string' } }
    );
  } else if (rawPath === '/api/preorders/checkout') {
    tags = ['Preorders', 'Payments', 'VietQR'];
    summary = 'Preorder Reservation & Deposit Checkout';
    description = 'Khách đặt bàn trước và thanh toán tiền cọc tiệc thông qua PayOS / VietQR.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PreorderCheckoutInput' } } } };
    responses['201'] = { content: { 'application/json': { schema: { $ref: '#/components/schemas/PreorderDetail' } } } };
  } else if (rawPath === '/api/preorders/mine') {
    tags = ['Preorders'];
    summary = 'List My Preorders';
    description = 'Danh sách tất cả các đơn đặt bàn/đặt tiệc trước của khách hàng đang đăng nhập.';
  } else if (rawPath === '/api/preorders/:code') {
    tags = ['Preorders'];
    summary = 'Get Preorder Details';
    description = 'Chi tiết đơn đặt trước kèm mã QR Check-in.';
  } else if (rawPath === '/api/preorders/:code/check-in') {
    tags = ['Preorders'];
    summary = 'Customer Self Check-In';
    description = 'Khách tự quét mã hoặc bấm check-in khi đã có mặt tại quán trong khung giờ mở cửa.';
  } else if (rawPath === '/api/preorders/:code/check-in-request') {
    tags = ['Preorders'];
    summary = 'Request Staff Check-In Assistance';
    description = 'Khách gửi yêu cầu nhân viên hỗ trợ check-in bàn.';
  } else if (rawPath === '/api/preorders/:code/cancel') {
    tags = ['Preorders'];
    summary = 'Cancel Preorder Reservation';
    description = 'Khách hủy đơn đặt bàn theo chính sách hoàn cọc của cửa hàng.';
  } else if (rawPath === '/admin/preorders') {
    tags = ['Preorders', 'Admin'];
    summary = 'Admin List Preorders';
    description = 'Quản lý đơn đặt trước theo 5 tab: pending (Chờ xác nhận), check-in (Đang chờ checkin), today (Hôm nay), upcoming (Sắp tới), archive (Lưu trữ).';
    parameters.push(
      { name: 'view', in: 'query', schema: { type: 'string', enum: ['pending', 'check-in', 'today', 'upcoming', 'archive'], default: 'today' } },
      { name: 'store_id', in: 'query', schema: { type: 'integer' } },
      { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } }
    );
  } else if (rawPath === '/admin/preorders/kitchen/confirmed') {
    tags = ['Preorders', 'Admin', 'Kitchen (KDS)'];
    summary = 'Confirmed Preorders Queue for Kitchen';
    description = 'Hàng đợi các đơn đặt trước đã thanh toán cọc và được xác nhận để bếp chuẩn bị trước món.';
  } else if (rawPath === '/admin/preorders/:id/confirm') {
    tags = ['Preorders', 'Admin'];
    summary = 'Confirm Preorder Reservation';
    description = 'Quản lý chi nhánh duyệt xác nhận đơn đặt bàn sau khi nhận đủ tiền cọc.';
  } else if (rawPath === '/admin/preorders/:id/handover') {
    tags = ['Preorders', 'Admin'];
    summary = 'Handover Preorder Table';
    description = 'Nhân viên bàn giao bàn và món cho khách đặt trước.';
  } else if (rawPath === '/admin/preorders/:id/reschedule') {
    tags = ['Preorders', 'Admin'];
    summary = 'Reschedule Preorder Date/Time';
    description = 'Đổi ngày hoặc giờ hẹn bàn theo yêu cầu của khách hàng.';
    requestBody = { required: true, content: { 'application/json': { schema: { type: 'object', properties: { new_date: { type: 'string' }, new_time_slot: { type: 'string' }, reason: { type: 'string' } }, required: ['new_date', 'new_time_slot'] } } } };
  } else if (rawPath === '/admin/preorders/:id/check-in') {
    tags = ['Preorders', 'Admin'];
    summary = 'Admin Confirm Customer Check-In';
    description = 'Nhân viên quét mã hoặc xác nhận khách đã vào bàn thành công.';
  } else if (rawPath === '/admin/preorders/:id/check-in/reject') {
    tags = ['Preorders', 'Admin'];
    summary = 'Admin Reject Check-In';
    description = 'Từ chối check-in nếu sai thông tin hoặc bàn chưa sẵn sàng.';
  } else if (rawPath === '/admin/preorders/settings') {
    tags = ['Preorders', 'Admin'];
    summary = 'Get Preorder Global Settings';
    description = 'Super Admin: Xem cấu hình đặt bàn, thời gian giữ chỗ và tỷ lệ cọc.';
  } else if (rawPath === '/admin/preorders/settings/:storeId') {
    tags = ['Preorders', 'Admin'];
    summary = 'Update Store Preorder Settings';
    description = 'Super Admin: Cập nhật cấu hình đặt bàn cho từng chi nhánh.';
  } else if (rawPath === '/admin/preorders/incidents/list') {
    tags = ['Preorders', 'Admin'];
    summary = 'List Preorder Incidents';
    description = 'Danh sách các sự cố vận hành đặt bàn (quá giờ, hủy cọc, khiếu nại).';
  } else if (rawPath === '/admin/preorders/managers/:id/preorder-strikes/reset') {
    tags = ['Preorders', 'Admin'];
    summary = 'Reset Manager Preorder Strikes';
    description = 'Super Admin: Xóa điểm vi phạm vận hành cho quản lý chi nhánh.';

  // --- KITCHEN (KDS) & FULFILLMENT ---
  } else if (rawPath === '/admin/kitchen/orders') {
    tags = ['Kitchen (KDS)', 'Admin'];
    summary = 'Kitchen Display System (KDS) Queue';
    description = 'Màn hình hiển thị đơn hàng thời gian thực cho quầy pha chế / bếp. Chỉ hiển thị các món thuộc làn bếp (không hiển thị đơn hủy hoặc hoàn thành).';
    parameters.push({ name: 'store_id', in: 'query', schema: { type: 'integer' } });
  } else if (rawPath === '/admin/fulfillment/tasks') {
    tags = ['Fulfillment', 'Admin'];
    summary = 'List Fulfillment Tasks';
    description = 'Quản lý nhiệm vụ pha chế / đóng gói chia theo 2 luồng độc lập: Bếp (Kitchen lane) và Khu vực đóng gói (Packing lane). Trạng thái: chờ làm | shipper | hoàn thành.';
    parameters.push(
      { name: 'branch_id', in: 'query', schema: { type: 'integer' } },
      { name: 'lane', in: 'query', schema: { type: 'string', enum: ['kitchen', 'packing'] } },
      { name: 'status', in: 'query', schema: { type: 'string' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
    );
  } else if (rawPath === '/admin/fulfillment/tasks/:id') {
    tags = ['Fulfillment', 'Admin'];
    summary = 'Get Fulfillment Task Detail';
    description = 'Xem chi tiết một nhiệm vụ phân tách của đơn hàng.';
    responses['200'] = { content: { 'application/json': { schema: { type: 'object', properties: { task: { $ref: '#/components/schemas/FulfillmentTask' } } } } } };
  } else if (rawPath === '/admin/fulfillment/tasks/:id/status') {
    tags = ['Fulfillment', 'Admin'];
    summary = 'Update Fulfillment Task Status';
    description = 'Chuyển trạng thái nhiệm vụ: pending -> preparing -> ready -> completed.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateFulfillmentTaskInput' } } } };
  } else if (rawPath === '/admin/fulfillment/orders/:id/handover') {
    tags = ['Fulfillment', 'Admin'];
    summary = 'Handover Order to Delivery Shipper';
    description = 'Bàn giao các phần đóng gói hoàn thiện cho tài xế giao hàng, cập nhật tên shipper và link tracking.';
    requestBody = {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              driver_name: { type: 'string', example: 'Nguyễn Văn Shipper' },
              driver_phone: { type: 'string', example: '0909123456' },
              tracking_url: { type: 'string', example: 'https://tracking.teaplus.vn/ship/123' },
              note: { type: 'string' }
            }
          }
        }
      }
    };
  } else if (rawPath === '/admin/branches/:storeId/capabilities') {
    tags = ['Fulfillment', 'Stores & Tables', 'Admin'];
    if (method === 'GET') {
      summary = 'Get Branch Fulfillment Capabilities';
      description = 'Xem trạng thái kích hoạt làn Bếp và làn Đóng gói độc lập của chi nhánh.';
      responses['200'] = { content: { 'application/json': { schema: { $ref: '#/components/schemas/BranchCapabilities' } } } };
    } else if (method === 'PUT') {
      summary = 'Update Branch Fulfillment Capabilities';
      description = 'Super Admin: Bật/tắt các làn vận hành bếp hoặc đóng gói tại chi nhánh.';
      requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BranchCapabilities' } } } };
    }

  // --- CATALOG V2 & MENU ---
  } else if (rawPath === '/catalog/categories/tree' || rawPath === '/api/catalog/categories/tree') {
    tags = ['Catalog'];
    summary = 'Category Tree Hierarchy';
    description = 'Cây danh mục đa cấp phục vụ hiển thị menu website, bao gồm số lượng món và luồng vận hành mặc định (kitchen / packing).';
    responses['200'] = { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CategoryTreeItem' } } } } };
  } else if (rawPath === '/catalog/sections' || rawPath === '/api/catalog/sections') {
    tags = ['Catalog'];
    summary = 'Catalog Sections';
    description = 'Danh sách các khu vực thực đơn trang chủ phân loại theo danh mục gốc.';
  } else if (rawPath === '/catalog/products' || rawPath === '/api/catalog/products') {
    tags = ['Catalog'];
    summary = 'Catalog Products List';
    description = 'Danh sách sản phẩm Catalog V2 có hỗ trợ phân trang, lọc theo danh mục con và sắp xếp.';
    parameters.push(
      { name: 'category_id', in: 'query', schema: { type: 'integer' } },
      { name: 'sort', in: 'query', schema: { type: 'string' } },
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
    );
    responses['200'] = { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ProductV2' } } } } };
  } else if (rawPath === '/catalog/products/:slug' || rawPath === '/api/catalog/products/:slug') {
    tags = ['Catalog'];
    summary = 'Catalog Product Details by Slug';
    description = 'Chi tiết sản phẩm, danh sách biến thể SKU khả dụng và ma trận thuộc tính tùy chọn (size, đường, đá...).';
    responses['200'] = { content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductV2' } } } };
  } else if (rawPath === '/catalog/resolve-configuration' || rawPath === '/api/catalog/resolve-configuration') {
    tags = ['Catalog'];
    summary = 'Resolve SKU Variant from Options';
    description = 'Tìm kiếm SKU biến thể chính xác dựa trên tổ hợp thuộc tính khách chọn.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResolveConfigurationInput' } } } };
  } else if (rawPath === '/api/products') {
    tags = ['Catalog'];
    summary = 'Legacy Products List';
    description = 'Endpoint danh sách sản phẩm tương thích ngược.';
  } else if (rawPath === '/api/products/:slug') {
    tags = ['Catalog'];
    summary = 'Legacy Product Details';
    description = 'Chi tiết sản phẩm theo slug tương thích ngược.';
  } else if (rawPath === '/api/categories') {
    tags = ['Catalog'];
    summary = 'Legacy Categories List';
    description = 'Danh mục món tương thích ngược.';
  } else if (rawPath.startsWith('/api/options/')) {
    tags = ['Catalog'];
    summary = 'Legacy Product Options';
    description = `Lấy danh sách tùy chọn món: ${rawPath.split('/').pop()}`;
  } else if (rawPath === '/api/search/suggestions') {
    tags = ['Catalog'];
    summary = 'Search Suggestions';
    description = 'Gợi ý tìm kiếm món tức thì khi người dùng gõ từ khóa.';
    parameters.push({ name: 'q', in: 'query', required: true, schema: { type: 'string' } });

  // --- ADMIN CATALOG V2 ---
  } else if (rawPath.startsWith('/admin/catalog')) {
    tags = ['Catalog', 'Admin'];
    summary = `Admin Catalog: ${method} ${rawPath.replace('/admin/catalog', '')}`;
    description = `Quản trị Catalog V2: thuộc tính, biến thể SKU, loại sản phẩm và phân loại đa ngành.`;
  } else if (rawPath.startsWith('/admin/menu')) {
    tags = ['Catalog', 'Admin'];
    summary = `Admin Legacy Menu: ${method} ${rawPath.replace('/admin/menu', '')}`;
    description = 'Quản trị thực đơn món, nhóm topping và đế trà truyền thống.';

  // --- INVENTORY & BRANCH OFFERS ---
  } else if (rawPath.startsWith('/admin/branch-offers')) {
    tags = ['Inventory', 'Admin'];
    summary = `Branch Offers: ${method} ${rawPath.replace('/admin/branch-offers', '') || 'root'}`;
    description = 'Quản lý bật/tắt tạm ẩn sản phẩm hoặc áp giá riêng theo từng chi nhánh.';
  } else if (rawPath.startsWith('/admin/variant-inventory')) {
    tags = ['Inventory', 'Admin'];
    summary = `Variant Inventory: ${method} ${rawPath.replace('/admin/variant-inventory', '') || 'root'}`;
    description = 'Quản lý tồn kho theo từng biến thể SKU sản phẩm, ghi nhận nhập xuất kho.';
  } else if (rawPath.startsWith('/admin/inventory')) {
    tags = ['Inventory', 'Admin'];
    summary = `Raw Material Inventory: ${method} ${rawPath.replace('/admin/inventory', '') || 'root'}`;
    description = 'Quản lý nguyên vật liệu pha chế, công thức định lượng (BOM) và cảnh báo thiếu hàng.';

  // --- STORES & TABLES ---
  } else if (rawPath === '/api/stores') {
    tags = ['Stores & Tables'];
    summary = 'List Public Branches';
    description = 'Danh sách các chi nhánh TeaPlus mở cửa phục vụ khách hàng.';
    responses['200'] = { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Store' } } } } };
  } else if (rawPath === '/api/stores/districts') {
    tags = ['Stores & Tables'];
    summary = 'List Available Districts';
    description = 'Danh sách các quận huyện có cửa hàng.';
  } else if (rawPath === '/api/table/resolve') {
    tags = ['Stores & Tables'];
    summary = 'Resolve Dining Table from QR Token';
    description = 'Giải mã mã QR tại bàn để xác thực bàn hợp lệ và trả về thông tin chi nhánh.';
    parameters.push({ name: 'token', in: 'query', required: true, schema: { type: 'string' } });
    responses['200'] = { content: { 'application/json': { schema: { $ref: '#/components/schemas/DiningTable' } } } };
  } else if (rawPath.startsWith('/admin/branches')) {
    tags = ['Stores & Tables', 'Admin'];
    summary = `Admin Branches: ${method} ${rawPath.replace('/admin/branches', '') || 'root'}`;
    description = 'Quản trị danh sách chi nhánh cửa hàng TeaPlus.';
  } else if (rawPath.startsWith('/admin/tables')) {
    tags = ['Stores & Tables', 'Admin'];
    summary = `Admin Tables: ${method} ${rawPath.replace('/admin/tables', '') || 'root'}`;
    description = 'Quản lý danh sách bàn ăn, in mã QR và xoay mã QR bàn chống gian lận.';

  // --- PROMOTIONS & VOUCHERS ---
  } else if (rawPath === '/api/promotions') {
    tags = ['Promotions & Vouchers'];
    summary = 'List Active Promotions';
    description = 'Danh sách các chương trình khuyến mãi và mã giảm giá đang hoạt động.';
    responses['200'] = { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Promotion' } } } } };
  } else if (rawPath === '/api/vouchers/apply') {
    tags = ['Promotions & Vouchers'];
    summary = 'Apply Voucher to Order';
    description = 'Áp dụng mã giảm giá để tính toán số tiền khấu trừ trước khi thanh toán.';
    requestBody = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ApplyVoucherInput' } } } };
  } else if (rawPath.startsWith('/admin/promotions')) {
    tags = ['Promotions & Vouchers', 'Admin'];
    summary = `Admin Promotions: ${method} ${rawPath.replace('/admin/promotions', '') || 'root'}`;
    description = 'Tạo mới, chỉnh sửa hoặc vô hiệu hóa các mã khuyến mãi, voucher giảm giá.';

  // --- REVIEWS ---
  } else if (rawPath.startsWith('/api/reviews') || rawPath.startsWith('/api/review-media') || rawPath.includes('review')) {
    tags = ['Reviews'];
    if (rawPath.startsWith('/admin')) tags.push('Admin');
    summary = `Reviews: ${method} ${rawPath}`;
    description = 'Hệ thống đánh giá sản phẩm, đăng ảnh review và phản hồi từ quản trị viên.';

  // --- RECRUITMENT ---
  } else if (rawPath.startsWith('/api/jobs') || rawPath.startsWith('/admin/job')) {
    tags = ['Recruitment'];
    if (rawPath.startsWith('/admin')) tags.push('Admin');
    summary = `Recruitment: ${method} ${rawPath}`;
    description = 'Tin tuyển dụng và hồ sơ ứng tuyển ứng viên.';

  // --- CUSTOMERS & ENGAGEMENT ---
  } else if (rawPath.startsWith('/api/users') || rawPath.startsWith('/api/rewards') || rawPath.startsWith('/api/tiers') || rawPath.startsWith('/admin/customers')) {
    tags = ['Customers & Engagement'];
    if (rawPath.startsWith('/admin')) tags.push('Admin');
    summary = `Customer Engagement: ${method} ${rawPath}`;
    description = 'Hồ sơ hội viên, tích điểm đổi quà, danh sách yêu thích và thông báo.';

  // --- REPORTS & DASHBOARD ---
  } else if (rawPath.startsWith('/admin/dashboard') || rawPath.startsWith('/admin/reports')) {
    tags = ['Reports & Dashboard', 'Admin'];
    summary = `Dashboard & Reports: ${rawPath.replace('/admin/', '')}`;
    description = 'Báo cáo doanh thu, KPI kinh doanh, món bán chạy và cảnh báo vận hành khẩn cấp.';

  // --- ADMIN SETTINGS ---
  } else if (rawPath.startsWith('/admin/settings')) {
    tags = ['Admin Settings', 'Admin'];
    summary = `Admin Settings: ${method} ${rawPath.replace('/admin/settings/', '')}`;
    description = 'Quản lý tài khoản nhân viên, phân quyền và lịch sử kiểm toán audit log.';

  // --- ADMIN NOTIFICATIONS ---
  } else if (rawPath.startsWith('/admin/notifications')) {
    tags = ['Admin Notifications', 'Admin'];
    summary = `Admin Notifications: ${method} ${rawPath.replace('/admin/notifications', '') || 'root'}`;
    description = 'Hệ thống thông báo nội bộ cho nhân viên quầy, bếp và quản lý.';
  } else {
    tags = ['Other'];
    summary = `${method} ${rawPath}`;
    description = `Endpoint: ${method} ${rawPath}`;
  }

  return {
    tags,
    summary,
    description,
    parameters: parameters.length > 0 ? parameters : undefined,
    requestBody: requestBody || undefined,
    responses,
    security
  };
}

// Populate openapi.paths
let totalOperations = 0;
for (const r of routes) {
  const oPath = toOpenApiPath(r.path);
  if (!openapi.paths[oPath]) {
    openapi.paths[oPath] = {};
  }
  const method = r.method.toLowerCase();
  openapi.paths[oPath][method] = buildOperation(r);
  totalOperations++;
}

console.log(`Documented ${totalOperations} operations across ${Object.keys(openapi.paths).length} unique paths.`);

// Convert to YAML
const yamlContent = yaml.stringify(openapi, { indent: 2 });

const outputPath = path.resolve('docs/openapi.yaml');
fs.writeFileSync(outputPath, yamlContent, 'utf8');

console.log(`Successfully generated ${outputPath}`);
console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
