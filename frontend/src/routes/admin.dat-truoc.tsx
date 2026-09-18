import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarClock, CheckCircle2, Settings2, Loader2, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet, apiPost, apiPut, getUser } from '@/lib/api';
import { PollingController } from '@/lib/polling-controller';

export const Route = createFileRoute('/admin/dat-truoc')({ component: AdminPreordersPage });

type ReviewItem = {
  id: number;
  product_name?: string;
  rating: number;
  comment?: string;
  reply_comment?: string | null;
  created_at?: string;
};

type Preorder = {
  id: number;
  preorder_code: string;
  status: string;
  store_name?: string;
  scheduled_start_at: string;
  customer_name?: string;
  reschedule_count: number;
  checked_in_at?: string | null;
  handover_confirmed_at?: string | null;
  handover_overdue_at?: string | null;
  late_minutes?: number | null;
  orders?: {
    id: number;
    order_code: string;
    current_status?: string;
    items: { id: number; product_name: string; qty: number; size_label?: string; review?: ReviewItem }[];
  }[];
  reviews?: ReviewItem[];
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

export function AdminPreordersPage() {
  const user = getUser();
  const isSuper = user?.role === 'super';
  const [rows, setRows] = useState<Preorder[]>([]);
  const [view, setView] = useState<'pending' | 'check-in' | 'today' | 'upcoming' | 'archive'>('pending');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<'all' | 'COMPLETED' | 'CUSTOMER_CANCELLED' | 'NO_SHOW'>('all');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [storeFilter, setStoreFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const controllerRef = useRef<PollingController | null>(null);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleHour, setRescheduleHour] = useState('');
  const [reason, setReason] = useState('');
  const [handingOverId, setHandingOverId] = useState<number | null>(null);
  const [settings, setSettings] = useState<PreorderStoreSetting[]>([]);
  const [settingDrafts, setSettingDrafts] = useState<Record<number, SettingDraft>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingStoreId, setSavingStoreId] = useState<number | null>(null);

  useEffect(() => {
    setPage(1);
  }, [view, archiveStatusFilter, storeFilter]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ view, page: String(page), limit: '6' });
    if (view === 'archive' && archiveStatusFilter) {
      params.set('status', archiveStatusFilter);
    }
    if (isSuper && storeFilter !== 'all') params.set('store_id', storeFilter);
    return `?${params.toString()}`;
  }, [archiveStatusFilter, isSuper, page, storeFilter, view]);

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const data = await apiGet<{ items?: Preorder[]; pagination?: { page: number; limit: number; totalItems: number; totalPages: number } } | Preorder[]>(`/admin/preorders${query}`);
      let list: Preorder[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === 'object') {
        list = Array.isArray(data.items) ? data.items : [];
        if (data.pagination) {
          const tp = Math.max(1, data.pagination.totalPages || 1);
          setTotalPages(tp);
          if (data.pagination.totalPages > 0 && page > data.pagination.totalPages) {
            setPage(data.pagination.totalPages);
          }
        }
      }
      setRows(list);
    } catch (error) {
      if (!isBackground) {
        toast.error(error instanceof Error ? error.message : 'Không thể tải preorder');
      }
      if (isBackground) throw error;
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [page, query]);

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

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  useEffect(() => {
    let isFirst = true;
    const controller = new PollingController({
      fetchFn: async () => {
        const isBackground = !isFirst;
        isFirst = false;
        await load(isBackground);
      },
      visibleIntervalMs: 10_000,
      hiddenIntervalMs: 60_000,
      backoffEnabled: true,
    });
    controllerRef.current = controller;
    controller.start();

    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    if (!isSuper) return;
    apiGet<{ id: number; name: string }[]>('/admin/branches')
      .then((items) => setBranches(Array.isArray(items) ? items : []))
      .catch(() => setBranches([]));
  }, [isSuper]);

  async function confirm(id: number) {
    try {
      await apiPost(`/admin/preorders/${id}/confirm`, {});
      toast.success('Đã xác nhận preorder. Bếp có thể chủ động chuẩn bị món.');
      if (controllerRef.current) {
        controllerRef.current.triggerImmediate();
      } else {
        void load();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xác nhận');
    }
  }

  async function confirmHandover(id: number) {
    if (handingOverId !== null) return;
    setHandingOverId(id);
    try {
      await apiPost(`/admin/preorders/${id}/handover`, {});
      toast.success('Đã xác nhận bàn giao đơn đặt trước thành công!');
      if (controllerRef.current) {
        controllerRef.current.triggerImmediate();
      } else {
        void load();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xác nhận bàn giao');
    } finally {
      setHandingOverId(null);
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
      if (controllerRef.current) {
        controllerRef.current.triggerImmediate();
      } else {
        void load();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đổi lịch');
    }
  }

  function updateSettingDraft(storeId: number, patch: Partial<SettingDraft>) {
    setSettingDrafts((current) => {
      const existing = current[storeId] ?? { isEnabled: false, managerId: UNASSIGNED_MANAGER };
      return {
        ...current,
        [storeId]: { ...existing, ...patch },
      };
    });
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
          <p className="text-muted-foreground text-sm">Manager xác nhận đơn. Khách hàng tự check-in khi đến cửa hàng; bàn giao hoàn tất sau khi Bếp xong.</p>
        </div>
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
        <div className="flex flex-wrap items-center gap-2">
        {(['pending', 'check-in', 'today', 'upcoming', 'archive'] as const).map((candidate) => (
          <Button key={candidate} variant={view === candidate ? 'default' : 'outline'} onClick={() => setView(candidate)}>
            {candidate === 'pending'
              ? 'Chờ xác nhận'
              : candidate === 'check-in'
                ? 'Check-in'
                : candidate === 'today'
                  ? 'Hôm nay'
                  : candidate === 'upcoming'
                    ? 'Sắp tới'
                    : 'Lưu trữ'}
          </Button>
        ))}
        {view === 'archive' && (
          <div className="ml-2 flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Lọc:</span>
            <Select value={archiveStatusFilter} onValueChange={(v: any) => setArchiveStatusFilter(v)}>
              <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPLETED">Đã hoàn thành</SelectItem>
                <SelectItem value="all">Tất cả hồ sơ</SelectItem>
                <SelectItem value="CUSTOMER_CANCELLED">Đã hủy</SelectItem>
                <SelectItem value="NO_SHOW">Không đến nhận</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        </div>
        {isSuper ? <Select value={storeFilter} onValueChange={setStoreFilter}><SelectTrigger className="w-52"><SelectValue placeholder="Lọc chi nhánh" /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả chi nhánh</SelectItem>{branches.map((branch) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}</SelectContent></Select> : null}
      </div>

      {loading ? <p className="text-muted-foreground">Đang tải…</p> : rows.length === 0 ? <p className="rounded-xl border p-8 text-center text-muted-foreground">Không có preorder phù hợp.</p> : (
        <div className="grid gap-3">
          {rows.map((preorder) => {
            const allOrdersCompleted = preorder.orders && preorder.orders.length > 0
              && preorder.orders.every((o) => o.current_status === 'Hoàn thành');

            return (
              <article key={preorder.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base">{preorder.preorder_code}</span>
                      <Badge variant={preorder.status === 'COMPLETED' ? 'default' : preorder.status === 'CHECKED_IN' ? 'secondary' : 'outline'}>
                        {preorder.status === 'COMPLETED' ? 'Hoàn thành' : preorder.status === 'CHECKED_IN' ? 'Đã check-in' : preorder.status === 'CONFIRMED' ? 'Đã xác nhận' : preorder.status === 'PENDING_MANAGER_CONFIRMATION' ? 'Chờ Manager duyệt' : preorder.status === 'CUSTOMER_CANCELLED' ? 'Đã hủy' : preorder.status === 'NO_SHOW' ? 'Khách không đến' : preorder.status}
                      </Badge>
                      {preorder.handover_overdue_at ? (
                        <Badge variant="destructive" className="animate-pulse">Quá hạn bàn giao</Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {new Date(preorder.scheduled_start_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {preorder.store_name || 'Chi nhánh'} · {preorder.customer_name || 'Khách hàng'}
                    </div>
                    {preorder.checked_in_at ? (
                      <div className="mt-1 text-xs text-emerald-700 font-medium">
                        ✓ Khách đã tự check-in lúc {new Date(preorder.checked_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
                      </div>
                    ) : null}
                    {preorder.handover_confirmed_at ? (
                      <div className="mt-1 text-xs text-blue-700 font-medium">
                        ✓ Bàn giao hoàn tất lúc {new Date(preorder.handover_confirmed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {preorder.status === 'PENDING_MANAGER_CONFIRMATION' && (
                      <Button onClick={() => void confirm(preorder.id)}>
                        <CheckCircle2 className="mr-1 size-4" />Xác nhận
                      </Button>
                    )}

                    {preorder.status === 'CHECKED_IN' && (
                      allOrdersCompleted ? (
                        <Button
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          disabled={handingOverId === preorder.id}
                          onClick={() => void confirmHandover(preorder.id)}
                        >
                          {handingOverId === preorder.id ? (
                            <Loader2 className="mr-1 size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 size-4" />
                          )}
                          Xác nhận giao hàng
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled title="Chờ Bếp pha chế xong toàn bộ món">
                          <Loader2 className="mr-1 size-4 animate-spin" />
                          Chờ Bếp hoàn tất
                        </Button>
                      )
                    )}

                    {['PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status) && preorder.reschedule_count === 0 && (
                      <Button variant="outline" onClick={() => setRescheduleId(preorder.id)}>
                        <CalendarClock className="mr-1 size-4" />Đổi lịch
                      </Button>
                    )}
                  </div>
                </div>

                {preorder.status === 'CONFIRMED' ? (
                  <p className="mt-3 rounded-lg bg-violet-50 p-2.5 text-xs text-violet-900">
                    Bếp có thể chuẩn bị món ngay theo giờ hẹn. Khi khách tới, khách sẽ tự check-in trên ứng dụng để nhận món.
                  </p>
                ) : null}

                {preorder.status === 'CHECKED_IN' ? (
                  <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900">
                    Khách hàng đã check-in tại cửa hàng. Vui lòng kiểm tra Bếp hoàn thành đầy đủ món trước khi bấm &quot;Xác nhận giao hàng&quot;.
                  </p>
                ) : null}

                {preorder.orders?.length ? (
                  <details className="mt-3 rounded-lg border">
                    <summary className="cursor-pointer p-2.5 text-sm font-medium">
                      Xem món đã đặt ({preorder.orders.reduce((total, order) => total + order.items.length, 0)}) · Trạng thái Bếp: {allOrdersCompleted ? 'Đã xong' : 'Đang chế biến'}
                    </summary>
                    <div className="space-y-2 border-t p-3 text-sm">
                      {preorder.orders.flatMap((order) => order.items.map((item) => (
                        <p key={item.id} className="flex justify-between items-center">
                          <span>{item.qty}× {item.product_name}{item.size_label ? ` · ${item.size_label}` : ''}</span>
                          <span className="text-xs text-muted-foreground font-medium">{order.current_status || 'Đang xử lý'}</span>
                        </p>
                      )))}
                    </div>
                  </details>
                ) : null}

                {preorder.reviews && preorder.reviews.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs space-y-2">
                    <p className="font-semibold text-amber-900 flex items-center gap-1">
                      <Award className="size-3.5 text-amber-600" />
                      Đánh giá từ khách hàng:
                    </p>
                    {preorder.reviews.map((rev) => (
                      <div key={rev.id} className="border-t border-amber-200/60 pt-1.5">
                        <p className="font-medium text-amber-950">
                          {rev.product_name ? `${rev.product_name} · ` : ''}{'⭐'.repeat(rev.rating)} ({rev.rating}/5)
                        </p>
                        {rev.comment ? <p className="text-muted-foreground mt-0.5 italic">&quot;{rev.comment}&quot;</p> : null}
                        {rev.reply_comment ? <p className="text-blue-900 mt-0.5">↳ Phản hồi quán: {rev.reply_comment}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

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
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
          <span>Trang {page} / {Math.max(1, totalPages)}</span>
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

      {isSuper && <p className="text-xs text-muted-foreground">Super xử lý incident/strike trong quản trị; re-enable Manager dùng luồng Tài khoản canonical.</p>}
    </div>
  );
}
