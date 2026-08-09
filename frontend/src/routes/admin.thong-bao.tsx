import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CreditCard,
  Loader2,
  PackageX,
  ShoppingBag,
  Ticket,
  UserPlus,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { fmtDateTime } from "@/lib/data";

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

type AdminNotification = {
  id: number;
  user_id: number | null;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

const filters = [
  { id: "all", label: "Tất cả" },
  { id: "order", label: "Đơn hàng mới" },
  { id: "stock", label: "Cảnh báo kho" },
  { id: "voucher", label: "Voucher" },
  { id: "staff", label: "Nhân sự" },
  { id: "payment", label: "Thanh toán" },
  { id: "system", label: "Hệ thống" },
];

const icons: Record<string, typeof Bell> = {
  order: ShoppingBag,
  stock: PackageX,
  voucher: Ticket,
  staff: UserPlus,
  payment: CreditCard,
  system: Bell,
};

function NotificationsPage() {
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<AdminNotification[]>("/admin/notifications")
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = rows.filter((n) => filter === "all" || n.type === filter);

  return (
    <>
      <AdminPageHeader
        title="Trung tâm thông báo"
        desc={`${rows.filter((n) => !n.is_read).length} thông báo chưa đọc`}
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

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground py-20 text-center text-sm">Không có thông báo nào</p>
      ) : (
        <div className="space-y-3">
          {shown.map((n) => {
            const Icon = icons[n.type] ?? AlertTriangle;
            return (
              <Card key={n.id} className="shadow-soft flex flex-wrap items-center gap-4 p-4">
                <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.body && <p className="text-muted-foreground text-xs">{n.body}</p>}
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {fmtDateTime(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="bg-primary size-2 shrink-0 animate-pulse rounded-full" title="Chưa đọc" />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
