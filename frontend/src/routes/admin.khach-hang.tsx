import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gift, Lock, QrCode, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader, StatCard } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminCustomers } from "@/lib/admin-data";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/khach-hang")({
  head: () => ({
    meta: [
      { title: "Khách hàng & Loyalty | Admin Vườn Xanh" },
      {
        name: "description",
        content:
          "Hồ sơ khách hàng, hạng thẻ, phân nhóm VIP / sinh nhật / churn risk và gửi voucher.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Khách hàng & Loyalty | Admin Vườn Xanh" },
      {
        property: "og:description",
        content: "CRM chuỗi trà: lifetime value, hạng thẻ và công cụ chăm sóc khách hàng.",
      },
    ],
  }),
  component: CrmPage,
});

const segments = ["Tất cả", "VIP", "Sinh nhật tháng này", "Churn Risk"];

const segmentTone: Record<string, string> = {
  VIP: "bg-primary/15 text-primary",
  "Sinh nhật tháng này": "bg-accent text-accent-foreground",
  "Churn Risk": "bg-berry/15 text-berry",
};

function CrmPage() {
  const [segment, setSegment] = useState("Tất cả");
  const [q, setQ] = useState("");

  const rows = adminCustomers.filter(
    (c) =>
      (segment === "Tất cả" || c.segment === segment) &&
      `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <AdminPageHeader
        title="Khách hàng & Loyalty"
        desc="Hồ sơ toàn diện, phân nhóm thông minh và công cụ chăm sóc"
        actions={
          <Button
            variant="hero"
            onClick={() => toast.info("Mở camera quét mã QR tích điểm (demo)")}
          >
            <QrCode className="mr-1 size-4" /> Quét QR tích điểm
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng khách hàng" value="4.286" tone="primary" />
        <StatCard label="Khách VIP" value="312" tone="leaf" />
        <StatCard label="Sinh nhật tháng này" value="48" tone="primary" />
        <StatCard label="Churn Risk (>30 ngày)" value="176" tone="berry" />
      </div>

      <Card className="shadow-soft mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Tìm theo tên / số điện thoại"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {segments.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={segment === s ? "default" : "outline"}
                onClick={() => setSegment(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Hạng thẻ</TableHead>
                <TableHead className="hidden md:table-cell">Điểm</TableHead>
                <TableHead>Lifetime Value</TableHead>
                <TableHead className="hidden lg:table-cell">Số đơn</TableHead>
                <TableHead className="hidden lg:table-cell">Đơn gần nhất</TableHead>
                <TableHead>Phân nhóm</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-muted-foreground text-xs">{c.phone}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.tier}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {c.points.toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell className="font-semibold">{vnd(c.ltv)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{c.orders}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                    {c.lastOrder}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${segmentTone[c.segment] ?? "bg-muted"}`}
                    >
                      {c.segment}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Gửi voucher"
                      onClick={() => toast.success(`Đã gửi voucher tới ${c.name}`)}
                    >
                      <Gift className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Khóa tài khoản">
                      <Lock className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
