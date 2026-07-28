import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminPageHeader, SectionCard, StatCard } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  hourlyRevenue,
  ingredientUsage,
  revenueByBranch,
  revenueByCategory,
  topProducts,
  topStaff,
  topVouchers,
} from "@/lib/admin-data";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/bao-cao")({
  head: () => ({
    meta: [
      { title: "Báo cáo & Thống kê | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Doanh thu đa chiều, top món, top voucher, tiêu thụ nguyên liệu và KPI vận hành.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Báo cáo & Thống kê | Admin Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Phân tích doanh thu theo chi nhánh, danh mục và hiệu quả vận hành.",
      },
    ],
  }),
  component: ReportsPage,
});

const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function ReportsPage() {
  return (
    <>
      <AdminPageHeader
        title="Báo cáo & Thống kê chuyên sâu"
        desc="Kỳ báo cáo: 01/07 – 27/07/2026"
        actions={
          <>
            <Button variant="outline">
              <FileSpreadsheet className="mr-1 size-4" /> Excel
            </Button>
            <Button variant="hero">
              <Download className="mr-1 size-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Giá trị đơn trung bình (AOV)"
          value="134.200₫"
          delta="+4,2%"
          tone="primary"
        />
        <StatCard label="Tỷ lệ khách quay lại" value="38,6%" delta="+1,8%" tone="leaf" />
        <StatCard label="Tổng doanh thu tháng" value="1,24 tỷ₫" delta="+11,3%" tone="primary" />
        <StatCard label="Tỷ lệ hủy đơn" value="2,8%" delta="-0,6%" tone="berry" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Doanh thu theo chi nhánh"
          desc="Đơn vị: nghìn đồng"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByBranch} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Cơ cấu theo danh mục" desc="Tỷ trọng doanh thu (%)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueByCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={92}
                  paddingAngle={3}
                >
                  {revenueByCategory.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {revenueByCategory.map((c, i) => (
              <li key={c.name} className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: pieColors[i % pieColors.length] }}
                />
                {c.name} · {c.value}%
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Doanh thu theo khung giờ" desc="Xác định peak hour để xếp ca nhân sự">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyRevenue} margin={{ left: -12, right: 8, top: 8 }}>
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
                <Line dataKey="value" stroke="var(--chart-2)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Top món bán chạy" desc="Theo số ly bán ra trong kỳ">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Món</TableHead>
                <TableHead className="text-right">Số ly</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="text-sm">{p.name}</TableCell>
                  <TableCell className="text-right">{p.qty}</TableCell>
                  <TableCell className="text-right font-semibold">{vnd(p.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Top voucher sử dụng">
          <ul className="space-y-3">
            {topVouchers.map((v) => (
              <li
                key={v.code}
                className="flex items-center justify-between rounded-xl border p-3 text-sm"
              >
                <span className="font-semibold">{v.code}</span>
                <span className="text-muted-foreground text-xs">
                  {v.used} lượt · giảm {vnd(v.discount)}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Tiêu thụ nguyên liệu" desc="Dự báo kế hoạch nhập hàng">
          <ul className="space-y-3">
            {ingredientUsage.map((i) => (
              <li
                key={i.name}
                className="flex items-center justify-between rounded-xl border p-3 text-sm"
              >
                <span>{i.name}</span>
                <span className="text-primary font-semibold">{i.used}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Top nhân viên">
          <ul className="space-y-3">
            {topStaff.map((s, i) => (
              <li key={s.name} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="bg-primary/10 text-primary grid size-8 place-items-center rounded-full text-sm font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {s.branch} · {s.orders} đơn
                  </p>
                </div>
                <span className="text-sm font-semibold">{vnd(s.revenue)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
