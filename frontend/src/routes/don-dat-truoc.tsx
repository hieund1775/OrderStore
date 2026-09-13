import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarClock, ChevronDown, CircleAlert, ClipboardList, MapPin, PackageOpen, RefreshCw, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet, apiPost, getCustomerToken } from '@/lib/api';
import { vnd } from '@/lib/data';

export const Route = createFileRoute('/don-dat-truoc')({
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === 'string' ? search.code : undefined,
  }),
  component: CustomerPreordersPage,
});

type PreorderItem = {
  id: number;
  product_name: string;
  qty: number;
  size_label?: string;
  note?: string | null;
  line_total?: number;
  toppings?: { name: string }[];
};

type LinkedOrder = {
  id: number;
  order_code: string;
  current_status?: string | null;
  total?: number;
  items: PreorderItem[];
};

type CustomerPreorder = {
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

const statusPresentation: Record<string, { label: string; tone: string; description: string }> = {
  AWAITING_PAYMENT: { label: 'Chờ thanh toán', tone: 'bg-amber-100 text-amber-800', description: 'Đơn sẽ được gửi tới cửa hàng sau khi thanh toán được xác nhận.' },
  PENDING_MANAGER_CONFIRMATION: { label: 'Đã thanh toán · chờ xác nhận', tone: 'bg-sky-100 text-sky-800', description: 'Manager cửa hàng đang xác nhận thời gian phục vụ.' },
  CONFIRMED: { label: 'Đã xác nhận · chờ check-in', tone: 'bg-violet-100 text-violet-800', description: 'Hãy đến cửa hàng trong cửa sổ check-in của khung giờ đã đặt.' },
  CHECKED_IN: { label: 'Đã check-in · quán đang xử lý', tone: 'bg-emerald-100 text-emerald-800', description: 'Đơn đã được mở cho Bếp xử lý.' },
  COMPLETED: { label: 'Hoàn thành', tone: 'bg-emerald-100 text-emerald-800', description: 'Cảm ơn bạn đã sử dụng dịch vụ.' },
  CUSTOMER_CANCELLED: { label: 'Đã hủy', tone: 'bg-slate-100 text-slate-700', description: 'Lịch sử thanh toán vẫn được lưu; hệ thống không tự hoàn tiền.' },
  NO_SHOW: { label: 'Không đến nhận', tone: 'bg-rose-100 text-rose-800', description: 'Đã quá thời hạn check-in cho khung giờ này.' },
  PAYMENT_EXPIRED: { label: 'Thanh toán đã hết hạn', tone: 'bg-slate-100 text-slate-700', description: 'Hãy tạo một preorder mới nếu vẫn cần đặt trước.' },
  LATE_PAID_REQUIRES_ACTION: { label: 'Thanh toán muộn · cần cửa hàng xử lý', tone: 'bg-rose-100 text-rose-800', description: 'Cửa hàng sẽ liên hệ để xử lý đơn này.' },
};

function formatSlot(preorder: CustomerPreorder) {
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'full', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const start = new Date(preorder.scheduled_start_at);
  const end = new Date(preorder.scheduled_end_at);
  return `${formatter.format(start)} – ${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(end)}`;
}

function canCancel(preorder: CustomerPreorder) {
  return ['AWAITING_PAYMENT', 'PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status)
    && new Date(preorder.scheduled_start_at).getTime() > Date.now();
}

function CustomerPreordersPage() {
  const search = Route.useSearch();
  const [rows, setRows] = useState<CustomerPreorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<number | null>(null);
  // Read browser storage after hydration, matching the existing customer
  // header/session pattern and avoiding SSR/client markup divergence.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => { setIsAuthenticated(Boolean(getCustomerToken())); }, []);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await apiGet<{ preorders: CustomerPreorder[] }>('/api/preorders/mine');
      setRows(Array.isArray(result.preorders) ? result.preorders : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải đơn đặt trước.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { void load(); }, [load]);

  const highlightedCode = useMemo(() => search.code?.trim() || null, [search.code]);

  async function cancel(preorder: CustomerPreorder) {
    setCancelling(preorder.id);
    try {
      await apiPost(`/api/preorders/${encodeURIComponent(preorder.preorder_code)}/cancel`, {});
      toast.success('Đã hủy preorder. Lịch sử thanh toán được giữ nguyên.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể hủy preorder.');
    } finally {
      setCancelling(null);
    }
  }

  if (!isAuthenticated) {
    return <div className="container-page max-w-3xl py-10">
      <section className="rounded-xl border bg-card p-6 text-center">
        <ClipboardList className="mx-auto mb-3 size-8 text-primary" />
        <h1 className="text-2xl font-bold">Đơn đặt trước của tôi</h1>
        <p className="mt-2 text-sm text-muted-foreground">Đăng nhập để theo dõi lịch nhận món, trạng thái xác nhận và các món đã đặt.</p>
        <Button className="mt-4" asChild><Link to="/ho-so">Đăng nhập</Link></Button>
      </section>
    </div>;
  }

  return <div className="container-page max-w-4xl space-y-5 py-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-3"><CalendarClock className="mt-1 size-7 text-primary" /><div><h1 className="text-2xl font-bold">Đơn đặt trước của tôi</h1><p className="text-sm text-muted-foreground">Theo dõi riêng lịch nhận món; đơn đặt trước không lẫn với lịch sử đơn thông thường.</p></div></div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 size-4" />Làm mới</Button>
    </header>

    {loading ? <p className="rounded-xl border p-8 text-center text-muted-foreground">Đang tải đơn đặt trước…</p> : null}
    {!loading && rows.length === 0 ? <section className="rounded-xl border bg-card p-8 text-center"><PackageOpen className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="font-semibold">Chưa có đơn đặt trước</h2><p className="mt-1 text-sm text-muted-foreground">Bạn có thể chọn món và lịch nhận tại cửa hàng.</p><Button className="mt-4" asChild><Link to="/dat-truoc">Tạo đơn đặt trước</Link></Button></section> : null}
    {!loading && rows.map((preorder) => {
      const presentation = statusPresentation[preorder.status] || { label: preorder.status, tone: 'bg-muted text-muted-foreground', description: 'Đang cập nhật trạng thái.' };
      return <article key={preorder.id} id={highlightedCode === preorder.preorder_code ? 'preorder-highlight' : undefined} className={`rounded-xl border bg-card p-5 ${highlightedCode === preorder.preorder_code ? 'ring-2 ring-primary/50' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-semibold">{preorder.preorder_code}</p><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{preorder.store_name}</p></div>
          <Badge className={presentation.tone}>{presentation.label}</Badge>
        </div>
        <div className="mt-4 grid gap-3 rounded-lg bg-muted/45 p-3 sm:grid-cols-2">
          <div><p className="text-xs font-medium text-muted-foreground">LỊCH NHẬN MÓN</p><p className="mt-1 font-medium">{formatSlot(preorder)}</p></div>
          <div><p className="text-xs font-medium text-muted-foreground">BÀN</p><p className="mt-1 font-medium">{preorder.table_name || 'Cửa hàng sẽ sắp xếp bàn'}</p></div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{presentation.description}</p>
        {preorder.late_minutes != null && preorder.late_minutes > 0 ? <p className="mt-2 text-sm text-amber-700">Bạn đã check-in muộn {preorder.late_minutes} phút.</p> : null}
        {preorder.cancel_reason ? <p className="mt-2 text-sm text-muted-foreground">Lý do hủy: {preorder.cancel_reason}</p> : null}

        <details className="mt-4 rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 font-medium"><span>Món đã đặt ({preorder.orders.reduce((sum, order) => sum + order.items.length, 0)})</span><ChevronDown className="size-4" /></summary>
          <div className="space-y-3 border-t p-3">
            {preorder.orders.map((order) => <div key={order.id} className="space-y-2"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">Đơn {order.order_code}</span><span className="text-muted-foreground">{order.current_status || 'Đang chờ cập nhật'}</span></div>{order.items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><div><span className="font-medium">{item.qty}× {item.product_name}</span>{item.size_label ? <span className="text-muted-foreground"> · {item.size_label}</span> : null}{item.toppings?.length ? <p className="text-xs text-muted-foreground">{item.toppings.map((topping) => topping.name).join(', ')}</p> : null}{item.note ? <p className="text-xs text-muted-foreground">Ghi chú: {item.note}</p> : null}</div><span>{vnd(item.line_total || 0)}</span></div>)}</div>)}
            {preorder.orders.length === 0 ? <p className="text-sm text-muted-foreground">Đơn đang chờ thanh toán nên chưa có chi tiết món để xử lý.</p> : null}
          </div>
        </details>
        {canCancel(preorder) ? <div className="mt-4 flex justify-end"><Button variant="outline" className="text-destructive" disabled={cancelling === preorder.id} onClick={() => void cancel(preorder)}><CircleAlert className="mr-2 size-4" />{cancelling === preorder.id ? 'Đang hủy…' : 'Hủy preorder'}</Button></div> : null}
      </article>;
    })}
  </div>;
}
