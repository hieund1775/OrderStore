import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  ChefHat,
  Coins,
  CupSoda,
  Loader2,
  PackageX,
  ShoppingBag,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminPageHeader, SectionCard, StatCard } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Tổng quan vận hành | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "KPI doanh thu, đơn hàng, cảnh báo tồn kho và biểu đồ doanh thu theo giờ.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Tổng quan vận hành | Admin Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Theo dõi doanh thu, đơn hàng và cảnh báo vận hành real-time.",
      },
    ],
  }),
  component: AdminDashboard,
});

type Kpi = { value: number | string; label: string };
type RecentOrder = {
  id: number;
  order_code: string;
  order_type: string;
  customer_name: string;
  current_status: string;
  total: number;
  created_at: string;
};

const kpiIcons = [Coins, ShoppingBag, Ban, CupSoda];

function AdminDashboard() {
  const [kpis, setKpis] = useState<{ revenue: Kpi; orders: Kpi; cancelRate: Kpi; cups: Kpi } | null>(null);
  const [urgent, setUrgent] = useState<{ paused: number; preparing: number } | null>(null);
  const [byHour, setByHour] = useState<{ hour: number; value: number }[]>([]);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<{ revenue: Kpi; orders: Kpi; cancelRate: Kpi; cups: Kpi }>("/admin/dashboard/kpi"),
      apiGet<{ paused: number; preparing: number }>("/admin/dashboard/urgent"),
      apiGet<{ hour: number; value: number }[]>("/admin/dashboard/revenue-by-hour"),
      apiGet<RecentOrder[]>(`/admin/orders?status=${encodeURIComponent("Chờ xác nhận")}`),
    ])
      .then(([k, u, hour, orders]) => {
        if (cancelled) return;
        setKpis(k);
        setUrgent(u);
        setByHour(
          Array.from({ length: 24 }, (_, h) => {
            const found = hour.find((x) => Number(x.hour) === h);
            return { hour: h, value: found?.value ?? 0 };
          }).filter((x) => x.value > 0),
        );
        setRecent(orders.slice(0, 6));
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const kpiCards = kpis
    ? [
        { id: "revenue", label: kpis.revenue.label, value: vnd(Number(kpis.revenue.value)), tone: "primary" as const },
        { id: "orders", label: kpis.orders.label, value: Number(kpis.orders.value), tone: "leaf" as const },
        { id: "cancel", label: kpis.cancelRate.label, value: String(kpis.cancelRate.value), tone: "berry" as const },
        { id: "cups", label: kpis.cups.label, value: Number(kpis.cups.value), tone: "primary" as const },
      ]
    : [];

  const urgentCards = urgent
    ? [
        { id: "paused", label: "Món đang tạm ngưng", value: urgent.paused, tone: "danger" as const, to: "/admin/thuc-don" as const },
        { id: "prep", label: "Đơn đang chuẩn bị", value: urgent.preparing, tone: "info" as const, to: "/admin/bep" as const },
      ]
    : [];

  const urgentIcons: Record<string, typeof AlertTriangle> = {
    paused: PackageX,
    prep: ChefHat,
  };

  return (
    <>
      <AdminPageHeader
        title="Tổng quan hôm nay"
        desc={`Cập nhật ${today} · Toàn chuỗi`}
        actions={
          <>
            <Button variant="outline">Hôm nay</Button>
            <Button asChild variant="hero">
              <Link to="/admin/bao-cao">Xuất báo cáo</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((k, i) => {
              const Icon = kpiIcons[i];
              return (
                <StatCard
                  key={k.id}
                  label={k.label}
                  value={k.value}
                  tone={k.tone}
                  icon={<Icon className="size-5" />}
                />
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {urgentCards.map((u) => {
              const Icon = urgentIcons[u.id] ?? AlertTriangle;
              const tone =
                u.tone === "danger"
                  ? "border-berry/40 bg-berry/5 text-berry"
                  : "border-leaf/40 bg-leaf/5 text-leaf";
              return (
                <Link
                  key={u.id}
                  to={u.to}
                  className={`flex items-center gap-3 rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${tone}`}
                >
                  <Icon className="size-5 shrink-0" />
                  <div>
                    <p className="font-display text-lg font-extrabold">{u.value}</p>
                    <p className="text-foreground/70 text-xs">{u.label}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title="Doanh thu theo khung giờ"
              desc="Đơn vị: VNĐ · dữ liệu hôm nay"
            >
              <div className="h-72 w-full">
                {byHour.length === 0 ? (
                  <p className="text-muted-foreground py-24 text-center text-sm">Chưa có dữ liệu hôm nay</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={byHour} margin={{ left: 8, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(h) => `${h}h`}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip
                        formatter={(v) => vnd(Number(v))}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          fontSize: 12,
                        }}
                      />
                      <Area dataKey="value" stroke="var(--primary)" strokeWidth={2.5} fill="url(#rev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Đơn mới cần xử lý" desc="Nhấp để mở chi tiết trong module đơn hàng">
              {recent.length === 0 ? (
                <p className="text-muted-foreground py-16 text-center text-sm">Không có đơn đang chờ</p>
              ) : (
                <ul className="space-y-3">
                  {recent.map((o) => (
                    <li key={o.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{o.order_code}</p>
                        <Badge variant="secondary">{o.current_status}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {o.customer_name} · {o.order_type} · {new Date(o.created_at).toLocaleString("vi-VN")}
                      </p>
                      <p className="text-primary mt-1 text-sm font-bold">{vnd(o.total)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="soft" className="mt-4 w-full">
                <Link to="/admin/don-hang">Xem tất cả đơn hàng</Link>
              </Button>
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}
