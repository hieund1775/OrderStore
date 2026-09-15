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
  checkin_request?: {
    id: number;
    status: string;
    requested_at: string;
    late_confirmation_reason?: string | null;
    rejection_reason?: string | null;
  } | null;
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
    description: 'Hãy tự check-in trên ứng dụng khi quý khách đến cửa hàng (08:00–24:00 trong ngày hẹn).',
  },
  CHECKED_IN: {
    label: 'Đã check-in · chờ nhận món',
    tone: 'bg-emerald-100 text-emerald-800',
    description: 'Quý khách đã check-in tại quán. Cửa hàng sẽ bàn giao món.',
  },
  COMPLETED: {
    label: 'Đã nhận hàng thành công',
    tone: 'bg-emerald-100 text-emerald-800',
    description: 'Cảm ơn bạn đã sử dụng dịch vụ đặt trước.',
  },
  CUSTOMER_CANCELLED: {
    label: 'Đã hủy',
    tone: 'bg-slate-100 text-slate-700',
    description: 'Lịch sử thanh toán vẫn được lưu; hệ thống không tự hoàn tiền.',
  },
  NO_SHOW: {
    label: 'Đã hủy do khách không đến',
    tone: 'bg-rose-100 text-rose-800',
    description: 'Đơn đã tự động đóng lúc 24:00 do quý khách không đến check-in.',
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

export function getPreorderOperationalBadge(preorder: CustomerPreorder): { label: string; tone: string } {
  if (preorder.status === 'CONFIRMED') {
    const allOrdersDone = preorder.orders.length > 0 && preorder.orders.every((o) => o.current_status === 'Hoàn thành');
    if (allOrdersDone) {
      return { label: 'Sẵn sàng giao', tone: 'bg-teal-100 text-teal-800' };
    }
    return { label: 'Đang chuẩn bị', tone: 'bg-amber-100 text-amber-800' };
  }
  if (preorder.status === 'CHECKED_IN') {
    const allOrdersDone = preorder.orders.length > 0 && preorder.orders.every((o) => o.current_status === 'Hoàn thành');
    if (allOrdersDone) {
      return { label: 'Chờ cửa hàng xác nhận giao', tone: 'bg-blue-100 text-blue-800' };
    }
    return { label: 'Đang chuẩn bị', tone: 'bg-amber-100 text-amber-800' };
  }
  if (preorder.status === 'COMPLETED') {
    return { label: 'Đã nhận hàng thành công', tone: 'bg-emerald-100 text-emerald-800' };
  }
  return getStatusPresentation(preorder.status);
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
  if (preorder.status === 'CHECKED_IN' || preorder.status === 'COMPLETED' || preorder.status === 'CUSTOMER_CANCELLED' || preorder.status === 'NO_SHOW') {
    return false;
  }
  if (!['AWAITING_PAYMENT', 'PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status)) {
    return false;
  }
  const start = new Date(preorder.scheduled_start_at);
  if (isNaN(start.getTime())) return false;
  const scheduledDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(start);
  const nowDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  return nowDateStr <= scheduledDateStr;
}

export function getCheckinWindowStatus(preorder: CustomerPreorder, nowMs = Date.now()): {
  canRequest: boolean;
  canCheckIn: boolean;
  isEarly: boolean;
  isExpired: boolean;
  windowStart: Date;
  windowEnd: Date;
  reason?: string;
} {
  const start = new Date(preorder.scheduled_start_at);
  const startTime = isNaN(start.getTime()) ? nowMs : start.getTime();
  const scheduledDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(startTime));
  const nowDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(nowMs));
  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: 'numeric',
  }).formatToParts(new Date(nowMs));
  const currentHour = Number(nowParts.find((p) => p.type === 'hour')?.value || 0);

  const isEarlyDate = nowDateStr < scheduledDateStr;
  const isPastDate = nowDateStr > scheduledDateStr;
  const isSameDate = nowDateStr === scheduledDateStr;
  const isBeforeOperatingHours = isSameDate && currentHour < 8;

  const isEarly = isEarlyDate || isBeforeOperatingHours;
  const isExpired = isPastDate;

  const validStatus = preorder.status === 'CONFIRMED';
  const canCheckIn = validStatus && isSameDate && currentHour >= 8;
  const canRequest = canCheckIn;

  const [y, m, d] = scheduledDateStr.split('-').map(Number);
  const windowStart = new Date(Date.UTC(y, m - 1, d, 1, 0, 0)); // 08:00 VN = 01:00 UTC
  const windowEnd = new Date(Date.UTC(y, m - 1, d, 17, 0, 0)); // 24:00 VN = 17:00 UTC

  let reason = '';
  if (!validStatus) {
    if (preorder.status === 'CHECKED_IN') reason = 'Đã check-in thành công';
    else if (preorder.status === 'COMPLETED') reason = 'Đơn đã hoàn thành';
    else if (preorder.status === 'PENDING_MANAGER_CONFIRMATION') reason = 'Chờ cửa hàng xác nhận';
    else reason = 'Chưa thể check-in';
  } else if (isEarlyDate) {
    reason = `Chưa đến ngày nhận (${scheduledDateStr.split('-').reverse().join('/')})`;
  } else if (isPastDate) {
    reason = 'Đã quá ngày nhận';
  } else if (isBeforeOperatingHours) {
    reason = 'Check-in mở từ 08:00 đến 24:00';
  }

  return { canRequest, canCheckIn, isEarly, isExpired, windowStart, windowEnd, reason };
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

  let checkin_request: CustomerPreorder['checkin_request'] = null;
  if (raw.checkin_request && typeof raw.checkin_request === 'object') {
    checkin_request = {
      id: Number(raw.checkin_request.id) || 0,
      status: String(raw.checkin_request.status || '').trim(),
      requested_at: String(raw.checkin_request.requested_at || '').trim(),
      late_confirmation_reason: raw.checkin_request.late_confirmation_reason ? String(raw.checkin_request.late_confirmation_reason).trim() : null,
      rejection_reason: raw.checkin_request.rejection_reason ? String(raw.checkin_request.rejection_reason).trim() : null,
    };
  }

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
    checkin_request,
    orders,
  };
}

export function normalizeCustomerPreorders(rawList: any): CustomerPreorder[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map(normalizeCustomerPreorder)
    .filter((item): item is CustomerPreorder => item !== null && !['AWAITING_PAYMENT', 'PAYMENT_EXPIRED'].includes(item.status));
}

import { PollingController } from '@/lib/polling-controller';

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
  const [requestingCheckin, setRequestingCheckin] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef(false);
  const inFlightSessionKeyRef = useRef<string | null>(null);
  const sessionKeyRef = useRef<string | null>(sessionKey);
  const controllerRef = useRef<PollingController | null>(null);

  // Keep the identity boundary current during render so a late response from
  // a previous customer cannot commit before the effect below has run.
  sessionKeyRef.current = sessionKey;

  useEffect(() => {
    setRows([]);
    setError(null);
    setCancelling(null);
    setRequestingCheckin(null);
    setPage(1);
    setTotalPages(1);
    hasLoadedRef.current = false;
    inFlightRef.current = false;
    inFlightSessionKeyRef.current = null;
  }, [sessionKey]);

  const load = useCallback(async (isBackground = false) => {
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
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      // apiGet<{ preorders?: unknown }>('/api/preorders/mine')
      const result = await apiGet<{ preorders?: unknown; items?: unknown; pagination?: { page: number; limit: number; totalItems: number; totalPages: number } }>(
        `/api/preorders/mine?page=${page}&limit=6`
      );
      if (sessionKeyRef.current !== requestSessionKey) return;
      const rawList = result?.items ?? result?.preorders;
      if (Array.isArray(rawList)) {
        setRows(normalizeCustomerPreorders(rawList));
      } else {
        setRows([]);
      }
      if (result?.pagination) {
        const tp = Math.max(1, result.pagination.totalPages || 1);
        setTotalPages(tp);
        if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
          setPage(result.pagination.totalPages);
        }
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
      if (sessionKeyRef.current === requestSessionKey && !isBackground) setLoading(false);
      if (inFlightSessionKeyRef.current === requestSessionKey) {
        inFlightRef.current = false;
        inFlightSessionKeyRef.current = null;
      }
    }
  }, [page, session]);

  useEffect(() => {
    if (isActive && session) {
      void load();
    }
  }, [isActive, load, session]);

  useEffect(() => {
    if (!isActive || !session) {
      if (controllerRef.current) {
        controllerRef.current.stop();
        controllerRef.current = null;
      }
      return;
    }

    const controller = new PollingController({
      fetchFn: async () => {
        await load(true);
      },
      visibleIntervalMs: 5_000,
      hiddenIntervalMs: 60_000,
      backoffEnabled: true,
    });
    controllerRef.current = controller;
    controller.start();

    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, [isActive, load, session]);

  const activeHighlightedCode = useMemo(() => highlightedCode?.trim() || null, [highlightedCode]);

  async function handleCheckin(preorder: CustomerPreorder) {
    if (requestingCheckin !== null) return;
    setRequestingCheckin(preorder.id);
    try {
      await apiPost(`/api/preorders/${encodeURIComponent(preorder.preorder_code)}/check-in`, {});
      toast.success('Check-in thành công! Quý khách vui lòng chờ nhân viên bàn giao món.');
      controllerRef.current?.triggerImmediate() || void load();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Không thể thực hiện check-in.');
    } finally {
      setRequestingCheckin(null);
    }
  }

  const handleCheckinRequest = handleCheckin;

  async function handleCancel(preorder: CustomerPreorder) {
    if (cancelling !== null) return;
    setCancelling(preorder.id);
    try {
      await apiPost(`/api/preorders/${encodeURIComponent(preorder.preorder_code)}/cancel`, {});
      toast.success('Đã hủy preorder. Lịch sử thanh toán được giữ nguyên.');
      controllerRef.current?.triggerImmediate() || void load();
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
        const opBadge = getPreorderOperationalBadge(preorder);
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
              <Badge className={opBadge.tone}>{opBadge.label}</Badge>
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
                  Hình thức phục vụ
                </p>
                <p className="mt-1 font-medium text-sm">
                  Nhận tại cửa hàng (Store Pickup)
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">{presentation.description}</p>

            {preorder.checkin_request?.status === 'PENDING' ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800">
                <Loader2 className="size-4 animate-spin text-sky-600 shrink-0" />
                <span>Đã gửi yêu cầu check-in · Đang chờ Quản lý xác nhận</span>
              </div>
            ) : null}

            {preorder.checkin_request?.status === 'REJECTED' ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                <p className="font-semibold">Yêu cầu check-in bị từ chối: {preorder.checkin_request.rejection_reason || 'Vui lòng liên hệ nhân viên'}</p>
                <p className="mt-0.5 text-rose-600">Bạn có thể liên hệ trực tiếp nhân viên quầy để được hỗ trợ.</p>
              </div>
            ) : null}

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

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {preorder.status === 'CONFIRMED' ? (
                (() => {
                  const { canCheckIn, isEarly, isExpired, reason } = getCheckinWindowStatus(preorder);
                  if (canCheckIn) {
                    return (
                      <Button
                        size="sm"
                        disabled={requestingCheckin === preorder.id}
                        onClick={() => void handleCheckin(preorder)}
                        className="bg-primary text-primary-foreground font-semibold"
                      >
                        {requestingCheckin === preorder.id ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <CalendarClock className="mr-2 size-4" />
                        )}
                        {requestingCheckin === preorder.id ? 'Đang check-in…' : 'Check-in tại quán'}
                      </Button>
                    );
                  }
                  return (
                    <span className="text-xs text-muted-foreground italic">
                      {reason || (isEarly ? 'Chưa đến giờ check-in (từ 08:00)' : isExpired ? 'Đã hết hạn check-in' : 'Chưa mở check-in')}
                    </span>
                  );
                })()
              ) : null}

              {preorder.status === 'CHECKED_IN' ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                  <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Đã check-in thành công · Chờ cửa hàng bàn giao món
                </div>
              ) : null}

              {preorder.status === 'COMPLETED' ? (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  <Link to="/ho-so" search={{ tab: 'orders' }}>
                    Đánh giá món
                  </Link>
                </Button>
              ) : null}

              {canCancel(preorder) ? (
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
              ) : null}
            </div>
          </article>
        );
      })}

      {rows.length > 0 && (
        <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
          <span>
            Trang {page} / {Math.max(1, totalPages)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
              disabled={page >= totalPages || loading}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
