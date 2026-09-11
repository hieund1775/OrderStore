import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarClock, CheckCircle2, RefreshCw, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [view, setView] = useState<'pending' | 'today' | 'upcoming'>('pending');
  const [loading, setLoading] = useState(true);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleHour, setRescheduleHour] = useState('');
  const [reason, setReason] = useState('');
  const [settings, setSettings] = useState<PreorderStoreSetting[]>([]);
  const [settingDrafts, setSettingDrafts] = useState<Record<number, SettingDraft>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingStoreId, setSavingStoreId] = useState<number | null>(null);

  const query = useMemo(() => view === 'pending' ? '?view=pending' : '', [view]);

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

  async function confirm(id: number) {
    try {
      await apiPost(`/admin/preorders/${id}/confirm`, {});
      toast.success('Đã xác nhận preorder và tạo việc vận hành.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xác nhận');
    }
  }

  async function checkIn(id: number) {
    try {
      await apiPost(`/admin/preorders/${id}/check-in`, {});
      toast.success('Đã check-in.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể check-in');
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
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-2">
            <Settings2 className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Cấu hình nhận đặt trước theo chi nhánh</h2>
              <p className="text-sm text-muted-foreground">Chỉ chi nhánh được bật và có một Manager đang hoạt động đúng branch mới nhận preorder.</p>
            </div>
          </div>
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
        </section>
      )}

      <div className="flex gap-2">
        {(['pending', 'today', 'upcoming'] as const).map((candidate) => (
          <Button key={candidate} variant={view === candidate ? 'default' : 'outline'} onClick={() => setView(candidate)}>
            {candidate === 'pending' ? 'Chờ xác nhận' : candidate === 'today' ? 'Hôm nay' : 'Sắp tới'}
          </Button>
        ))}
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
                </div>
                <div className="flex flex-wrap gap-2">
                  {preorder.status === 'PENDING_MANAGER_CONFIRMATION' && <Button onClick={() => void confirm(preorder.id)}><CheckCircle2 className="mr-1 size-4" />Xác nhận</Button>}
                  {preorder.status === 'CONFIRMED' && <Button variant="secondary" onClick={() => void checkIn(preorder.id)}>Check-in</Button>}
                  {['PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status) && preorder.reschedule_count === 0 && <Button variant="outline" onClick={() => setRescheduleId(preorder.id)}><CalendarClock className="mr-1 size-4" />Đổi lịch</Button>}
                </div>
              </div>
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
    </div>
  );
}
