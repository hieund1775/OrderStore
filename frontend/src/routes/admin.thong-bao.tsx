import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  CreditCard,
  PackageX,
  ShoppingBag,
  Ticket,
  UserPlus,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminNotifications } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/thong-bao")({
  head: () => ({
    meta: [
      { title: "Trung tâm thông báo | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Đơn mới, cảnh báo tồn kho, voucher sắp hết hạn, duyệt nhân viên và lỗi thanh toán.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Trung tâm thông báo | Admin Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Tổng hợp cảnh báo vận hành real-time cho toàn chuỗi.",
      },
    ],
  }),
  component: NotificationsPage,
});

const filters = [
  { id: "all", label: "Tất cả" },
  { id: "order", label: "Đơn hàng mới" },
  { id: "stock", label: "Cảnh báo kho" },
  { id: "voucher", label: "Voucher" },
  { id: "staff", label: "Nhân sự" },
  { id: "payment", label: "Thanh toán" },
];

const icons: Record<string, typeof Bell> = {
  order: ShoppingBag,
  stock: PackageX,
  voucher: Ticket,
  staff: UserPlus,
  payment: CreditCard,
};

const tones: Record<string, string> = {
  info: "bg-primary/10 text-primary",
  warn: "bg-accent text-accent-foreground",
  danger: "bg-berry/10 text-berry",
};

function NotificationsPage() {
  const [filter, setFilter] = useState("all");
  const rows = adminNotifications.filter((n) => filter === "all" || n.type === filter);

  return (
    <>
      <AdminPageHeader
        title="Trung tâm thông báo"
        desc={`${adminNotifications.length} thông báo chưa xử lý`}
        actions={<Button variant="outline">Đánh dấu đã đọc tất cả</Button>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((n) => {
          const Icon = icons[n.type] ?? AlertTriangle;
          return (
            <Card key={n.id} className="shadow-soft flex flex-wrap items-center gap-4 p-4">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[n.tone]}`}
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-muted-foreground text-xs">{n.time}</p>
              </div>
              <Button variant="soft" size="sm">
                Xử lý ngay
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
