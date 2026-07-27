import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  ChefHat,
  Coins,
  CupSoda,
  PackageX,
  ShoppingBag,
  Timer,
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
import { adminOrders, hourlyRevenue, kpis, urgentKpis } from "@/lib/admin-data";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Tổng quan vận hành | Admin Vườn Xanh" },
      {
        name: "description",
        content: "KPI doanh thu, đơn hàng, cảnh báo tồn kho và biểu đồ doanh thu theo giờ.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Tổng quan vận hành | Admin Vườn Xanh" },
      {
        property: "og:description",
        content: "Theo dõi doanh thu, đơn hàng và cảnh báo vận hành real-time.",
      },
    ],
  }),
  component: AdminDashboard,
});

const kpiIcons = [Coins, ShoppingBag, Ban, CupSoda];
const urgentIcons: Record<string, typeof AlertTriangle> = {
  low: AlertTriangle,
  paused: PackageX,
  prep: ChefHat,
  late: Timer,
};

function AdminDashboard() {
  return (
    <>
      <AdminPageHeader
        title="Tổng quan hôm nay"
        desc="Cập nhật lúc 15:30 · 27/07/2026 · Toàn chuỗi 5 chi nhánh"
        actions={
          <>
            <Button variant="outline">Hôm nay</Button>
            <Button variant="hero">Xuất báo cáo</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = kpiIcons[i];
          return (
            <StatCard
              key={k.id}
              label={k.label}
              value={k.value}
              delta={k.delta}
              tone={k.tone as "primary" | "leaf" | "berry"}
              icon={<Icon className="size-5" />}
            />
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {urgentKpis.map((u) => {
          const Icon = urgentIcons[u.id];
          const tone =
            u.tone === "danger"
              ? "border-berry/40 bg-berry/5 text-berry"
              : u.tone === "warn"
                ? "border-primary/40 bg-primary/5 text-primary"
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
          desc="Đơn vị: nghìn đồng · Peak hour 15h – 18h"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyRevenue} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
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
          </div>
        </SectionCard>

        <SectionCard title="Đơn mới cần xử lý" desc="Nhấp để mở chi tiết trong module đơn hàng">
          <ul className="space-y-3">
            {adminOrders.slice(0, 5).map((o) => (
              <li key={o.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{o.id}</p>
                  <Badge variant="secondary">{o.status}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {o.customer} · {o.type} · {o.time}
                </p>
                <p className="text-primary mt-1 text-sm font-bold">{vnd(o.total)}</p>
              </li>
            ))}
          </ul>
          <Button asChild variant="soft" className="mt-4 w-full">
            <Link to="/admin/don-hang">Xem tất cả đơn hàng</Link>
          </Button>
        </SectionCard>
      </div>
    </>
  );
}
