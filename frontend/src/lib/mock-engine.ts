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
    if (!user) return Promise.reject(new Error('Vui lòng đăng ký hoặc đăng nhập tài khoản trước khi đặt hàng'));
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

  // 1b. POST /api/payments/payos/regenerate-qr
  if (path === '/api/payments/payos/regenerate-qr' && method === 'POST') {
    const code = body.order_code;
    const orders = getLocalOrders();
    const found = orders.find((o: any) => o.order_code === code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const updated = orders.map((o: any) => {
      if (o.order_code === code) {
        return {
          ...o,
          payment_status: 'unpaid',
          payment_expires_at: expiresAt,
          checkout_url: `https://payos.vn/demo-pay?code=${code}&renew=1`,
          qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VIETQR-DEMO-${code}-RENEW`,
        };
      }
      return o;
    });
    saveLocalOrders(updated);
    return Promise.resolve({
      ok: true,
      order: {
        order_code: code,
        total: found ? found.total : 45000,
        checkout_url: `https://payos.vn/demo-pay?code=${code}&renew=1`,
        qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VIETQR-DEMO-${code}-RENEW`,
        payment_expires_at: expiresAt,
        payment_status: 'unpaid',
      },
    } as T);
  }

  // 1c. POST /api/payments/payos/simulate-success
  if (path === '/api/payments/payos/simulate-success' && method === 'POST') {
    const code = body.order_code;
    const orders = getLocalOrders();
    const updated = orders.map((o: any) => {
      if (o.order_code === code) {
        return { ...o, payment_status: 'paid', paid_at: new Date().toISOString() };
      }
      return o;
    });
    saveLocalOrders(updated);
    return Promise.resolve({ ok: true, message: 'Đã giả lập thanh toán thành công' } as T);
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

  // 4. Customer phone + password auth (standalone-only local mock)
  if (path === '/api/auth/register' || path === '/api/auth/login') {
    const accountKey = 'teaplus_customer_account';
    let account: any = null;
    try { account = JSON.parse(localStorage.getItem(accountKey) || 'null'); } catch { account = null; }
    if (path.endsWith('/register')) {
      if (!body.phone || !body.password || !body.fullname) return Promise.reject(new Error('Vui lòng nhập đủ thông tin'));
      if (account && account.phone === body.phone) return Promise.reject(new Error('Số điện thoại đã được đăng ký'));
      account = { id: 99, fullname: body.fullname, phone: body.phone, password: body.password, tier: 'Đồng', points: 50 };
      localStorage.setItem(accountKey, JSON.stringify(account));
    } else if (!account || account.phone !== body.phone || account.password !== body.password) {
      return Promise.reject(new Error('Số điện thoại hoặc mật khẩu không đúng'));
    }
    const user = { id: account.id, fullname: account.fullname, phone: account.phone, tier: account.tier, points: account.points };
    return Promise.resolve({ token: 'demo-customer-token', user } as T);
  }

  // 5. POST /api/auth/google
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
    orders = orders.filter((o: any) =>
      (o.payment_status === 'paid' || o.payment_method === 'COD' || o.order_type === 'POS') &&
      (o.current_status === 'Đang chuẩn bị' || o.current_status === 'Chờ xác nhận' || o.current_status === 'Đang giao')
    );
    if (storeId && storeId !== 'all') {
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
        return {
          ...o,
          current_status: newStatus,
          shipping_driver_name: body.driver_name !== undefined ? body.driver_name : o.shipping_driver_name,
          shipping_driver_phone: body.driver_phone !== undefined ? body.driver_phone : o.shipping_driver_phone,
        };
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

  // 13. Promotions Mock
  if (path.startsWith('/admin/promotions') || path.startsWith('/api/promotions')) {
    const rawPromos = typeof window !== 'undefined' ? window.localStorage.getItem('teaplus_mock_promotions') : null;
    let promoList = rawPromos ? JSON.parse(rawPromos) : [
      { id: 1, title: 'Giảm 20% Đơn Đầu Tiên', code: 'CHAOBANMOI', discount_value: 20, discount_type: 'percent', max_discount: 30000, min_order: 50000, voucher_type: 'time_bounded', start_date: '2026-01-01', end_date: '2026-12-31', status: 'Đang diễn ra', is_active: true, deleted_at: null },
      { id: 2, title: 'Freeship Giờ Vàng', code: 'FREESHIP', discount_value: 15000, discount_type: 'fixed', max_discount: 15000, min_order: 99000, voucher_type: 'time_bounded', start_date: '2026-01-01', end_date: '2026-12-31', status: 'Đang diễn ra', is_active: true, deleted_at: null },
    ];

    if (method === 'DELETE') {
      const parts = path.split('/');
      const id = Number(parts[parts.length - 1]);
      promoList = promoList.map((p: any) => (p.id === id ? { ...p, deleted_at: new Date().toISOString(), is_active: false } : p));
      if (typeof window !== 'undefined') window.localStorage.setItem('teaplus_mock_promotions', JSON.stringify(promoList));
      return Promise.resolve({ message: 'Đã xóa khuyến mãi thành công' } as T);
    }
    if (method === 'PUT') {
      const parts = path.split('/');
      const id = Number(parts[parts.length - 1]);
      const body = options?.body ? JSON.parse(String(options.body)) : {};
      promoList = promoList.map((p: any) => (p.id === id ? { ...p, ...body } : p));
      if (typeof window !== 'undefined') window.localStorage.setItem('teaplus_mock_promotions', JSON.stringify(promoList));
      return Promise.resolve({ message: 'Đã cập nhật khuyến mãi' } as T);
    }
    if (method === 'POST') {
      const body = options?.body ? JSON.parse(String(options.body)) : {};
      const newPromo = { id: Date.now(), ...body, is_active: true, deleted_at: null };
      promoList = [newPromo, ...promoList];
      if (typeof window !== 'undefined') window.localStorage.setItem('teaplus_mock_promotions', JSON.stringify(promoList));
      return Promise.resolve(newPromo as T);
    }
    const activePromos = promoList.filter((p: any) => !p.deleted_at);
    return Promise.resolve(activePromos as T);
  }

  // 14. Notifications Mock
  if (path.includes('/notifications')) {
    const customerId = path.startsWith('/api/users/') ? path.split('/')[3] : null;
    const notificationStorageKey = customerId
      ? `teaplus_mock_notifications_customer_${customerId}`
      : 'teaplus_mock_notifications_admin';
    const rawNotifs = typeof window !== 'undefined' ? window.localStorage.getItem(notificationStorageKey) : null;
    let notifList = rawNotifs ? JSON.parse(rawNotifs) : [
      { id: 1, user_id: customerId ? Number(customerId) : 1, type: 'order', title: 'Đặt hàng thành công — #TP260824001', body: 'Đơn hàng của bạn đang được quán chuẩn bị.', is_read: false, link: '/theo-doi-don?code=TP260824001', created_at: new Date().toISOString() },
      { id: 2, user_id: customerId ? Number(customerId) : 1, type: 'voucher', title: 'Mã ưu đãi 20% sắp hết hạn', body: 'Sử dụng mã CHAOBANMOI để được giảm giá ngay hôm nay!', is_read: true, link: '/menu', created_at: new Date(Date.now() - 3600000).toISOString() },
    ];

    if (method === 'DELETE') {
      notifList = [];
      if (typeof window !== 'undefined') window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifList));
      return Promise.resolve({ ok: true, count: 0 } as T);
    }
    if (path.endsWith('/read-all')) {
      notifList = notifList.map((n: any) => ({ ...n, is_read: true }));
      if (typeof window !== 'undefined') window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifList));
      return Promise.resolve({ ok: true, count: notifList.length } as T);
    }
    if (path.endsWith('/read')) {
      const parts = path.split('/');
      const readIdx = parts.indexOf('read');
      const targetId = Number(parts[readIdx - 1]);
      notifList = notifList.map((n: any) => (n.id === targetId ? { ...n, is_read: true } : n));
      if (typeof window !== 'undefined') window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifList));
      return Promise.resolve({ ok: true } as T);
    }
    if (path.startsWith('/api/users/')) {
      const unreadCount = notifList.filter((n: any) => !n.is_read).length;
      return Promise.resolve({ notifications: notifList, unread_count: unreadCount } as T);
    }
    return Promise.resolve(notifList as T);
  }

  return Promise.resolve({} as T);
}
