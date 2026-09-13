import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  CalendarClock,
  ChevronDown,
  CircleAlert,
  MapPin,
  PackageOpen,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet, apiPost } from '@/lib/api';
import { openCustomerLoginModal, useCustomerSession } from '@/lib/customer-session';
import { vnd } from '@/lib/data';

export type PreorderItem = {
  id: number;
  product_name: string;
  qty: number;
  size_label?: string;
  note?: string | null;
  line_total: number;
  toppings: { name: string }[];
};

export type LinkedOrder = {
  id: number;
  order_code: string;
  current_status: string;
  total: number;
  items: PreorderItem[];
};

export type CustomerPreorder = {
  id: number;
  preorder_code: string;
  status: string;
  store_name: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  table_name?: string | null;
  reservation_status?: string | null;
  late_minutes?: number | null;
  cancel_reason?: string | null;
  orders: LinkedOrder[];
};

export const statusPresentation: Record<string, { label: string; tone: string; description: string }> = {
  AWAITING_PAYMENT: {
    label: 'Chờ thanh toán',
    tone: 'bg-amber-100 text-amber-800',
    description: 'Đơn sẽ được gửi tới cửa hàng sau khi thanh toán được xác nhận.',
  },
  PENDING_MANAGER_CONFIRMATION: {
    label: 'Đã thanh toán · chờ xác nhận',
    tone: 'bg-sky-100 text-sky-800',
    description: 'Manager cửa hàng đang xác nhận thời gian phục vụ.',
  },
  CONFIRMED: {
    label: 'Đã xác nhận · chờ check-in',
    tone: 'bg-violet-100 text-violet-800',
    description: 'Hãy đến cửa hàng trong cửa sổ check-in của khung giờ đã đặt.',
  },
  CHECKED_IN: {
    label: 'Đã check-in · quán đang xử lý',
    tone: 'bg-emerald-100 text-emerald-800',
    description: 'Đơn đã được mở cho Bếp xử lý.',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    tone: 'bg-emerald-100 text-emerald-800',
    description: 'Cảm ơn bạn đã sử dụng dịch vụ.',
  },
  CUSTOMER_CANCELLED: {
    label: 'Đã hủy',
    tone: 'bg-slate-100 text-slate-700',
    description: 'Lịch sử thanh toán vẫn được lưu; hệ thống không tự hoàn tiền.',
  },
  NO_SHOW: {
    label: 'Không đến nhận',
    tone: 'bg-rose-100 text-rose-800',
    description: 'Đã quá thời hạn check-in cho khung giờ này.',
  },
  PAYMENT_EXPIRED: {
    label: 'Thanh toán đã hết hạn',
    tone: 'bg-slate-100 text-slate-700',
    description: 'Hãy tạo một preorder mới nếu vẫn cần đặt trước.',
  },
  LATE_PAID_REQUIRES_ACTION: {
    label: 'Thanh toán muộn · cần cửa hàng xử lý',
    tone: 'bg-rose-100 text-rose-800',
    description: 'Cửa hàng sẽ liên hệ để xử lý đơn này.',
  },
};

export const defaultStatusPresentation = {
  label: 'Đang cập nhật trạng thái',
  tone: 'bg-muted text-muted-foreground',
  description: 'Đang cập nhật trạng thái.',
};

export function getStatusPresentation(status?: string | null) {
  if (!status || !statusPresentation[status]) {
    return defaultStatusPresentation;
  }
  return statusPresentation[status];
}

export function formatSlot(startAt?: string | null, endAt?: string | null): string {
  if (!startAt) return 'Chưa xác định thời gian';
  const start = new Date(startAt);
  if (isNaN(start.getTime())) return 'Thời gian không hợp lệ';

  try {
    const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    let datePart = '';
    try {
      const fullFormatter = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'full',
      });
      datePart = fullFormatter.format(start);
    } catch {
      const fallbackDate = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
      datePart = fallbackDate.format(start);
    }

    const startTime = timeFormatter.format(start);

    if (!endAt) {
      return `${datePart} lúc ${startTime}`;
    }
    const end = new Date(endAt);
    if (isNaN(end.getTime())) {
      return `${datePart} lúc ${startTime}`;
    }
    const endTime = timeFormatter.format(end);
    return `${datePart}, ${startTime} – ${endTime}`;
  } catch {
    return 'Thời gian không hợp lệ';
  }
}

export function canCancel(preorder: CustomerPreorder): boolean {
  if (!['AWAITING_PAYMENT', 'PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status)) {
    return false;
  }
  const startTime = new Date(preorder.scheduled_start_at).getTime();
  if (isNaN(startTime)) return false;
  return startTime > Date.now();
}

export function normalizeCustomerPreorder(raw: any): CustomerPreorder | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id) || 0;
  const preorder_code = String(raw.preorder_code || '').trim();
  if (!id && !preorder_code) return null;

  const rawOrders = Array.isArray(raw.orders) ? raw.orders : [];
  const orders: LinkedOrder[] = rawOrders.map((ro: any, idx: number) => {
    const rawItems = Array.isArray(ro?.items) ? ro.items : [];
    const items: PreorderItem[] = rawItems.map((ri: any, itemIdx: number) => {
      const rawToppings = Array.isArray(ri?.toppings) ? ri.toppings : [];
      const toppings = rawToppings
        .map((t: any) => ({ name: String(t?.name || '').trim() }))
        .filter((t: any) => Boolean(t.name));

      return {
        id: Number(ri?.id) || itemIdx + 1,
        product_name: String(ri?.product_name || 'Sản phẩm').trim(),
        qty: Number(ri?.qty) > 0 ? Number(ri.qty) : 1,
        size_label: ri?.size_label ? String(ri.size_label).trim() : undefined,
        note: ri?.note ? String(ri.note).trim() : null,
        line_total: Number(ri?.line_total) || 0,
        toppings,
      };
    });

    return {
      id: Number(ro?.id) || idx + 1,
      order_code: String(ro?.order_code || 'Chưa có mã').trim(),
      current_status: String(ro?.current_status || 'Đang chờ cập nhật').trim(),
      total: Number(ro?.total) || 0,
      items,
    };
  });

  return {
    id,
    preorder_code: preorder_code || `PRE-${id}`,
    status: String(raw.status || '').trim(),
    store_name: String(raw.store_name || 'Chi nhánh Tea Station').trim(),
    scheduled_start_at: String(raw.scheduled_start_at || ''),
    scheduled_end_at: String(raw.scheduled_end_at || ''),
    table_name: raw.table_name ? String(raw.table_name).trim() : null,
    reservation_status: raw.reservation_status ? String(raw.reservation_status).trim() : null,
    late_minutes: typeof raw.late_minutes === 'number' ? raw.late_minutes : null,
    cancel_reason: raw.cancel_reason ? String(raw.cancel_reason).trim() : null,
    orders,
  };
}

export function normalizeCustomerPreorders(rawList: any): CustomerPreorder[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map(normalizeCustomerPreorder)
    .filter((item): item is CustomerPreorder => item !== null);
}

export function CustomerPreordersTab({
  isActive,
  highlightedCode,
}: {
  isActive: boolean;
  highlightedCode?: string | null;
}) {
  const session = useCustomerSession();
  const sessionKey = session ? `${session.userId}:${session.token}` : null;
  const [rows, setRows] = useState<CustomerPreorder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef(false);
  const inFlightSessionKeyRef = useRef<string | null>(null);
  const sessionKeyRef = useRef<string | null>(sessionKey);
  // Keep the identity boundary current during render so a late response from
  // a previous customer cannot commit before the effect below has run.
  sessionKeyRef.current = sessionKey;

  useEffect(() => {
    setRows([]);
    setError(null);
    setCancelling(null);
    hasLoadedRef.current = false;
    inFlightRef.current = false;
    inFlightSessionKeyRef.current = null;
  }, [sessionKey]);

  const load = useCallback(async () => {
    if (!session) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (inFlightRef.current) return;
    const requestSessionKey = `${session.userId}:${session.token}`;
    inFlightRef.current = true;
    inFlightSessionKeyRef.current = requestSessionKey;
    setLoading(true);
    setError(null);

    try {
      const result = await apiGet<{ preorders?: unknown }>('/api/preorders/mine');
      if (sessionKeyRef.current !== requestSessionKey) return;
      if (result && typeof result === 'object' && 'preorders' in result) {
        if (Array.isArray(result.preorders)) {
          setRows(normalizeCustomerPreorders(result.preorders));
        } else {
          setRows([]);
        }
      } else {
        setRows([]);
      }
      if (sessionKeyRef.current === requestSessionKey) hasLoadedRef.current = true;
    } catch (err: any) {
      if (sessionKeyRef.current !== requestSessionKey) return;
      if (err?.status === 401 || err?.statusCode === 401) {
        openCustomerLoginModal();
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else {
        setError('Không thể tải đơn đặt trước. Vui lòng thử lại.');
      }
    } finally {
      if (sessionKeyRef.current === requestSessionKey) setLoading(false);
      if (inFlightSessionKeyRef.current === requestSessionKey) {
        inFlightRef.current = false;
        inFlightSessionKeyRef.current = null;
      }
    }
  }, [session]);

  useEffect(() => {
    if (isActive && session && !hasLoadedRef.current) {
      void load();
    }
  }, [isActive, load, session]);

  const activeHighlightedCode = useMemo(() => highlightedCode?.trim() || null, [highlightedCode]);

  async function handleCancel(preorder: CustomerPreorder) {
    if (cancelling !== null) return;
    setCancelling(preorder.id);
    try {
      await apiPost(`/api/preorders/${encodeURIComponent(preorder.preorder_code)}/cancel`, {});
      toast.success('Đã hủy preorder. Lịch sử thanh toán được giữ nguyên.');
      await load();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Không thể hủy preorder.');
    } finally {
      setCancelling(null);
    }
  }

  if (!session) {
    return (
      <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <PackageOpen className="mx-auto mb-3 size-8 text-primary" />
        <h2 className="text-lg font-bold">Đơn đặt trước của tôi</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Đăng nhập để theo dõi riêng lịch nhận món, trạng thái xác nhận và các món đã đặt.
        </p>
        <Button className="mt-4" onClick={() => openCustomerLoginModal()}>
          Đăng nhập ngay
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <CalendarClock className="mt-1 size-7 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Đơn đặt trước của tôi</h2>
            <p className="text-sm text-muted-foreground">
              Theo dõi riêng lịch nhận món; đơn đặt trước không lẫn với lịch sử đơn thông thường.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Làm mới
        </Button>
      </header>

      {loading && rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground text-sm">
          Đang tải đơn đặt trước…
        </div>
      ) : null}

      {!loading && error && rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" /> Thử lại
          </Button>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <section className="rounded-2xl border bg-card p-8 text-center">
          <PackageOpen className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h3 className="font-semibold">Chưa có đơn đặt trước</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Bạn có thể chọn món và lịch nhận tại cửa hàng.
          </p>
          <Button className="mt-4" asChild variant="hero" size="sm">
            <Link to="/dat-truoc">Tạo đơn đặt trước</Link>
          </Button>
        </section>
      ) : null}

      {rows.map((preorder) => {
        const presentation = getStatusPresentation(preorder.status);
        const isHighlighted = activeHighlightedCode === preorder.preorder_code;
        const totalItemsCount = preorder.orders.reduce(
          (sum, order) => sum + (Array.isArray(order.items) ? order.items.length : 0),
          0
        );

        return (
          <article
            key={preorder.id}
            id={isHighlighted ? 'preorder-highlight' : undefined}
            className={`rounded-2xl border bg-card p-5 shadow-sm transition-shadow ${
              isHighlighted ? 'ring-2 ring-primary/50' : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{preorder.preorder_code}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-4" />
                  {preorder.store_name}
                </p>
              </div>
              <Badge className={presentation.tone}>{presentation.label}</Badge>
            </div>

            <div className="mt-4 grid gap-3 rounded-xl bg-muted/45 p-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lịch nhận món
                </p>
                <p className="mt-1 font-medium text-sm">
                  {formatSlot(preorder.scheduled_start_at, preorder.scheduled_end_at)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bàn
                </p>
                <p className="mt-1 font-medium text-sm">
                  {preorder.table_name || 'Cửa hàng sẽ sắp xếp bàn'}
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">{presentation.description}</p>

            {preorder.late_minutes != null && preorder.late_minutes > 0 ? (
              <p className="mt-2 text-sm text-amber-700">
                Bạn đã check-in muộn {preorder.late_minutes} phút.
              </p>
            ) : null}

            {preorder.cancel_reason ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Lý do hủy: {preorder.cancel_reason}
              </p>
            ) : null}

            <details className="mt-4 rounded-xl border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 font-medium text-sm">
                <span>Món đã đặt ({totalItemsCount})</span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </summary>
              <div className="space-y-3 border-t p-3">
                {preorder.orders.map((order) => (
                  <div key={order.id} className="space-y-2">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-medium">Đơn {order.order_code}</span>
                      <span className="text-muted-foreground">{order.current_status}</span>
                    </div>
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3 text-sm">
                        <div>
                          <span className="font-medium">
                            {item.qty}× {item.product_name}
                          </span>
                          {item.size_label ? (
                            <span className="text-muted-foreground"> · {item.size_label}</span>
                          ) : null}
                          {item.toppings?.length ? (
                            <p className="text-xs text-muted-foreground">
                              {item.toppings.map((topping) => topping.name).join(', ')}
                            </p>
                          ) : null}
                          {item.note ? (
                            <p className="text-xs text-muted-foreground">Ghi chú: {item.note}</p>
                          ) : null}
                        </div>
                        <span className="font-medium">{vnd(item.line_total || 0)}</span>
                      </div>
                    ))}
                    {order.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Đơn đang chờ thanh toán nên chưa có chi tiết món để xử lý.
                      </p>
                    ) : null}
                  </div>
                ))}
                {preorder.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Đơn đang chờ thanh toán nên chưa có chi tiết món để xử lý.
                  </p>
                ) : null}
              </div>
            </details>

            {canCancel(preorder) ? (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={cancelling === preorder.id}
                  onClick={() => void handleCancel(preorder)}
                >
                  {cancelling === preorder.id ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CircleAlert className="mr-2 size-4" />
                  )}
                  {cancelling === preorder.id ? 'Đang hủy…' : 'Hủy preorder'}
                </Button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
