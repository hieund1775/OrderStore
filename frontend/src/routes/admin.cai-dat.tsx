import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Users, History, Laptop, CreditCard, Plus, RefreshCw, Mail, Ban, CheckCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentProfileManager } from "@/components/admin/payment-profiles/PaymentProfileManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, getUser, fetchStaffAccounts, createStaffAccount, resendStaffInvitation, updateStaffStatus, fetchBranches } from "@/lib/api";
import type { StaffAccount, Branch } from "@/lib/api";
import { fmtDateTime } from "@/lib/data";

export const Route = createFileRoute("/admin/cai-dat")({
  head: () => ({
    meta: [
      { title: "Tài khoản & Cài đặt | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Quản trị tài khoản nội bộ, thanh toán và nhật ký hoạt động hệ thống.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type AccountRow = {
  id: number;
  fullname: string;
  email: string | null;
  role: string;
  branch: string;
  active: boolean;
};

type AuditRow = {
  id: number;
  user_name: string;
  action: string;
  detail: string | null;
  user_agent: string | null;
  created_at: string;
};

const roleLabels: Record<string, string> = {
  super: "Super Admin",
  manager: "Store Manager",
  kitchen: "Kitchen Staff",
  cashier: "Cashier Staff",
  packing: "Packing Staff",
};

const roleOptions: { value: string; label: string; managerOnly?: boolean }[] = [
  { value: "manager", label: "Store Manager" },
  { value: "cashier", label: "Cashier Staff" },
  { value: "kitchen", label: "Kitchen Staff" },
  { value: "packing", label: "Packing Staff" },
];

function SettingsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [createForm, setCreateForm] = useState({ fullname: "", email: "", role: "cashier", branch_id: "" });
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const currentUser = getUser();
  const isSuper = currentUser?.role === 'super';

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, als, brs] = await Promise.all([
        fetchStaffAccounts(),
        apiGet<AuditRow[]>("/admin/settings/audit-logs"),
        isSuper ? fetchBranches() : Promise.resolve([]),
      ]);
      setAccounts(accs);
      setLogs(als);
      setBranches(brs);
    } catch (err: any) {
      toast.error(err?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullname.trim() || !createForm.email.trim()) {
      toast.error("Vui lòng nhập họ tên và email");
      return;
    }

    setCreating(true);
    try {
      const result = await createStaffAccount({
        fullname: createForm.fullname.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        branch_id: isSuper && createForm.branch_id ? Number(createForm.branch_id) : null,
      });
      toast.success(result.message || "Tài khoản đã được tạo");
      setShowCreateForm(false);
      setCreateForm({ fullname: "", email: "", role: "cashier", branch_id: "" });
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Không thể tạo tài khoản");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (account: AccountRow) => {
    setActionLoading(prev => ({ ...prev, [account.id]: true }));
    try {
      const result = await updateStaffStatus(account.id, !account.active);
      toast.success(result.message);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Không thể cập nhật trạng thái");
    } finally {
      setActionLoading(prev => ({ ...prev, [account.id]: false }));
    }
  };

  const handleResendInvitation = async (accountId: number) => {
    setActionLoading(prev => ({ ...prev, [accountId]: true }));
    try {
      const result = await resendStaffInvitation(accountId);
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err?.message || "Không thể gửi lại lời mời");
    } finally {
      setActionLoading(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const getStatusBadge = (account: AccountRow) => {
    if (account.active) {
      return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Hoạt động</Badge>;
    }
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Đã khóa</Badge>;
  };

  return (
    <>
      <AdminPageHeader
        title="Tài khoản & Cài đặt"
        desc={isSuper ? "Quản lý tài khoản nội bộ, kênh thanh toán và nhật ký hoạt động" : "Quản lý tài khoản nhân viên trong chi nhánh"}
      />

      <Tabs defaultValue={isSuper ? "payment-profiles" : "accounts"}>
        <TabsList className={`grid ${isSuper ? 'grid-cols-3 max-w-xl' : 'grid-cols-2 max-w-md'} w-full h-auto p-1.5 gap-1.5 rounded-2xl bg-muted/80`}>
          {isSuper && (
            <TabsTrigger
              value="payment-profiles"
              className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
            >
              <CreditCard className="size-4 text-primary shrink-0" />
              <span className="truncate">Kênh Thanh Toán</span>
            </TabsTrigger>
          )}
          <TabsTrigger
            value="accounts"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <Users className="size-4 text-primary shrink-0" />
            <span className="truncate">Tài khoản</span>
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <History className="size-4 text-primary shrink-0" />
            <span className="truncate">Nhật ký</span>
          </TabsTrigger>
        </TabsList>

        {isSuper && (
          <TabsContent value="payment-profiles" className="mt-5">
            <PaymentProfileManager />
          </TabsContent>
        )}

        <TabsContent value="accounts" className="mt-5">
          <Card className="shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b p-4">
              <p className="font-display font-bold text-sm sm:text-base">Tài khoản nội bộ ({accounts.length})</p>
              <Button
                size="sm"
                variant="hero"
                className="gap-1.5"
                onClick={() => setShowCreateForm(true)}
              >
                <UserPlus className="size-4" />
                <span className="hidden sm:inline">Tạo tài khoản</span>
              </Button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-muted-foreground">
                <Loader2 className="mx-auto size-5 animate-spin" />
              </div>
            ) : (
              <div>
                {/* MOBILE ACCOUNT CARDS (< 768px) */}
                <div className="md:hidden space-y-3 p-3">
                  {accounts.map((u) => (
                    <div
                      key={u.id}
                      className="bg-card rounded-2xl border p-4 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b pb-2.5">
                        <div>
                          <p className="font-bold text-sm text-foreground">{u.fullname}</p>
                          <p className="text-muted-foreground text-xs">{u.email || "—"}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs font-semibold shrink-0">
                          {roleLabels[u.role] ?? u.role}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Chi nhánh</span>
                          <span className="font-medium text-foreground">{u.branch}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(u)}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => handleToggleStatus(u)}
                          disabled={actionLoading[u.id]}
                        >
                          {u.active ? <Ban className="size-3 mr-1" /> : <CheckCircle className="size-3 mr-1" />}
                          {u.active ? "Vô hiệu" : "Kích hoạt"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => handleResendInvitation(u.id)}
                          disabled={actionLoading[u.id]}
                        >
                          <RefreshCw className="size-3 mr-1" />
                          Gửi lại
                        </Button>
                      </div>
                    </div>
                  ))}
                  {accounts.length === 0 && (
                    <p className="text-muted-foreground py-8 text-center text-sm">Chưa có tài khoản nào.</p>
                  )}
                </div>

                {/* DESKTOP & TABLET TABLE (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nhân sự</TableHead>
                        <TableHead>Vai trò</TableHead>
                        <TableHead className="hidden md:table-cell">Phạm vi</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <p className="text-sm font-medium">{u.fullname}</p>
                            <p className="text-muted-foreground text-xs">{u.email || "—"}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{roleLabels[u.role] ?? u.role}</Badge>
                          </TableCell>
                          <TableCell className="hidden text-sm md:table-cell">{u.branch}</TableCell>
                          <TableCell>{getStatusBadge(u)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => handleToggleStatus(u)}
                                disabled={actionLoading[u.id]}
                              >
                                {u.active ? "Vô hiệu" : "Kích hoạt"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => handleResendInvitation(u.id)}
                                disabled={actionLoading[u.id]}
                              >
                                <RefreshCw className="size-3 mr-1" />
                                Gửi lại
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-5">
          <Card className="shadow-soft overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-muted-foreground">
                <Loader2 className="mx-auto size-5 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                Chưa có nhật ký hoạt động
              </div>
            ) : (
              <div>
                {/* MOBILE AUDIT LOG TIMELINE (< 768px) */}
                <div className="md:hidden space-y-3 p-3">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className="bg-card rounded-2xl border p-3.5 shadow-sm space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 border-b pb-2">
                        <span className="font-bold text-foreground">{l.user_name}</span>
                        <span className="text-muted-foreground text-[11px] font-mono whitespace-nowrap">
                          {fmtDateTime(l.created_at)}
                        </span>
                      </div>

                      <p className="font-semibold text-primary text-xs">{l.action}</p>

                      {l.detail && (
                        <div className="bg-muted/30 p-2.5 rounded-xl border border-muted/50 text-muted-foreground text-[11px] leading-relaxed break-words">
                          {l.detail}
                        </div>
                      )}

                      {l.user_agent && (
                        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 pt-1">
                          <Laptop className="size-3 shrink-0" />
                          <span className="truncate">{l.user_agent.split(" ").slice(0, 3).join(" ")}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* DESKTOP & TABLET TABLE (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Người thực hiện</TableHead>
                        <TableHead>Thao tác</TableHead>
                        <TableHead className="hidden md:table-cell">Nội dung thay đổi</TableHead>
                        <TableHead className="hidden lg:table-cell">Thiết bị</TableHead>
                        <TableHead className="text-right">Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-sm font-medium">{l.user_name}</TableCell>
                          <TableCell className="text-sm font-semibold text-primary">{l.action}</TableCell>
                          <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                            {l.detail || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                            {l.user_agent?.split(" ").slice(0, 2).join(" ") || "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm whitespace-nowrap font-mono">
                            {fmtDateTime(l.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Staff Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản nhân viên</DialogTitle>
            <DialogDescription>
              Nhân viên sẽ nhận được email mời thiết lập mật khẩu lần đầu.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="staff-fullname">Họ và tên</Label>
              <Input
                id="staff-fullname"
                placeholder="Nguyễn Văn A"
                value={createForm.fullname}
                onChange={(e) => setCreateForm(prev => ({ ...prev, fullname: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="nhanvien@teaplus.vn"
                value={createForm.email}
                onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-role">Vai trò</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger id="staff-role">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isSuper && (
              <div className="space-y-2">
                <Label htmlFor="staff-branch">Chi nhánh</Label>
                <Select
                  value={createForm.branch_id}
                  onValueChange={(value) => setCreateForm(prev => ({ ...prev, branch_id: value }))}
                >
                  <SelectTrigger id="staff-branch">
                    <SelectValue placeholder="Chọn chi nhánh" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowCreateForm(false)}
              >
                Hủy
              </Button>
              <Button type="submit" variant="hero" className="flex-1 font-bold" disabled={creating}>
                {creating ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}