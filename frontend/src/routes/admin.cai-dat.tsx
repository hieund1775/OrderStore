import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      { title: "Tài khoản & Nhật ký | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Quản trị tài khoản nội bộ và nhật ký hoạt động hệ thống.",
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

  return (
    <>
      <AdminPageHeader
        title="Tài khoản & Nhật ký"
        desc="Chỉ Super Admin có toàn quyền chỉnh sửa các mục dưới đây"
      />

      <Tabs defaultValue="accounts">
        <TabsList className="flex-wrap">
          <TabsTrigger value="accounts">Tài khoản & Phân quyền</TabsTrigger>
          <TabsTrigger value="logs">Nhật ký hoạt động</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-5">
          <Card className="shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b p-4">
              <p className="font-display font-bold">Tài khoản nội bộ</p>
            </div>
            <div className="overflow-x-auto">
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
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts.map((u) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-5">
          <Card className="shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
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
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                        Chưa có nhật ký hoạt động
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{l.user_name}</TableCell>
                        <TableCell className="text-sm font-medium">{l.action}</TableCell>
                        <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                          {l.detail || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                          {l.user_agent?.split(" ").slice(0, 2).join(" ") || "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {fmtDateTime(l.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
