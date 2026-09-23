import fs from 'fs';
import path from 'path';
import yaml from '../node_modules/yaml/index.js';

// Read all 217 extracted routes
const routes = JSON.parse(fs.readFileSync('backend/scripts/routes_clean.json', 'utf8'));

console.log(`Loaded ${routes.length} routes from backend/scripts/routes_clean.json`);

// Define reusable components/schemas
const schemas = {
  HealthStatus: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'ok' },
      message: { type: 'string', example: 'TeaPlus API (PostgreSQL)' },
      uptime: { type: 'integer', example: 3600 },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['status']
  },
  ReadinessStatus: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'ready' },
      database: { type: 'string', example: 'connected' }
    },
    required: ['status']
  },
  RuntimeBuild: {
    type: 'object',
    properties: {
      reviewsContract: { type: 'string', example: 'v1-object' },
      buildMarker: { type: 'string', example: 'reviews-runtime-provenance-20260909' }
    },
    required: ['reviewsContract', 'buildMarker']
  },
  ErrorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', description: 'Error message in Vietnamese or English' },
      code: { type: 'string', description: 'Machine-readable business error code (optional)' }
    },
    required: ['error']
  },
  AuthLoginInput: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '0901234567', description: 'Vietnamese 10-digit mobile phone number' },
      password: { type: 'string', format: 'password', example: 'Password123' }
    },
    required: ['phone', 'password']
  },
  AdminLoginInput: {
    type: 'object',
    properties: {
      username: { type: 'string', example: 'admin', description: 'Staff username or admin identifier' },
      phone: { type: 'string', example: '0901234567', description: 'Staff phone number (alternative login identifier)' },
      password: { type: 'string', format: 'password', example: 'SecurePass123' }
    },
    required: ['password']
  },
  CustomerRegisterInput: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '0901234567' },
      password: { type: 'string', format: 'password', example: 'Password123' },
      fullname: { type: 'string', example: 'Nguyễn Văn A' },
      email: { type: 'string', format: 'email', example: 'nguyenvana@example.com' },
      address: { type: 'string', example: '123 Đường Hoa Lan, Phường 2, Phú Nhuận' }
    },
    required: ['phone', 'password', 'fullname']
  },
  SendOtpInput: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '0901234567' },
      purpose: { type: 'string', example: 'register', enum: ['register', 'forgot_password', 'auth'] }
    },
    required: ['phone']
  },
  VerifyOtpInput: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '0901234567' },
      otp: { type: 'string', example: '123456' },
      purpose: { type: 'string', example: 'register' }
    },
    required: ['phone', 'otp']
  },
  GoogleAuthInput: {
    type: 'object',
    properties: {
      idToken: { type: 'string', description: 'Google Identity OAuth credential / ID token' }
    },
    required: ['idToken']
  },
  ForgotPasswordVerifyPhoneInput: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '0901234567' }
    },
    required: ['phone']
  },
  ForgotPasswordSendOtpInput: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '0901234567' }
    },
    required: ['phone']
  },
  ForgotPasswordResetInput: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '0901234567' },
      otp: { type: 'string', example: '123456' },
      newPassword: { type: 'string', format: 'password', example: 'NewSecret123' }
    },
    required: ['phone', 'otp', 'newPassword']
  },
  SendEmailOtpInput: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email', example: 'customer@example.com' }
    },
    required: ['email']
  },
  VerifyEmailInput: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email', example: 'customer@example.com' },
      otp: { type: 'string', example: '123456' }
    },
    required: ['email', 'otp']
  },
  StaffInvitationAcceptInput: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Onboarding invitation token received via email/admin' },
      password: { type: 'string', format: 'password', example: 'StaffSecure123' },
      fullname: { type: 'string', example: 'Trần Văn Nhân Viên' }
    },
    required: ['token', 'password']
  },
  CustomerProfile: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 101 },
      phone: { type: 'string', example: '0901234567' },
      fullname: { type: 'string', example: 'Nguyễn Văn A' },
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      avatar_url: { type: 'string', nullable: true },
      address: { type: 'string', nullable: true },
      tier: { type: 'string', example: 'Đồng' },
      points: { type: 'integer', example: 120 },
      total_spent: { type: 'number', example: 450000 },
      total_orders: { type: 'integer', example: 6 },
      is_active: { type: 'boolean', example: true },
      created_at: { type: 'string', format: 'date-time' }
    }
  },
  StaffProfile: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      username: { type: 'string', example: 'manager_pn' },
      fullname: { type: 'string', example: 'Quản Lý Chi Nhánh' },
      role: { type: 'string', enum: ['super', 'manager', 'cashier', 'kitchen', 'packing'] },
      branch_id: { type: 'integer', nullable: true, example: 2 },
      branch_name: { type: 'string', nullable: true, example: 'Chi nhánh Phú Nhuận' },
      is_active: { type: 'boolean', example: true }
    }
  },
  CreateOrderItemInput: {
    type: 'object',
    properties: {
      product_id: { type: 'integer', example: 1 },
      variant_id: { type: 'integer', nullable: true, example: 10 },
      quantity: { type: 'integer', minimum: 1, default: 1 },
      unit_price: { type: 'number', example: 35000 },
      size: { type: 'string', example: 'M' },
      sugar: { type: 'string', example: '70%' },
      ice: { type: 'string', example: '50%' },
      toppings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', example: 'Trân châu trắng' },
            price: { type: 'number', example: 8000 }
          }
        }
      }
    },
    required: ['product_id', 'quantity']
  },
  CreateOrderInput: {
    type: 'object',
    properties: {
      source: { type: 'string', enum: ['online', 'pos', 'table_qr'], default: 'online' },
      order_type: { type: 'string', enum: ['Take-away', 'Delivery', 'POS', 'Dine-in'], default: 'Take-away' },
      payment_method: { type: 'string', enum: ['VietQR', 'COD', 'MoMo', 'ZaloPay'], default: 'VietQR' },
      store_id: { type: 'integer', example: 1, description: 'Required for online and POS orders' },
      table_id: { type: 'integer', nullable: true, example: 5 },
      table_token: { type: 'string', description: 'Cryptographic table QR token required when source is table_qr' },
      customer_name: { type: 'string', example: 'Nguyễn Văn A' },
      customer_phone: { type: 'string', example: '0901234567' },
      note: { type: 'string', example: 'Giao trước 12h trưa' },
      delivery_addr: { type: 'string', example: 'Số 10 Mai Thị Lựu, Q1' },
      voucher_code: { type: 'string', example: 'SUMMER2026' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateOrderItemInput' }
      }
    },
    required: ['items']
  },
  PublicOrderLookup: {
    type: 'object',
    properties: {
      order_code: { type: 'string', example: 'TP-1024' },
      order_type: { type: 'string', example: 'Delivery' },
      store_name: { type: 'string', example: 'TeaPlus Flagship Phú Nhuận' },
      location_name: { type: 'string', nullable: true },
      customer_name: { type: 'string', example: 'N***A' },
      customer_phone: { type: 'string', example: '090***4567' },
      delivery_addr: { type: 'string', nullable: true, example: '*** (Đã ẩn địa chỉ)' },
      subtotal: { type: 'number', example: 70000 },
      discount_amount: { type: 'number', example: 10000 },
      total: { type: 'number', example: 60000 },
      payment_method: { type: 'string', example: 'VietQR' },
      payment_provider: { type: 'string', example: 'payos' },
      payment_status: { type: 'string', example: 'unpaid' },
      payment_checkout_url: { type: 'string', nullable: true },
      payment_qr_code: { type: 'string', nullable: true },
      can_resume_payment: { type: 'boolean', example: true },
      can_review: { type: 'boolean', example: false },
      created_at: { type: 'string', format: 'date-time' },
      current_status: { type: 'string', example: 'Chờ xác nhận' },
      shipping_driver_name: { type: 'string', nullable: true },
      shipping_driver_phone: { type: 'string', nullable: true },
      shipping_tracking_url: { type: 'string', nullable: true },
      root_category_id: { type: 'string', nullable: true },
      root_category_name: { type: 'string', nullable: true },
      payment_summary: {
        type: 'object',
        properties: {
          is_grouped: { type: 'boolean' },
          group_code: { type: 'string', nullable: true },
          total_amount: { type: 'number' },
          industries: { type: 'array', items: { type: 'object' } }
        }
      },
      items: { type: 'array', items: { type: 'object' } },
      status_history: { type: 'array', items: { type: 'object' } }
    }
  },
  AdminOrderDetail: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1024 },
      order_code: { type: 'string', example: 'TP-1024' },
      store_id: { type: 'integer', example: 1 },
      user_id: { type: 'integer', nullable: true, example: 52 },
      table_id: { type: 'integer', nullable: true },
      status: { type: 'string', example: 'Đang chuẩn bị' },
      payment_status: { type: 'string', example: 'paid' },
      payment_method: { type: 'string', example: 'VietQR' },
      payment_provider: { type: 'string', example: 'payos' },
      subtotal: { type: 'number', example: 120000 },
      discount_amount: { type: 'number', example: 20000 },
      total: { type: 'number', example: 100000 },
      customer_name: { type: 'string', example: 'Nguyễn Văn A' },
      customer_phone: { type: 'string', example: '0901234567' },
      delivery_addr: { type: 'string', nullable: true },
      note: { type: 'string', nullable: true },
      is_printed: { type: 'boolean', example: true },
      items: { type: 'array', items: { type: 'object' } },
      status_history: { type: 'array', items: { type: 'object' } }
    }
  },
  AdminOrderListItem: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1024 },
      order_code: { type: 'string', example: 'TP-1024' },
      store_id: { type: 'integer', example: 1 },
      store_name: { type: 'string', example: 'Chi nhánh Phú Nhuận' },
      status: { type: 'string', example: 'Đang chuẩn bị' },
      payment_status: { type: 'string', example: 'paid' },
      payment_method: { type: 'string', example: 'VietQR' },
      total: { type: 'number', example: 100000 },
      created_at: { type: 'string', format: 'date-time' }
    }
  },
  OrderStatusUpdateInput: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['Chờ xác nhận', 'Đang chuẩn bị', 'Đã chuẩn bị xong', 'Đang giao', 'Hoàn thành', 'Đã hủy'],
        example: 'Đang chuẩn bị'
      },
      note: { type: 'string', example: 'Đã bổ sung đá riêng theo yêu cầu khách' },
      driver_name: { type: 'string', example: 'Nguyễn Văn Giao Hàng' },
      driver_phone: { type: 'string', example: '0988776655' },
      tracking_url: { type: 'string', example: 'https://tracking.express.vn/ship/12345' }
    },
    required: ['status']
  },
  OrderCancelInput: {
    type: 'object',
    properties: {
      order_code: { type: 'string', example: 'TP-1024' },
      order_id: { type: 'integer', example: 1024 },
      reason: { type: 'string', example: 'Khách đổi ý muốn đặt lại' },
      cancel_token: { type: 'string', description: 'Customer cancel token issued during checkout' }
    }
  },
  PosOrderInput: {
    type: 'object',
    properties: {
      store_id: { type: 'integer', example: 1, description: 'Store branch ID (Super can pick, managers must match their branch)' },
      table_id: { type: 'integer', nullable: true, example: 4 },
      customer_name: { type: 'string', default: 'Khách tại quầy', example: 'Khách tại quầy' },
      customer_phone: { type: 'string', default: '0000000000', example: '0000000000' },
      note: { type: 'string', example: 'Ít ngọt, mang về' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateOrderItemInput' }
      }
    },
    required: ['items']
  },
  PayOSWebhookData: {
    type: 'object',
    properties: {
      orderCode: { type: 'integer', example: 123456 },
      amount: { type: 'integer', example: 55000 },
      description: { type: 'string', example: 'TP1024 TT DON HANG' },
      accountNumber: { type: 'string', example: '102800001234' },
      reference: { type: 'string', example: 'FT2401019999' },
      transactionDateTime: { type: 'string', example: '2026-09-20 10:15:30' },
      paymentLinkId: { type: 'string', example: 'pl_01HXYZ12345' },
      code: { type: 'string', example: '00' },
      desc: { type: 'string', example: 'success' },
      counterAccountBankId: { type: 'string', nullable: true },
      counterAccountBankName: { type: 'string', nullable: true },
      counterAccountName: { type: 'string', nullable: true },
      counterAccountNumber: { type: 'string', nullable: true }
    },
    required: ['orderCode', 'amount', 'description', 'reference']
  },
  PayOSWebhookPayload: {
    type: 'object',
    properties: {
      code: { type: 'string', example: '00' },
      desc: { type: 'string', example: 'success' },
      success: { type: 'boolean', example: true },
      data: { $ref: '#/components/schemas/PayOSWebhookData' },
      signature: { type: 'string', example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
    },
    required: ['data', 'signature']
  },
  WebhookResult: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Thanh toán thành công' },
      ignored: { type: 'boolean', example: false },
      reason: { type: 'string', nullable: true }
    },
    required: ['ok']
  },
  PaymentStatusResult: {
    type: 'object',
    properties: {
      order: {
        type: 'object',
        properties: {
          order_code: { type: 'string', example: 'TP-1024' },
          total: { type: 'number', example: 85000 },
          payment_status: { type: 'string', enum: ['unpaid', 'paid', 'expired', 'failed'], example: 'paid' },
          payment_provider: { type: 'string', example: 'payos' },
          payment_checkout_url: { type: 'string', nullable: true },
          payment_qr_code: { type: 'string', nullable: true },
          payment_expires_at: { type: 'string', format: 'date-time' },
          paid_at: { type: 'string', format: 'date-time', nullable: true },
          can_regenerate_qr: { type: 'boolean', example: false }
        },
        required: ['order_code', 'total', 'payment_status']
      }
    }
  },
  PaymentRegenerateInput: {
    type: 'object',
    properties: {
      order_code: { type: 'string', example: 'TP-1024', description: 'Single order code or grouped checkout code GRP...' },
      code: { type: 'string', example: 'TP-1024', description: 'Alias for order_code' },
      cancel_token: { type: 'string', description: 'Customer cancel token for unauthenticated regeneration' }
    }
  },
  PaymentRegenerateResult: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', example: true },
      order: {
        type: 'object',
        properties: {
          order_code: { type: 'string', example: 'TP-1024' },
          total: { type: 'number', example: 85000 },
          checkout_url: { type: 'string', example: 'https://pay.payos.vn/web/12345' },
          qr_code: { type: 'string', nullable: true },
          payment_expires_at: { type: 'string', format: 'date-time' },
          payment_status: { type: 'string', example: 'unpaid' },
          payment_provider: { type: 'string', example: 'payos' }
        },
        required: ['order_code', 'total', 'checkout_url', 'payment_status']
      }
    },
    required: ['ok', 'order']
  },
  PaymentProfile: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      code: { type: 'string', example: 'BEVERAGE_STORE' },
      display_name: { type: 'string', example: 'Tài khoản Trà & Đồ uống' },
      purpose: { type: 'string', enum: ['industry', 'grouped_checkout', 'fallback'], example: 'industry' },
      status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
      root_category_id: { type: 'integer', nullable: true, example: 3 },
      root_category_name: { type: 'string', nullable: true, example: 'Trà trái cây' },
      env_keys: {
        type: 'object',
        properties: {
          client_id: { type: 'string', example: 'PAYOS_BEVERAGE_CLIENT_ID' },
          api_key: { type: 'string', example: 'PAYOS_BEVERAGE_API_KEY' },
          checksum_key: { type: 'string', example: 'PAYOS_BEVERAGE_CHECKSUM_KEY' }
        }
      },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'code', 'display_name', 'purpose', 'status']
  },
  CreatePaymentProfileInput: {
    type: 'object',
    properties: {
      code: { type: 'string', example: 'SNACK_PROFILE' },
      display_name: { type: 'string', example: 'Tài khoản Đồ ăn vặt' },
      purpose: { type: 'string', enum: ['industry', 'grouped_checkout', 'fallback'], example: 'industry' },
      root_category_id: { type: 'integer', nullable: true, example: 5 }
    },
    required: ['code', 'display_name', 'purpose']
  },
  UpdatePaymentProfileInput: {
    type: 'object',
    properties: {
      display_name: { type: 'string', example: 'Tài khoản Đồ ăn vặt & Bánh' },
      purpose: { type: 'string', enum: ['industry', 'grouped_checkout', 'fallback'] },
      status: { type: 'string', enum: ['active', 'inactive'] }
    }
  },
  AssignRootCategoryInput: {
    type: 'object',
    properties: {
      root_category_id: { type: 'integer', example: 4 }
    },
    required: ['root_category_id']
  },
  PreorderCheckoutInput: {
    type: 'object',
    properties: {
      store_id: { type: 'integer', example: 1 },
      date: { type: 'string', format: 'date', example: '2026-09-25' },
      time_slot: { type: 'string', example: '14:00' },
      adult_count: { type: 'integer', default: 2, example: 2 },
      children_count: { type: 'integer', default: 0, example: 1 },
      table_id: { type: 'integer', nullable: true, example: 6 },
      note: { type: 'string', example: 'Bàn gần cửa sổ' },
      deposit_amount: { type: 'number', example: 100000 },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateOrderItemInput' }
      }
    },
    required: ['store_id', 'date', 'time_slot']
  },
  PreorderDetail: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 201 },
      preorder_code: { type: 'string', example: 'PO-20260925-01' },
      store_id: { type: 'integer', example: 1 },
      store_name: { type: 'string', example: 'TeaPlus Flagship Phú Nhuận' },
      booking_date: { type: 'string', format: 'date', example: '2026-09-25' },
      booking_time: { type: 'string', example: '14:00' },
      guest_count: { type: 'integer', example: 3 },
      deposit_amount: { type: 'number', example: 100000 },
      status: { type: 'string', enum: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled'], example: 'confirmed' },
      payment_status: { type: 'string', example: 'paid' },
      checkin_code: { type: 'string', example: 'CHK-9988' },
      qr_code_url: { type: 'string', nullable: true }
    }
  },
  FulfillmentTask: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 501 },
      order_id: { type: 'integer', example: 1024 },
      branch_id: { type: 'integer', example: 1 },
      lane: { type: 'string', enum: ['kitchen', 'packing'], example: 'kitchen' },
      status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'], example: 'preparing' },
      notes: { type: 'string', nullable: true },
      items: { type: 'array', items: { type: 'object' } },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' }
    }
  },
  UpdateFulfillmentTaskInput: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'], example: 'ready' },
      notes: { type: 'string', example: 'Đã hoàn thiện đóng gói sẵn sàng giao' }
    },
    required: ['status']
  },
  BranchCapabilities: {
    type: 'object',
    properties: {
      kitchen_lane_enabled: { type: 'boolean', example: true },
      packing_lane_enabled: { type: 'boolean', example: true }
    },
    required: ['kitchen_lane_enabled', 'packing_lane_enabled']
  },
  CategoryTreeItem: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Trà Sữa & Trà Trái Cây' },
      slug: { type: 'string', example: 'tra-sua-va-tra-trai-cay' },
      parent_id: { type: 'integer', nullable: true },
      depth: { type: 'integer', example: 0 },
      product_type_id: { type: 'integer', nullable: true, example: 1 },
      default_fulfillment_lane: { type: 'string', enum: ['kitchen', 'packing'], example: 'kitchen' },
      sort_order: { type: 'integer', example: 1 },
      is_visible: { type: 'boolean', example: true },
      products_count: { type: 'integer', example: 24 },
      children: {
        type: 'array',
        items: { $ref: '#/components/schemas/CategoryTreeItem' }
      }
    }
  },
  ProductV2: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 42 },
      category_id: { type: 'integer', example: 3 },
      category_name: { type: 'string', example: 'Trà Trái Cây Tươi' },
      category_slug: { type: 'string', example: 'tra-trai-cay-tuoi' },
      name: { type: 'string', example: 'Trà Đào Cam Sả' },
      slug: { type: 'string', example: 'tra-dao-cam-sa' },
      description: { type: 'string', example: 'Vị đào thanh ngọt kết hợp sả thơm mát' },
      price: { type: 'number', example: 39000 },
      image_url: { type: 'string', example: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574' },
      rating: { type: 'number', example: 4.8 },
      review_count: { type: 'integer', example: 156 },
      status: { type: 'string', enum: ['active', 'draft', 'archived'], example: 'active' },
      variants: {
        type: 'array',
        items: { $ref: '#/components/schemas/ProductVariant' }
      }
    }
  },
  ProductVariant: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 108 },
      product_id: { type: 'integer', example: 42 },
      sku: { type: 'string', example: 'TDCS-M-70S' },
      variant_signature: { type: 'string', example: 'size:M|sugar:70' },
      name_suffix: { type: 'string', example: 'Size M - 70% Đường' },
      barcode: { type: 'string', nullable: true },
      price: { type: 'number', example: 39000 },
      status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
      attribute_values: { type: 'array', items: { type: 'object' } }
    }
  },
  ResolveConfigurationInput: {
    type: 'object',
    properties: {
      product_id: { type: 'integer', example: 42 },
      selected_attributes: {
        type: 'object',
        example: { size: 'L', sugar: '50%', ice: '70%' }
      }
    },
    required: ['product_id', 'selected_attributes']
  },
  BranchOffer: {
    type: 'object',
    properties: {
      variant_id: { type: 'integer', example: 108 },
      branch_id: { type: 'integer', example: 1 },
      is_available: { type: 'boolean', example: true },
      custom_price: { type: 'number', nullable: true, example: 42000 }
    }
  },
  Store: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'TeaPlus Flagship Phú Nhuận' },
      city: { type: 'string', example: 'Hồ Chí Minh' },
      district: { type: 'string', example: 'Phú Nhuận' },
      address: { type: 'string', example: '128 Phan Xích Long, Phường 2' },
      lat: { type: 'number', example: 10.7981 },
      lng: { type: 'number', example: 106.6912 },
      hours: { type: 'string', example: '08:00 - 23:00' },
      phone: { type: 'string', example: '02838449999' },
      is_active: { type: 'boolean', example: true }
    }
  },
  DiningTable: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 12 },
      store_id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Bàn B04' },
      is_active: { type: 'boolean', example: true },
      store_name: { type: 'string', example: 'TeaPlus Flagship Phú Nhuận' },
      qr_code_url: { type: 'string', nullable: true }
    }
  },
  Promotion: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 5 },
      code: { type: 'string', example: 'GIAM20K' },
      title: { type: 'string', example: 'Giảm 20K đơn từ 80K' },
      discount_type: { type: 'string', enum: ['fixed', 'percentage'], example: 'fixed' },
      discount_value: { type: 'number', example: 20000 },
      min_order_value: { type: 'number', example: 80000 },
      max_discount: { type: 'number', nullable: true },
      is_active: { type: 'boolean', example: true }
    }
  },
  ApplyVoucherInput: {
    type: 'object',
    properties: {
      voucher_code: { type: 'string', example: 'GIAM20K' },
      order_amount: { type: 'number', example: 95000 },
      store_id: { type: 'integer', example: 1 }
    },
    required: ['voucher_code', 'order_amount']
  },
  Review: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 88 },
      rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
      comment: { type: 'string', example: 'Trà thơm, ngọt dịu vừa phải, topping tươi!' },
      user: {
        type: 'object',
        properties: {
          fullname: { type: 'string', example: 'N***A' }
        }
      },
      media: { type: 'array', items: { type: 'object' } },
      reply: { type: 'object', nullable: true },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Job: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 3 },
      title: { type: 'string', example: 'Nhân viên Pha chế (Barista)' },
      department: { type: 'string', example: 'Vận hành Cửa hàng' },
      location: { type: 'string', example: 'Phú Nhuận, TP.HCM' },
      salary_range: { type: 'string', example: '25.000đ - 32.000đ/giờ' },
      description: { type: 'string', example: 'Chuẩn bị nguyên liệu, pha chế trà theo công thức chuẩn TeaPlus' },
      is_active: { type: 'boolean', example: true }
    }
  },
  JobApplication: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 14 },
      job_id: { type: 'integer', example: 3 },
      fullname: { type: 'string', example: 'Lê Hoàng Yến' },
      email: { type: 'string', format: 'email', example: 'hoangyen@example.com' },
      phone: { type: 'string', example: '0933112233' },
      cv_url: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['pending', 'reviewed', 'interview', 'rejected', 'hired'], example: 'pending' },
      created_at: { type: 'string', format: 'date-time' }
    }
  },
  CustomerNotification: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 902 },
      user_id: { type: 'integer', example: 52 },
      type: { type: 'string', example: 'order_status' },
      title: { type: 'string', example: 'Đơn hàng đang được pha chế' },
      body: { type: 'string', example: 'Đơn hàng TP-1024 của bạn đang được quán chuẩn bị.' },
      link: { type: 'string', nullable: true, example: '/orders/track?code=TP-1024' },
      is_read: { type: 'boolean', example: false },
      created_at: { type: 'string', format: 'date-time' }
    }
  },
  AdminAccount: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 7 },
      username: { type: 'string', example: 'kitchen_pn' },
      fullname: { type: 'string', example: 'Bếp Trưởng Phú Nhuận' },
      email: { type: 'string', format: 'email', example: 'kitchen@teaplus.vn' },
      role: { type: 'string', enum: ['super', 'manager', 'cashier', 'kitchen', 'packing'] },
      branch_id: { type: 'integer', nullable: true, example: 1 },
      branch_name: { type: 'string', nullable: true, example: 'TeaPlus Phú Nhuận' },
      is_active: { type: 'boolean', example: true },
      created_at: { type: 'string', format: 'date-time' }
    }
  },
  AuditLog: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 410 },
      user_id: { type: 'integer', example: 1 },
      username: { type: 'string', example: 'superadmin' },
      action: { type: 'string', example: 'Cập nhật trạng thái đơn #1024' },
      details: { type: 'string', example: '→ Đang chuẩn bị' },
      ip_address: { type: 'string', example: '118.69.182.20' },
      created_at: { type: 'string', format: 'date-time' }
    }
  }
};

// Security schemes
const securitySchemes = {
  BearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT authorization header using Bearer scheme (e.g. "Bearer {token}"). Staff and customer endpoints enforce signature and token version verification.'
  }
};

// Common parameters
const commonParameters = {
  IdempotencyKey: {
    name: 'idempotency-key',
    in: 'header',
    required: false,
    description: 'Unique client-supplied UUID or request key ensuring safe exactly-once execution and mutation replays.',
    schema: { type: 'string' }
  },
  CancelTokenHeader: {
    name: 'x-cancel-token',
    in: 'header',
    required: false,
    description: 'Secret order cancellation token issued to guest customers, granting access to lookup, mutate, or cancel the order.',
    schema: { type: 'string' }
  }
};

export { schemas, securitySchemes, commonParameters, routes };
