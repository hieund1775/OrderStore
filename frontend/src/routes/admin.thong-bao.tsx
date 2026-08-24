import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Loader2,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/data";
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  clearAllAdminNotifications,
  isSafeInternalLink,
  type AppNotification,
} from "@/lib/notifications";

export const Route = createFileRoute("/admin/thong-bao")({
  head: () => ({
    meta: [
      { title: "Trung tâm thông báo | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Đơn hàng mới và cập nhật tiến độ vận hành real-time cho toàn chuỗi.",
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
  { id: "staff", label: "Tuyển dụng" },
  { id: "system", label: "Hệ thống" },
];

const icons: Record<string, typeof Bell> = {
  order: ShoppingBag,
  staff: Users,
  system: Bell,
};

function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    let cancelled = false;
    fetchAdminNotifications(100)
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
  };

  useEffect(() => {
    const cancel = load();
    const interval = setInterval(load, 20000);
    return () => {
      cancel();
      clearInterval(interval);
    };
  }, []);

  async function handleNotificationClick(n: AppNotification) {
    if (!n.is_read) {
      markAdminNotificationRead(n.id).catch(() => {});
      setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (isSafeInternalLink(n.link)) {
      navigate({ to: n.link as any });
    }
  }

  async function handleReadAll() {
    try {
      await markAllAdminNotificationsRead();
      setRows((prev) => prev.map((x) => ({ ...x, is_read: true })));
      toast.success("Đã đánh dấu tất cả thông báo là đã đọc");
    } catch {
      toast.error("Không thể cập nhật trạng thái");
    }
  }

  async function handleClearAll() {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tất cả thông báo không?")) return;
    try {
      await clearAllAdminNotifications();
      setRows([]);
      toast.success("Đã xóa tất cả thông báo");
    } catch {
      toast.error("Không thể xóa thông báo");
    }
  }

  const shown = rows.filter((n) => filter === "all" || n.type === filter);
  const unreadCount = rows.filter((n) => !n.is_read).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <AdminPageHeader
          title="Trung tâm thông báo"
          desc={`${unreadCount} thông báo chưa đọc`}
        />
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleReadAll} className="text-xs">
                <CheckCheck className="size-3.5 mr-1.5" /> Đọc tất cả
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAll}
              className="text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5 mr-1.5" /> Xóa tất cả
            </Button>
          </div>
        )}
      </div>

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
              <Card
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`shadow-soft flex flex-wrap items-center gap-4 p-4 cursor-pointer transition-colors ${
                  !n.is_read ? "border-primary/40 bg-primary/[0.02]" : "hover:border-border"
                }`}
              >
                <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${!n.is_read ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>}
                  <p className="text-muted-foreground/70 mt-1 text-[11px]">
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
