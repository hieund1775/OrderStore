import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminPageHeader, SectionCard, StatCard } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/bao-cao")({
  head: () => ({
    meta: [
      { title: "Báo cáo & Thống kê | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Doanh thu, đơn hàng, AOV, top món bán chạy — tinh gọn theo vận hành.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type KpiSummary = {
  period: { from: string; to: string };
  revenue: number;
  total_orders: number;
  avg_order: number;
  cancelled: number;
  cancel_rate: number;
};
type NameValue = { name: string; value: number };
type TopProduct = { name: string; qty: number; revenue: number };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ReportsPage() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [byHour, setByHour] = useState<{ hour: number; value: number }[]>([]);
  const [byCategory, setByCategory] = useState<NameValue[]>([]);
  const [byBranch, setByBranch] = useState<NameValue[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `?from=${from}&to=${to}`;
      const [k, hour, cat, branch, top] = await Promise.all([
        apiGet<KpiSummary>(`/admin/reports/kpi-summary${qs}`),
        apiGet<{ hour: number; value: number }[]>(`/admin/dashboard/revenue-by-hour`),
        apiGet<NameValue[]>(`/admin/dashboard/revenue-by-category`),
        apiGet<NameValue[]>(`/admin/dashboard/revenue-by-branch`),
        apiGet<TopProduct[]>(`/admin/dashboard/top-products`),
      ]);
      setKpi(k);
      setByHour(
        Array.from({ length: 24 }, (_, h) => {
          const found = hour.find((x) => Number(x.hour) === h);
          return { hour: h, value: found?.value ?? 0 };
        }).filter((x) => x.value > 0),
      );
      setByCategory(cat);
      setByBranch(branch);
      setTopProducts(top);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const rows = [
      ["Báo cáo từ", from, "đến", to, ""],
      ["Chỉ số", "Giá trị", "", "", ""],
      ["Doanh thu", kpi?.revenue ?? 0, "", "", ""],
      ["Tổng đơn", kpi?.total_orders ?? 0, "", "", ""],
      ["AOV", kpi?.avg_order ?? 0, "", "", ""],
      ["Tỷ lệ hủy (%)", kpi?.cancel_rate ?? 0, "", "", ""],
      ["", "", "", "", ""],
      ["Top món", "Số ly", "Doanh thu", "", ""],
      ...topProducts.map((p) => [p.name, p.qty, p.revenue, "", ""]),
      ["", "", "", "", ""],
      ["Doanh thu theo chi nhánh", "Giá trị", "", "", ""],
      ...byBranch.map((b) => [b.name, b.value, "", "", ""]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bao-cao-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Chỉ số", "Giá trị"],
        ["Doanh thu", kpi?.revenue ?? 0],
        ["Tổng đơn hoàn thành", kpi?.total_orders ?? 0],
        ["Giá trị đơn trung bình (AOV)", kpi?.avg_order ?? 0],
        ["Số đơn hủy", kpi?.cancelled ?? 0],
        ["Tỷ lệ hủy đơn (%)", kpi?.cancel_rate ?? 0],
      ]),
      "Tổng quan",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(topProducts.map((p) => ({ "Món": p.name, "Số ly": p.qty, "Doanh thu": p.revenue }))),
      "Top món bán chạy",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(byBranch.map((b) => ({ "Chi nhánh": b.name, "Doanh thu": b.value }))),
      "Doanh thu chi nhánh",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(byCategory.map((c) => ({ "Danh mục": c.name, "Doanh thu": c.value }))),
      "Doanh thu danh mục",
    );
    XLSX.writeFile(wb, `bao-cao-${from}-${to}.xlsx`);
    toast.success("Đã xuất file Excel");
  }

  function exportPdf() {
    const doc = new jsPDF();
    const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFontSize(16);
    doc.text("Báo cáo doanh thu", 14, 18);
    doc.setFontSize(10);
    doc.text(`Kỳ báo cáo: ${from} → ${to} · Trà Trái Cây Tô`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["Chỉ số", "Giá trị"]],
      body: [
        ["Doanh thu", vnd(kpi?.revenue ?? 0)],
        ["Tổng đơn hoàn thành", String(kpi?.total_orders ?? 0)],
        ["Giá trị đơn trung bình (AOV)", vnd(kpi?.avg_order ?? 0)],
        ["Số đơn hủy", String(kpi?.cancelled ?? 0)],
        ["Tỷ lệ hủy đơn (%)", `${kpi?.cancel_rate ?? 0}%`],
      ],
    });
    autoTable(doc, {
      startY: lastY() + 10,
      head: [["Top món bán chạy", "Số ly", "Doanh thu"]],
      body: topProducts.map((p) => [p.name, String(p.qty), vnd(p.revenue)]),
    });
    autoTable(doc, {
      startY: lastY() + 10,
      head: [["Chi nhánh", "Doanh thu"]],
      body: byBranch.map((b) => [b.name, vnd(b.value)]),
    });
    autoTable(doc, {
      startY: lastY() + 10,
      head: [["Danh mục", "Doanh thu"]],
      body: byCategory.map((c) => [c.name, vnd(c.value)]),
    });
    doc.save(`bao-cao-${from}-${to}.pdf`);
    toast.success("Đã xuất file PDF");
  }

  return (
    <>
      <AdminPageHeader
        title="Báo cáo & Thống kê"
        desc={
          kpi
            ? `Kỳ báo cáo: ${kpi.period.from} → ${kpi.period.to}`
            : "Doanh thu, đơn hàng, AOV, top món bán chạy"
        }
        actions={
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="rep-from" className="text-xs">
                Từ ngày
              </Label>
              <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-to" className="text-xs">
                Đến ngày
              </Label>
              <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <Button variant="hero" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Xem"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf}>
              <FileText className="size-4" /> PDF
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Đang tải…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Doanh thu" value={vnd(kpi?.revenue ?? 0)} tone="primary" />
            <StatCard label="Tổng đơn hoàn thành" value={kpi?.total_orders ?? 0} tone="leaf" />
            <StatCard label="Giá trị đơn trung bình (AOV)" value={vnd(kpi?.avg_order ?? 0)} tone="primary" />
            <StatCard
              label="Tỷ lệ hủy đơn"
              value={`${kpi?.cancel_rate ?? 0}%`}
              delta={`${kpi?.cancelled ?? 0} đơn hủy`}
              tone="berry"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2" title="Doanh thu theo giờ" desc="Trong ngày (VNĐ)">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byHour} margin={{ left: 8, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip
                      formatter={(v) => vnd(Number(v))}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                    />
                    <Bar dataKey="value" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Cơ cấu theo danh mục" desc="Tỷ trọng doanh thu">
              <div className="h-64">
                {byCategory.length === 0 ? (
                  <p className="text-muted-foreground py-20 text-center text-sm">Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={3}>
                        {byCategory.map((_, i) => (
                          <Cell key={i} fill={pieColors[i % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => vnd(Number(v))}
                        contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <SectionCard title="Doanh thu theo chi nhánh" desc="VNĐ">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byBranch} layout="vertical" margin={{ left: 24, right: 8 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={110} />
                    <Tooltip
                      formatter={(v) => vnd(Number(v))}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                    />
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Top 10 món bán chạy" desc="Theo số ly đã bán">
              <Card className="shadow-none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Món</TableHead>
                      <TableHead className="text-right">Số ly</TableHead>
                      <TableHead className="text-right">Doanh thu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((p, i) => (
                      <TableRow key={p.name}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right font-semibold">{vnd(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {topProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                          Chưa có dữ liệu
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}
