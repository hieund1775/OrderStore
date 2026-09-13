import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarClock, CheckCircle2, RefreshCw, Settings2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet, apiPost, apiPut, getUser } from '@/lib/api';

export const Route = createFileRoute('/admin/dat-truoc')({ component: AdminPreordersPage });

type Preorder = {
  id: number;
  preorder_code: string;
  status: string;
  store_name?: string;
  scheduled_start_at: string;
  customer_name?: string;
  reschedule_count: number;
  checked_in_at?: string | null;
  late_minutes?: number | null;
  checkin_request?: {
    id: number;
    status: string;
    requested_at: string;
    late_confirmation_reason?: string | null;
    rejection_reason?: string | null;
  } | null;
  orders?: { id: number; order_code: string; items: { id: number; product_name: string; qty: number; size_label?: string }[] }[];
};

type EligibleManager = { id: number; fullname: string };
type PreorderStoreSetting = {
  store_id: number;
  store_name: string;
  store_is_active: boolean;
  is_enabled: boolean;
  responsible_manager_id: number | null;
  eligible_managers: EligibleManager[];
};
type SettingDraft = { isEnabled: boolean; managerId: string };

const UNASSIGNED_MANAGER = '__unassigned__';

function settingsToDrafts(settings: PreorderStoreSetting[]) {
  return Object.fromEntries(settings.map((setting) => [
    setting.store_id,
    {
      isEnabled: setting.is_enabled === true,
      managerId: setting.responsible_manager_id == null ? UNASSIGNED_MANAGER : String(setting.responsible_manager_id),
    },
  ])) as Record<number, SettingDraft>;
}

function AdminPreordersPage() {
  const user = getUser();
  const isSuper = user?.role === 'super';
  const [rows, setRows] = useState<Preorder[]>([]);
  const [view, setView] = useState<'pending' | 'confirmed' | 'checked-in' | 'today' | 'upcoming' | 'archive'>('pending');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [storeFilter, setStoreFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleHour, setRescheduleHour] = useState('');
  const [reason, setReason] = useState('');
  const [checkingInId, setCheckingInId] = useState<number | null>(null);
  const [rejectModalPreorderId, setRejectModalPreorderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [lateReasonModalPreorderId, setLateReasonModalPreorderId] = useState<number | null>(null);
  const [lateReason, setLateReason] = useState('');
  const [settings, setSettings] = useState<PreorderStoreSetting[]>([]);
  const [settingDrafts, setSettingDrafts] = useState<Record<number, SettingDraft>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingStoreId, setSavingStoreId] = useState<number | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ view });
    if (isSuper && storeFilter !== 'all') params.set('store_id', storeFilter);
    return `?${params.toString()}`;
  }, [isSuper, storeFilter, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiGet<Preorder[]>(`/admin/preorders${query}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải preorder');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadSettings = useCallback(async () => {
    if (!isSuper) return;
    setSettingsLoading(true);
    try {
      const response = await apiGet<{ stores: PreorderStoreSetting[] }>('/admin/preorders/settings');
      const stores = Array.isArray(response.stores) ? response.stores : [];
      setSettings(stores);
      setSettingDrafts(settingsToDrafts(stores));
      setSettingsError(null);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Không thể tải cấu hình nhận đặt trước.');
    } finally {
      setSettingsLoading(false);
    }
  }, [isSuper]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadSettings(); }, [loadSettings]);
  useEffect(() => {
    if (!isSuper) return;
    apiGet<{ id: number; name: string }[]>('/admin/branches')
      .then((items) => setBranches(Array.isArray(items) ? items : []))
      .catch(() => setBranches([]));
  }, [isSuper]);

  async function confirm(id: number) {
    try {
      await apiPost(`/admin/preorders/${id}/confirm`, {});
      toast.success('Đã xác nhận preorder và tạo việc vận hành.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xác nhận');
    }
  }

  function handleCheckInClick(preorder: Preorder) {
    if (checkingInId !== null) return;
    const startTime = new Date(preorder.scheduled_start_at).getTime();
    const isPastT30 = Date.now() > startTime + 30 * 60_000;
    if (isPastT30) {
      setLateReasonModalPreorderId(preorder.id);
      setLateReason('');
      return;
    }
    void doCheckIn(preorder.id, null);
  }

  async function doCheckIn(id: number, lateReasonText: string | null) {
    setCheckingInId(id);
    try {
      await apiPost(`/admin/preorders/${id}/check-in`, {
        late_confirmation_reason: lateReasonText || undefined,
      });
      toast.success('Đã check-in thành công.');
      setLateReasonModalPreorderId(null);
      setLateReason('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể check-in');
    } finally {
      setCheckingInId(null);
    }
  }

  async function doRejectCheckIn() {
    if (!rejectModalPreorderId || !rejectReason.trim() || rejecting) return;
    setRejecting(true);
    try {
      await apiPost(`/admin/preorders/${rejectModalPreorderId}/check-in/reject`, {
        reason: rejectReason.trim(),
      });
      toast.success('Đã từ chối yêu cầu check-in.');
      setRejectModalPreorderId(null);
      setRejectReason('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể từ chối check-in');
    } finally {
      setRejecting(false);
    }
  }

  async function reschedule() {
    if (!rescheduleId || !reason.trim() || !rescheduleDate || !rescheduleHour) return;
    try {
      await apiPost(`/admin/preorders/${rescheduleId}/reschedule`, {
        scheduled_date: rescheduleDate,
        scheduled_hour: Number(rescheduleHour),
        reason,
      });
      toast.success('Đã lưu lịch hẹn mới.');
      setRescheduleId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đổi lịch');
    }
  }

  function updateSettingDraft(storeId: number, patch: Partial<SettingDraft>) {
    setSettingDrafts((current) => ({
      ...current,
      [storeId]: { isEnabled: false, managerId: UNASSIGNED_MANAGER, ...current[storeId], ...patch },
    }));
  }

  async function saveSetting(setting: PreorderStoreSetting) {
    const draft = settingDrafts[setting.store_id] || {
      isEnabled: setting.is_enabled,
      managerId: setting.responsible_manager_id == null ? UNASSIGNED_MANAGER : String(setting.responsible_manager_id),
    };
    if (draft.isEnabled && draft.managerId === UNASSIGNED_MANAGER) {
      toast.error('Cần chọn Manager đang hoạt động thuộc đúng chi nhánh trước khi bật đặt trước.');
      return;
    }
    setSavingStoreId(setting.store_id);
    try {
      await apiPut(`/admin/preorders/settings/${setting.store_id}`, {
        is_enabled: draft.isEnabled,
        responsible_manager_id: draft.isEnabled ? Number(draft.managerId) : null,
      });
      toast.success(draft.isEnabled ? `Đã bật đặt trước cho ${setting.store_name}.` : `Đã tắt đặt trước cho ${setting.store_name}.`);
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu cấu hình preorder.');
    } finally {
      setSavingStoreId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Đơn đặt trước</h1>
          <p className="text-muted-foreground text-sm">Thanh toán xong vẫn cần Manager xác nhận trước khi Bếp thấy đơn.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-4" />Làm mới
        </Button>
      </div>

      {isSuper && (
        <details className="group rounded-xl border bg-card p-4">
          <summary className="flex cursor-pointer list-none items-start gap-2">
            <Settings2 className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Cấu hình nhận đặt trước theo chi nhánh</h2>
              <p className="text-sm text-muted-foreground">Chỉ chi nhánh được bật và có một Manager đang hoạt động đúng branch mới nhận preorder.</p>
            </div>
          </summary>
          <div className="mt-3 space-y-3">
          {settingsLoading ? <p className="text-sm text-muted-foreground">Đang tải cấu hình…</p> : null}
          {settingsError ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <span>{settingsError}</span>
              <Button size="sm" variant="outline" onClick={() => void loadSettings()}>Thử lại</Button>
            </div>
          ) : null}
          {!settingsLoading && !settingsError && settings.map((setting) => {
            const draft = settingDrafts[setting.store_id] || {
              isEnabled: setting.is_enabled,
              managerId: setting.responsible_manager_id == null ? UNASSIGNED_MANAGER : String(setting.responsible_manager_id),
            };
            const noEligibleManager = setting.eligible_managers.length === 0;
            const cannotSave = savingStoreId === setting.store_id || (draft.isEnabled && (noEligibleManager || draft.managerId === UNASSIGNED_MANAGER));
            return (
              <article key={setting.store_id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_auto] md:items-end">
                <div>
                  <p className="font-medium">{setting.store_name}</p>
                  <p className="text-xs text-muted-foreground">{draft.isEnabled ? 'Đang nhận đặt trước' : 'Chưa nhận đặt trước'}</p>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={draft.isEnabled} onChange={(event) => updateSettingDraft(setting.store_id, { isEnabled: event.target.checked })} />
                    Bật nhận đặt trước
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium">Manager phụ trách</label>
                  <Select value={draft.managerId} onValueChange={(managerId) => updateSettingDraft(setting.store_id, { managerId })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn Manager" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_MANAGER}>Chưa gán Manager</SelectItem>
                      {setting.eligible_managers.map((manager) => <SelectItem key={manager.id} value={String(manager.id)}>{manager.fullname}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {noEligibleManager ? <p className="mt-1 text-xs text-destructive">Không có Manager đang hoạt động thuộc chi nhánh này; không thể bật preorder.</p> : null}
                </div>
                <Button disabled={cannotSave} onClick={() => void saveSetting(setting)}>
                  {savingStoreId === setting.store_id ? 'Đang lưu…' : 'Lưu cấu hình'}
                </Button>
              </article>
            );
          })}
          {!settingsLoading && !settingsError && settings.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có chi nhánh đang hoạt động để cấu hình.</p> : null}
          </div>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
        {(['pending', 'confirmed', 'checked-in', 'today', 'upcoming', 'archive'] as const).map((candidate) => (
          <Button key={candidate} variant={view === candidate ? 'default' : 'outline'} onClick={() => setView(candidate)}>
            {candidate === 'pending' ? 'Chờ xác nhận' : candidate === 'confirmed' ? 'Chờ check-in' : candidate === 'checked-in' ? 'Đang xử lý' : candidate === 'today' ? 'Hôm nay' : candidate === 'upcoming' ? 'Sắp tới' : 'Lưu trữ'}
          </Button>
        ))}
        </div>
        {isSuper ? <Select value={storeFilter} onValueChange={setStoreFilter}><SelectTrigger className="w-52"><SelectValue placeholder="Lọc chi nhánh" /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả chi nhánh</SelectItem>{branches.map((branch) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}</SelectContent></Select> : null}
      </div>

      {loading ? <p className="text-muted-foreground">Đang tải…</p> : rows.length === 0 ? <p className="rounded-xl border p-8 text-center text-muted-foreground">Không có preorder phù hợp.</p> : (
        <div className="grid gap-3">
          {rows.map((preorder) => (
            <article key={preorder.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{preorder.preorder_code} · {preorder.status}</div>
                  <div className="text-sm text-muted-foreground">{new Date(preorder.scheduled_start_at).toLocaleString('vi-VN')} · {preorder.store_name || 'Chi nhánh'} · {preorder.customer_name || 'Khách hàng'}</div>
                  {preorder.late_minutes ? <div className="text-sm text-amber-700">Muộn {preorder.late_minutes} phút</div> : null}
                  {preorder.checkin_request?.status === 'PENDING' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1.5 py-1 px-2.5">
                        <Loader2 className="size-3.5 animate-spin text-amber-700 shrink-0" />
                        Khách đã yêu cầu check-in lúc {new Date(preorder.checkin_request.requested_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                    </div>
                  ) : null}
                  {preorder.checkin_request?.status === 'REJECTED' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="border-rose-300 text-rose-800 bg-rose-50">
                        Đã từ chối check-in: {preorder.checkin_request.rejection_reason || 'Không rõ lý do'}
                      </Badge>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {preorder.status === 'PENDING_MANAGER_CONFIRMATION' && <Button onClick={() => void confirm(preorder.id)}><CheckCircle2 className="mr-1 size-4" />Xác nhận</Button>}
                  {preorder.status === 'CONFIRMED' && (
                    preorder.checkin_request?.status === 'PENDING' ? (
                      <>
                        <Button
                          variant="default"
                          disabled={checkingInId === preorder.id}
                          onClick={() => handleCheckInClick(preorder)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {checkingInId === preorder.id ? (
                            <Loader2 className="mr-1 size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 size-4" />
                          )}
                          Check-in
                        </Button>
                        <Button
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setRejectModalPreorderId(preorder.id);
                            setRejectReason('');
                          }}
                        >
                          <XCircle className="mr-1 size-4" />
                          Từ chối
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" disabled title="Khách hàng chưa gửi yêu cầu check-in">
                        Chờ khách check-in
                      </Button>
                    )
                  )}
                  {['PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status) && preorder.reschedule_count === 0 && <Button variant="outline" onClick={() => setRescheduleId(preorder.id)}><CalendarClock className="mr-1 size-4" />Đổi lịch</Button>}
                </div>
              </div>
              {preorder.status === 'CONFIRMED' ? <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">Bếp chỉ xem lịch preorder này. Đơn chưa vào màn hình pha chế và chưa thể hoàn thành cho đến khi khách check-in.</p> : null}
              {preorder.status === 'CHECKED_IN' ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Khách đã check-in; các đơn liên kết đã được mở để Bếp xử lý trong KDS.</p> : null}
              {preorder.orders?.length ? <details className="mt-3 rounded-lg border"><summary className="cursor-pointer p-3 text-sm font-medium">Xem món đã đặt ({preorder.orders.reduce((total, order) => total + order.items.length, 0)})</summary><div className="space-y-2 border-t p-3 text-sm">{preorder.orders.flatMap((order) => order.items.map((item) => <p key={item.id}>{item.qty}× {item.product_name}{item.size_label ? ` · ${item.size_label}` : ''}</p>))}</div></details> : null}
              {rescheduleId === preorder.id && (
                <div className="mt-4 grid gap-2 rounded-lg bg-muted p-3 md:grid-cols-4">
                  <Input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
                  <Select value={rescheduleHour} onValueChange={setRescheduleHour}>
                    <SelectTrigger><SelectValue placeholder="Giờ" /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 14 }, (_, index) => index + 9).map((hour) => <SelectItem key={hour} value={String(hour)}>{String(hour).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Lý do, đã thỏa thuận với khách" value={reason} onChange={(event) => setReason(event.target.value)} />
                  <Button onClick={() => void reschedule()}>Lưu đổi lịch</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {isSuper && <p className="text-xs text-muted-foreground">Super xử lý incident/strike trong quản trị; re-enable Manager dùng luồng Tài khoản canonical.</p>}

      {lateReasonModalPreorderId && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setLateReasonModalPreorderId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xác nhận check-in sau thời hạn T+30</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Khung giờ hẹn đã quá 30 phút. Vui lòng nhập lý do xác nhận muộn để lưu vào nhật ký kiểm toán.
              </p>
              <Input
                placeholder="Ví dụ: Giờ cao điểm tại quầy, phục vụ dồn toa..."
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLateReasonModalPreorderId(null)}>
                Hủy
              </Button>
              <Button
                disabled={!lateReason.trim() || checkingInId !== null}
                onClick={() => void doCheckIn(lateReasonModalPreorderId, lateReason)}
              >
                {checkingInId !== null ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Xác nhận check-in
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {rejectModalPreorderId && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setRejectModalPreorderId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Từ chối yêu cầu check-in</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Khách hàng sẽ nhận được thông báo từ chối kèm lý do này.
              </p>
              <Input
                placeholder="Nhập lý do từ chối check-in..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectModalPreorderId(null)}>
                Hủy
              </Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || rejecting}
                onClick={() => void doRejectCheckIn()}
              >
                {rejecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Từ chối check-in
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
