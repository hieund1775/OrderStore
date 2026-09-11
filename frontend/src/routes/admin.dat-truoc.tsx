import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet, apiPost, getUser } from '@/lib/api';

export const Route = createFileRoute('/admin/dat-truoc')({ component: AdminPreordersPage });

type Preorder = { id: number; preorder_code: string; status: string; store_name?: string; scheduled_start_at: string; customer_name?: string; reschedule_count: number; checked_in_at?: string | null; late_minutes?: number | null };

function AdminPreordersPage() {
  const user = getUser();
  const [rows, setRows] = useState<Preorder[]>([]);
  const [view, setView] = useState<'pending' | 'today' | 'upcoming'>('pending');
  const [loading, setLoading] = useState(true);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleHour, setRescheduleHour] = useState('');
  const [reason, setReason] = useState('');

  const query = useMemo(() => view === 'pending' ? '?view=pending' : '', [view]);
  async function load() {
    setLoading(true);
    try { setRows(await apiGet<Preorder[]>(`/admin/preorders${query}`)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể tải preorder'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [query]);

  async function confirm(id: number) { try { await apiPost(`/admin/preorders/${id}/confirm`, {}); toast.success('Đã xác nhận preorder và tạo việc vận hành.'); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể xác nhận'); } }
  async function checkIn(id: number) { try { await apiPost(`/admin/preorders/${id}/check-in`, {}); toast.success('Đã check-in.'); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể check-in'); } }
  async function reschedule() {
    if (!rescheduleId || !reason.trim() || !rescheduleDate || !rescheduleHour) return;
    try { await apiPost(`/admin/preorders/${rescheduleId}/reschedule`, { scheduled_date: rescheduleDate, scheduled_hour: Number(rescheduleHour), reason }); toast.success('Đã lưu lịch hẹn mới.'); setRescheduleId(null); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể đổi lịch'); }
  }

  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Đơn đặt trước</h1><p className="text-muted-foreground text-sm">Thanh toán xong vẫn cần Manager xác nhận trước khi Bếp thấy đơn.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 size-4" />Làm mới</Button></div>
    <div className="flex gap-2">{(['pending','today','upcoming'] as const).map((candidate) => <Button key={candidate} variant={view === candidate ? 'default' : 'outline'} onClick={() => setView(candidate)}>{candidate === 'pending' ? 'Chờ xác nhận' : candidate === 'today' ? 'Hôm nay' : 'Sắp tới'}</Button>)}</div>
    {loading ? <p className="text-muted-foreground">Đang tải…</p> : rows.length === 0 ? <p className="rounded-xl border p-8 text-center text-muted-foreground">Không có preorder phù hợp.</p> : <div className="grid gap-3">{rows.map((preorder) => <article key={preorder.id} className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{preorder.preorder_code} · {preorder.status}</div><div className="text-sm text-muted-foreground">{new Date(preorder.scheduled_start_at).toLocaleString('vi-VN')} · {preorder.store_name || 'Chi nhánh'} · {preorder.customer_name || 'Khách hàng'}</div>{preorder.late_minutes ? <div className="text-sm text-amber-700">Muộn {preorder.late_minutes} phút</div> : null}</div><div className="flex flex-wrap gap-2">{preorder.status === 'PENDING_MANAGER_CONFIRMATION' && <Button onClick={() => void confirm(preorder.id)}><CheckCircle2 className="mr-1 size-4" />Xác nhận</Button>}{preorder.status === 'CONFIRMED' && <Button variant="secondary" onClick={() => void checkIn(preorder.id)}>Check-in</Button>}{['PENDING_MANAGER_CONFIRMATION','CONFIRMED'].includes(preorder.status) && preorder.reschedule_count === 0 && <Button variant="outline" onClick={() => setRescheduleId(preorder.id)}><CalendarClock className="mr-1 size-4" />Đổi lịch</Button>}</div></div>
      {rescheduleId === preorder.id && <div className="mt-4 grid gap-2 rounded-lg bg-muted p-3 md:grid-cols-4"><Input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} /><Select value={rescheduleHour} onValueChange={setRescheduleHour}><SelectTrigger><SelectValue placeholder="Giờ" /></SelectTrigger><SelectContent>{Array.from({ length: 14 }, (_, index) => index + 9).map((hour) => <SelectItem key={hour} value={String(hour)}>{String(hour).padStart(2, '0')}:00</SelectItem>)}</SelectContent></Select><Input placeholder="Lý do, đã thỏa thuận với khách" value={reason} onChange={(event) => setReason(event.target.value)} /><Button onClick={() => void reschedule()}>Lưu đổi lịch</Button></div>}</article>)}</div>}
    {user?.role === 'super' && <p className="text-xs text-muted-foreground">Super xử lý incident/strike trong quản trị; re-enable Manager dùng luồng Tài khoản canonical.</p>}
  </div>;
}
