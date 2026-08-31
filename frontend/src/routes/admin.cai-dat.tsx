import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Users, History, Laptop, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentProfileManager } from "@/components/admin/payment-profiles/PaymentProfileManager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api";
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

function SettingsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<AccountRow[]>("/admin/settings/accounts"),
      apiGet<AuditRow[]>("/admin/settings/audit-logs"),
    ])
      .then(([accs, als]) => {
        if (cancelled) return;
        setAccounts(accs);
        setLogs(als);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được cài đặt"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('auth_user') || 'null') : null;
  const isSuper = currentUser?.role === 'super';

  return (
    <>
      <AdminPageHeader
        title="Tài khoản & Cài đặt"
        desc="Chỉ Super Admin có toàn quyền chỉnh sửa các mục dưới đây"
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
                          <span className="text-muted-foreground text-[11px]">
                            {u.active ? "Đang kích hoạt" : "Đã khóa"}
                          </span>
                          <Switch checked={u.active} disabled aria-label={`Kích hoạt ${u.fullname}`} />
                        </div>
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
                        <TableHead className="text-right">Kích hoạt</TableHead>
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
                          <TableCell className="text-right">
                            <Switch checked={u.active} disabled />
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
    </>
  );
}
