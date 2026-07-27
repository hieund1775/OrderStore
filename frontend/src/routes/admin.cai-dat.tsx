import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBackup, Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader, SectionCard } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { adminAccounts, auditLogs } from "@/lib/admin-data";
import { brand } from "@/lib/data";

export const Route = createFileRoute("/admin/cai-dat")({
  head: () => ({
    meta: [
      { title: "Cài đặt hệ thống | Admin Vườn Xanh" },
      {
        name: "description",
        content: "Phân quyền tài khoản, thương hiệu, VAT, khu vực giao hàng, audit log và backup.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Cài đặt hệ thống | Admin Vườn Xanh" },
      {
        property: "og:description",
        content: "Quản trị tài khoản nội bộ, cấu hình thanh toán và sao lưu dữ liệu.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <AdminPageHeader
        title="Cài đặt hệ thống"
        desc="Chỉ Super Admin có toàn quyền chỉnh sửa các mục dưới đây"
      />

      <Tabs defaultValue="accounts">
        <TabsList className="flex-wrap">
          <TabsTrigger value="accounts">Tài khoản & Phân quyền</TabsTrigger>
          <TabsTrigger value="brand">Thương hiệu & VAT</TabsTrigger>
          <TabsTrigger value="logs">Nhật ký hoạt động</TabsTrigger>
          <TabsTrigger value="backup">Sao lưu & Khôi phục</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-5">
          <Card className="shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b p-4">
              <p className="font-display font-bold">Tài khoản nội bộ</p>
              <Button variant="hero" size="sm">
                <Plus className="mr-1 size-4" /> Thêm tài khoản
              </Button>
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
                  {adminAccounts.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-muted-foreground text-xs">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{u.role}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">{u.branch}</TableCell>
                      <TableCell className="text-right">
                        <Switch defaultChecked={u.active} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="brand" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Thông tin thương hiệu">
              <div className="space-y-3">
                <Field id="s-name" label="Tên thương hiệu" value={brand.name} />
                <Field id="s-hotline" label="Hotline" value={brand.hotline} />
                <Field id="s-email" label="Email CSKH" value={brand.email} />
                <Field id="s-vat" label="Thuế VAT (%)" value="8" />
              </div>
            </SectionCard>

            <SectionCard title="Khu vực giao hàng & phí ship">
              <div className="space-y-3">
                <Field id="s-radius" label="Bán kính giao hàng (km)" value="6" />
                <Field id="s-fee1" label="Phí ship 0 – 3km (₫)" value="15000" />
                <Field id="s-fee2" label="Phí ship 3 – 6km (₫)" value="25000" />
                <Field id="s-free" label="Miễn phí ship cho đơn từ (₫)" value="150000" />
              </div>
            </SectionCard>

            <SectionCard title="Cổng thanh toán" className="lg:col-span-2">
              <div className="grid gap-3 md:grid-cols-3">
                <Field id="s-vietqr" label="VietQR API Key" value="••••••••••••" />
                <Field id="s-momo" label="MoMo Partner Code" value="••••••••••••" />
                <Field id="s-zalo" label="ZaloPay App ID" value="••••••••••••" />
              </div>
              <Button
                variant="hero"
                className="mt-4"
                onClick={() => toast.success("Đã lưu cấu hình (demo)")}
              >
                Lưu cấu hình
              </Button>
            </SectionCard>
          </div>
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
                    <TableHead className="hidden lg:table-cell">IP / Thiết bị</TableHead>
                    <TableHead className="text-right">Thời gian</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{l.user}</TableCell>
                      <TableCell className="text-sm font-medium">{l.action}</TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                        {l.detail}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                        {l.ip}
                        <br />
                        {l.device}
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">
                        {l.time}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Lịch sao lưu tự động">
              <div className="space-y-3">
                <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  Sao lưu hằng ngày (02:00) <Switch defaultChecked />
                </label>
                <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  Sao lưu hằng tuần (Chủ nhật) <Switch defaultChecked />
                </label>
                <p className="text-muted-foreground text-xs">
                  Bản sao lưu gần nhất: 27/07/2026 02:00 · 148 MB
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Export / Import dữ liệu">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => toast.success("Đang xuất JSON (demo)")}>
                  <Download className="mr-1 size-4" /> Export JSON
                </Button>
                <Button variant="outline" onClick={() => toast.success("Đang xuất SQL (demo)")}>
                  <DatabaseBackup className="mr-1 size-4" /> Export SQL
                </Button>
                <Button variant="soft">
                  <Upload className="mr-1 size-4" /> Import dữ liệu
                </Button>
              </div>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} defaultValue={value} className="mt-1.5" />
    </div>
  );
}
