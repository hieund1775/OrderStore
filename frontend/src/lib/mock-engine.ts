import { products, stores } from './data';

export function getLocalOrders(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('teaplus_orders');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalOrders(orders: any[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('teaplus_orders', JSON.stringify(orders));
}

function getStoredCustomerUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('teaplus_customer_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function handleLocalMock<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  let body: any = {};
  try {
    body = options?.body ? JSON.parse(options.body as string) : {};
  } catch {
    body = {};
  }

  // 1. POST /api/orders (Tạo đơn hàng Client-side Standalone)
  if (path.startsWith('/api/orders') && method === 'POST' && !path.includes('/cancel')) {
    if (body.order_type === 'Delivery' && (!body.delivery_addr || !body.delivery_addr.trim())) {
      return Promise.reject(new Error('Đơn hàng Giao tận nơi bắt buộc phải nhập địa chỉ giao hàng'));
    }
    const items = body.items || [];
    let subtotal = 0;
    const itemsWithDetails = items.map((item: any) => {
      const p = products.find((prod) => prod.id === item.product_id || prod.name === item.product_id) || products[0];
      const price = p ? p.price : 45000;
      const qty = item.qty || 1;
      const itemTotal = price * qty;
      subtotal += itemTotal;
      return {
        product_name: p ? p.name : 'Trà Trái Cây',
        qty,
        size_label: item.size_id === 2 ? 'L' : 'M',
        base_tea: item.base_tea || 'Lục Trà Lài',
        sugar_level: item.sugar_level || '100%',
        ice_level: item.ice_level || '100%',
        note: item.note || null,
        unit_price: price,
        line_total: itemTotal,
        toppings: [],
        price,
        itemTotal,
      };
    });

    const storeId = body.store_id || 1;
    const store = stores.find((s) => String(s.id) === String(storeId)) || stores[0];

    const orderCode = 'TP' + Math.floor(100000 + Math.random() * 900000);
    const user = getStoredCustomerUser();
    const isPayOS = body.payment_method === 'VietQR';
    const payment_status = 'unpaid';
    const payment_provider = isPayOS ? 'payos' : body.payment_method?.toLowerCase() || 'cod';
    const checkout_url = isPayOS ? `https://payos.vn/demo-pay?code=${orderCode}` : undefined;
    const qr_code = isPayOS ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VIETQR-DEMO-${orderCode}` : undefined;
    const payment_expires_at = isPayOS ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : undefined;

    const newOrder = {
      id: Date.now(),
      order_code: orderCode,
      user_id: user ? user.id : null,
      customer_name: body.customer_name || 'Khách hàng',
      customer_phone: body.customer_phone || '0900000000',
      delivery_addr: body.delivery_addr || null,
      order_type: body.order_type || 'Take-away',
      payment_method: body.payment_method || 'VietQR',
      payment_status,
      payment_provider,
      payment_expires_at,
      store_id: Number(storeId),
      store_name: store.name,
      location_name: null,
      voucher_code: body.voucher_code || null,
      current_status: 'Đang chuẩn bị',
      subtotal,
      discount_amount: 0,
      total: subtotal,
      created_at: new Date().toISOString(),
      items: itemsWithDetails,
      status_history: [
        { status: 'Đang chuẩn bị', note: 'Đơn hàng mới tạo', created_at: new Date().toISOString() }
      ],
    };

    const existing = getLocalOrders();
    saveLocalOrders([newOrder, ...existing]);

    // Demo auto-confirm after 8s for PayOS in Standalone mode
    if (isPayOS) {
      setTimeout(() => {
        const curOrders = getLocalOrders();
        const updated = curOrders.map((o: any) => {
          if (o.order_code === orderCode && o.payment_status === 'unpaid') {
            return { ...o, payment_status: 'paid', paid_at: new Date().toISOString() };
          }
          return o;
        });
        saveLocalOrders(updated);
      }, 8000);
    }

    return Promise.resolve({
      order_code: orderCode,
      order_id: newOrder.id,
      subtotal,
      discount_amount: 0,
      total: subtotal,
      payment_status,
      payment_provider,
      checkout_url,
      qr_code,
      payment_expires_at,
    } as T);
  }

  // 2. GET /api/orders/lookup?code=X & /api/orders/track?code=X (Tra cứu đơn hàng)
  if (path.startsWith('/api/orders/lookup') || path.startsWith('/api/orders/track')) {
    const code = new URLSearchParams(path.split('?')[1] || '').get('code');
    const orders = getLocalOrders();
    const found = orders.find((o: any) => o.order_code === code);

    const orderData = found || {
      id: 999,
      order_code: code || 'TP123456',
      current_status: 'Đang chuẩn bị',
      order_type: 'Delivery',
      payment_method: 'COD',
      customer_name: 'Khách hàng Demo',
      customer_phone: '0901234567',
      delivery_addr: '123 Nguyễn Huệ, Q.1, TP.HCM',
      store_name: 'Trà Trái Cây Tô – Nguyễn Huệ',
      location_name: null,
      voucher_code: null,
      total: 85000,
      subtotal: 85000,
      discount_amount: 0,
      created_at: new Date().toISOString(),
      items: [
        { product_name: 'Trà Cam Sả Mật Ong', qty: 1, size_label: 'M', base_tea: 'Lục Trà Lài', sugar_level: '100%', ice_level: '100%', note: null, unit_price: 45000, line_total: 45000, toppings: [] },
        { product_name: 'Trà Dâu Tây Tuyết', qty: 1, size_label: 'L', base_tea: 'Hồng Trà', sugar_level: '100%', ice_level: '100%', note: null, unit_price: 40000, line_total: 40000, toppings: [] },
      ],
      status_history: [
        { status: 'Đang chuẩn bị', note: 'Đơn hàng mới tạo', created_at: new Date().toISOString() }
      ],
    };

    if (path.startsWith('/api/orders/lookup')) {
      return Promise.resolve({ order: orderData } as T);
    }
    return Promise.resolve(orderData as T);
  }

  // 3. POST /api/orders/:id/cancel
  if (path.includes('/orders/') && path.includes('/cancel')) {
    const parts = path.split('/');
    const idStr = parts[parts.indexOf('orders') + 1];
    const orders = getLocalOrders();
    const updated = orders.map((o: any) => {
      if (String(o.id) === idStr || o.order_code === idStr) {
        const history = o.status_history || [];
        return {
          ...o,
          current_status: 'Đã hủy',
          status_history: [
            ...history,
            { status: 'Đã hủy', note: 'Khách hàng yêu cầu hủy đơn', created_at: new Date().toISOString() }
          ]
        };
      }
      return o;
    });
    saveLocalOrders(updated);
    return Promise.resolve({ message: 'Đã hủy đơn hàng thành công' } as T);
  }

  // 4. POST /api/auth/send-otp
  if (path === '/api/auth/send-otp') {
    return Promise.resolve({ message: 'Đã gửi mã OTP thành công', demo_otp: '123456' } as T);
  }

  // 5. POST /api/auth/verify-otp
  if (path === '/api/auth/verify-otp') {
    const user = {
      id: 99,
      fullname: body.fullname || `Khách hàng ${String(body.phone || '').slice(-4)}`,
      phone: body.phone || '0901234567',
      tier: 'Đồng',
      points: 50,
    };
    return Promise.resolve({ token: 'demo-customer-token', user } as T);
  }

  // 6. POST /api/auth/google
  if (path === '/api/auth/google') {
    const user = {
      id: 100,
      fullname: 'Khách hàng Google',
      phone: null,
      tier: 'Đồng',
      points: 100,
    };
    return Promise.resolve({ token: 'demo-google-token', user } as T);
  }

  // 7. GET /api/users/:id/orders
  if (path.startsWith('/api/users/') && path.endsWith('/orders')) {
    const orders = getLocalOrders();
    return Promise.resolve(orders as T);
  }

  // 8. GET /admin/kitchen/orders
  if (path.startsWith('/admin/kitchen/orders')) {
    const storeId = new URLSearchParams(path.split('?')[1] || '').get('store_id');
    let orders = getLocalOrders();
    if (storeId) {
      orders = orders.filter((o: any) => String(o.store_id) === String(storeId));
    }
    return Promise.resolve(orders as T);
  }

  // 9. PATCH /admin/orders/:id/status
  if (path.startsWith('/admin/orders/') && path.endsWith('/status')) {
    const parts = path.split('/');
    const idStr = parts[3];
    const newStatus = body.status || 'Hoàn thành';
    const orders = getLocalOrders();
    const updated = orders.map((o: any) => {
      if (String(o.id) === idStr) {
        return { ...o, current_status: newStatus };
      }
      return o;
    });
    saveLocalOrders(updated);
    return Promise.resolve({ message: 'Cập nhật trạng thái thành công' } as T);
  }

  // 9b. PUT /admin/orders/:id/payment/confirm
  if (path.startsWith('/admin/orders/') && path.endsWith('/payment/confirm')) {
    const parts = path.split('/');
    const idStr = parts[3];
    const orders = getLocalOrders();
    const updated = orders.map((o: any) => {
      if (String(o.id) === idStr) {
        return { ...o, payment_status: 'paid', paid_at: new Date().toISOString() };
      }
      return o;
    });
    saveLocalOrders(updated);
    return Promise.resolve({ ok: true, message: 'Đã xác nhận thanh toán thành công', payment_status: 'paid' } as T);
  }

  // 10. POST /admin/login
  if (path === '/admin/login') {
    return Promise.resolve({
      token: 'demo-admin-token',
      user: { id: 1, fullname: 'Quản trị viên Demo', phone: '0900000000', role: 'super', branch_id: null },
    } as T);
  }

  // 11. Stores & Products & Options fallback
  if (path.startsWith('/admin/stores') || path.startsWith('/api/stores') || path.startsWith('/admin/branches')) {
    return Promise.resolve(stores as T);
  }
  if (path.startsWith('/admin/tables') || path.startsWith('/api/tables')) {
    const mockTables = [
      { id: 1, store_id: 1, store_name: 'Trà Trái Cây Tô – Nguyễn Huệ', name: 'Bàn 01', qr_code_token: 'TBL-1-01', is_active: true },
      { id: 2, store_id: 1, store_name: 'Trà Trái Cây Tô – Nguyễn Huệ', name: 'Bàn 02', qr_code_token: 'TBL-1-02', is_active: true },
      { id: 3, store_id: 1, store_name: 'Trà Trái Cây Tô – Nguyễn Huệ', name: 'Bàn 03', qr_code_token: 'TBL-1-03', is_active: true },
      { id: 4, store_id: 2, store_name: 'Trà Trái Cây Tô – Hàng Bài', name: 'Bàn 01', qr_code_token: 'TBL-2-01', is_active: true },
    ];
    return Promise.resolve(mockTables as T);
  }
  if (path.startsWith('/admin/products') || path.startsWith('/api/products')) {
    return Promise.resolve(products as T);
  }
  if (path.startsWith('/api/options/sizes')) {
    return Promise.resolve([{ id: 1, label: 'M', base_price_multiplier: 1.0 }, { id: 2, label: 'L', base_price_multiplier: 1.2 }] as T);
  }
  if (path.startsWith('/api/options/toppings')) {
    return Promise.resolve([
      { id: 1, name: 'Trân Châu Đen', price: 10000 },
      { id: 2, name: 'Thạch Trái Cây', price: 10000 },
      { id: 3, name: 'Kem Cheese', price: 15000 }
    ] as T);
  }
  // 12. Admin Dashboard Mock Fallback
  if (path.startsWith('/admin/dashboard/kpi')) {
    return Promise.resolve({
      revenue: { value: 12500000, label: 'Doanh thu hôm nay' },
      orders: { value: 148, label: 'Tổng đơn hôm nay' },
      cancelRate: { value: '1.2%', label: 'Tỷ lệ hủy đơn' },
      cups: { value: 312, label: 'Tổng ly bán ra' },
    } as T);
  }
  if (path.startsWith('/admin/dashboard/urgent')) {
    return Promise.resolve({ paused: 0, preparing: 4 } as T);
  }
  if (path.startsWith('/admin/dashboard/revenue-by-hour')) {
    const hours = [
      { hour: 8, value: 450000 },
      { hour: 9, value: 1200000 },
      { hour: 10, value: 1850000 },
      { hour: 11, value: 2400000 },
      { hour: 12, value: 3100000 },
      { hour: 13, value: 1900000 },
      { hour: 14, value: 1600000 },
      { hour: 15, value: 2100000 },
      { hour: 16, value: 2800000 },
      { hour: 17, value: 3400000 },
      { hour: 18, value: 4200000 },
      { hour: 19, value: 3800000 },
      { hour: 20, value: 2900000 },
    ];
    return Promise.resolve(hours as T);
  }
  if (path.startsWith('/admin/orders')) {
    const orders = getLocalOrders();
    return Promise.resolve(orders as T);
  }

  return Promise.resolve({} as T);
}
