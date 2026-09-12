import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Pencil, Plus, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost, getUser } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type AccountRow = {
  id: number;
  fullname: string;
  email: string | null;
  role: string;
  branch: string;
  branch_id: number | null;
  active: boolean;
  email_verified_at: string | null;
};

type StoreRow = { id: number; name: string; is_active?: boolean };
type AccountForm = { fullname: string; email: string; role: string; branchId: string };

const roleLabels: Record<string, string> = {
  super: 'Super Admin', manager: 'Quản lý', kitchen: 'Bếp', cashier: 'Thu ngân', packing: 'Soạn hàng',
};
const operationalRoles = ['cashier', 'kitchen', 'packing'];
const superRoles = ['manager', ...operationalRoles];

function emptyForm(): AccountForm {
  return { fullname: '', email: '', role: 'cashier', branchId: '' };
}

function accountStatus(account: AccountRow) {
  if (account.active) return 'Đang hoạt động';
  return account.email_verified_at ? 'Đã vô hiệu hóa' : 'Chờ thiết lập tài khoản';
}

export function StaffAccountsPanel() {
  const actor = getUser();
  const isSuper = actor?.role === 'super';
  const actorBranchId = actor?.branch_id ?? null;
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);

  const allowedRoles = isSuper ? superRoles : operationalRoles;
  const activeStores = useMemo(() => stores.filter((store) => store.is_active !== false), [stores]);

  async function reload() {
    const [rows, storeRows] = await Promise.all([
      apiGet<AccountRow[]>('/admin/settings/accounts'),
      apiGet<StoreRow[]>('/api/stores'),
    ]);
    setAccounts(rows);
    setStores(storeRows);
  }

  useEffect(() => {
    let mounted = true;
    reload()
      .catch((error) => { if (mounted) toast.error(error instanceof Error ? error.message : 'Không tải được tài khoản'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  function openCreate() {
    setForm({ ...emptyForm(), branchId: isSuper ? '' : String(actorBranchId ?? '') });
    setCreateOpen(true);
  }

  function openEdit(account: AccountRow) {
    setForm({
      fullname: account.fullname,
      email: account.email || '',
      role: account.role,
      branchId: account.branch_id == null ? '' : String(account.branch_id),
    });
    setEditing(account);
  }

  async function createAccount() {
    setSubmitting(true);
    try {
      await apiPost('/admin/settings/accounts', {
        fullname: form.fullname,
        email: form.email,
        role: form.role,
        branch_id: isSuper ? Number(form.branchId) : actorBranchId,
      });
      toast.success('Đã tạo tài khoản và gửi lời mời qua email');
      setCreateOpen(false);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo tài khoản');
    } finally { setSubmitting(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    setSubmitting(true);
    try {
      await apiPatch(`/admin/settings/accounts/${editing.id}`, {
        fullname: form.fullname,
        email: form.email,
        role: editing.role === 'super' ? 'super' : form.role,
        branch_id: editing.role === 'super' ? null : Number(form.branchId),
      });
      toast.success('Đã cập nhật tài khoản. Nếu đổi email, nhân viên cần đặt lại mật khẩu từ email mới.');
      setEditing(null);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật tài khoản');
    } finally { setSubmitting(false); }
  }

  async function resendInvitation(account: AccountRow) {
    setSubmitting(true);
    try {
      await apiPost(`/admin/settings/accounts/${account.id}/resend-invitation`, {});
      toast.success('Đã gửi lại lời mời');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi lại lời mời');
    } finally { setSubmitting(false); }
  }

  async function changeStatus(account: AccountRow, isActive: boolean) {
    setSubmitting(true);
    try {
      await apiPatch(`/admin/settings/accounts/${account.id}/status`, { is_active: isActive });
      toast.success(isActive ? 'Đã kích hoạt tài khoản' : 'Đã vô hiệu hóa tài khoản');
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái');
    } finally { setSubmitting(false); }
  }

  async function sendPasswordReset(account: AccountRow) {
    setSubmitting(true);
    try {
      await apiPost(`/admin/settings/accounts/${account.id}/password-reset`, {});
      toast.success('Đã gửi email đặt lại mật khẩu và vô hiệu hóa các phiên cũ');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi email đặt lại mật khẩu');
    } finally { setSubmitting(false); }
  }

  function canManagerOperate(account: AccountRow) {
    return !isSuper && account.id !== actor?.id && account.branch_id === actorBranchId && operationalRoles.includes(account.role);
  }

  function renderForm(mode: 'create' | 'edit') {
    const editingSuper = mode === 'edit' && editing?.role === 'super';
    return <div className="grid gap-4 py-2">
      <div className="grid gap-2"><Label htmlFor="staff-fullname">Họ và tên</Label><Input id="staff-fullname" maxLength={50} value={form.fullname} onChange={(event) => setForm({ ...form, fullname: event.target.value })} /></div>
      <div className="grid gap-2"><Label htmlFor="staff-email">Email</Label><Input id="staff-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
      <div className="grid gap-2"><Label>Vai trò</Label><Select value={form.role} disabled={editingSuper} onValueChange={(role) => setForm({ ...form, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(editingSuper ? ['super'] : allowedRoles).map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Chi nhánh</Label>{isSuper ? <Select value={form.branchId} disabled={editingSuper} onValueChange={(branchId) => setForm({ ...form, branchId })}><SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger><SelectContent>{activeStores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}</SelectContent></Select> : <Input value={accounts.find((account) => account.branch_id === actorBranchId)?.branch || 'Chi nhánh của bạn'} disabled />}</div>
      {mode === 'edit' && <p className="text-xs text-muted-foreground">Đổi email sẽ hủy lời mời/OTP cũ, đăng xuất phiên hiện tại và gửi email đặt lại mật khẩu hoặc lời mời mới.</p>}
    </div>;
  }

  return <>
    <Card className="shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div><p className="font-display font-bold text-sm sm:text-base">Tài khoản nội bộ ({accounts.length})</p><p className="text-xs text-muted-foreground">Tạo tài khoản bằng lời mời email, không đặt mật khẩu thay nhân viên.</p></div>
        <Button size="sm" onClick={openCreate}><Plus />Tạo tài khoản</Button>
      </div>
      {loading ? <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto size-5 animate-spin" /></div> : <div className="divide-y">
        {accounts.map((account) => {
          const mayOperate = isSuper || canManagerOperate(account);
          const isPending = !account.active && !account.email_verified_at;
          return <div key={account.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{account.fullname}</p><Badge variant="secondary">{roleLabels[account.role] || account.role}</Badge><Badge variant={account.active ? 'outline' : 'secondary'}>{accountStatus(account)}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{account.email || 'Chưa có email'} · {account.branch}</p></div>
            <div className="flex flex-wrap gap-2">
              {isSuper && <Button size="sm" variant="outline" onClick={() => openEdit(account)} disabled={submitting}><Pencil />Chỉnh sửa</Button>}
              {mayOperate && isPending && <Button size="sm" variant="outline" onClick={() => resendInvitation(account)} disabled={submitting}><Send />Gửi lại lời mời</Button>}
              {isSuper && account.active && <Button size="sm" variant="outline" onClick={() => sendPasswordReset(account)} disabled={submitting}><KeyRound />Đặt lại mật khẩu</Button>}
              {mayOperate && !(isPending && !account.active) && <Button size="sm" variant={account.active ? 'destructive' : 'outline'} onClick={() => changeStatus(account, !account.active)} disabled={submitting}>{account.active ? 'Vô hiệu hóa' : 'Kích hoạt'}</Button>}
            </div>
          </div>;
        })}
        {accounts.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 size-5" />Chưa có tài khoản nhân sự.</div>}
      </div>}
    </Card>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Tạo tài khoản nhân sự</DialogTitle><DialogDescription>Nhân viên nhận email để tự thiết lập mật khẩu.</DialogDescription></DialogHeader>{renderForm('create')}<DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button><Button onClick={createAccount} disabled={submitting}>Tạo và gửi lời mời</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>Chỉnh sửa tài khoản</DialogTitle><DialogDescription>Chỉ Super Admin có thể sửa email, vai trò và chi nhánh.</DialogDescription></DialogHeader>{renderForm('edit')}<DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button><Button onClick={saveEdit} disabled={submitting}>Lưu thay đổi</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
