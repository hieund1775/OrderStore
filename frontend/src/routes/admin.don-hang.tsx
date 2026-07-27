import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Filter, LayoutGrid, List } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminBranches, adminOrders, type AdminOrder } from "@/lib/admin-data";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/don-hang")({
  head: () => ({
    meta: [
      { title: "Quản lý đơn hàng | Admin Vườn Xanh" },
      {
        name: "description",
        content:
          "Danh sách đơn hàng dạng list và Kanban với bộ lọc chi nhánh, trạng thái, loại đơn.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Quản lý đơn hàng | Admin Vườn Xanh" },
      { property: "og:description", content: "Lọc, theo dõi và xử lý đơn hàng đa chi nhánh." },
    ],
  }),
  component: OrdersPage,
});

const statuses = ["Tất cả", "Chờ xác nhận", "Đang chuẩn bị", "Đang giao", "Hoàn thành", "Đã hủy"];
const types = ["Tất cả", "Delivery", "Take-away", "POS"];
const payments = ["Tất cả", "COD", "VietQR", "MoMo", "ZaloPay"];

const statusTone: Record<string, string> = {
  "Chờ xác nhận": "bg-primary/15 text-primary",
  "Đang chuẩn bị": "bg-chart-5/15 text-chart-5",
  "Đang giao": "bg-accent text-accent-foreground",
  "Hoàn thành": "bg-leaf/15 text-leaf",
  "Đã hủy": "bg-berry/15 text-berry",
};

function OrdersPage() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [status, setStatus] = useState("Tất cả");
  const [type, setType] = useState("Tất cả");
  const [payment, setPayment] = useState("Tất cả");
  const [branch, setBranch] = useState("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      adminOrders.filter(
        (o) =>
          (status === "Tất cả" || o.status === status) &&
          (type === "Tất cả" || o.type === type) &&
          (payment === "Tất cả" || o.payment === payment) &&
          (branch === "all" || o.branch === adminBranches.find((b) => b.id === branch)?.name) &&
          (q.trim() === "" ||
            `${o.id} ${o.customer} ${o.phone}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [status, type, payment, branch, q],
  );

  return (
    <>
      <AdminPageHeader
        title="Quản lý đơn hàng"
        desc={`${filtered.length} đơn khớp bộ lọc · cập nhật real-time`}
        actions={
          <div className="bg-muted flex rounded-xl p-1">
            <Button
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              onClick={() => setView("list")}
            >
              <List className="mr-1 size-4" /> List
            </Button>
            <Button
              size="sm"
              variant={view === "kanban" ? "default" : "ghost"}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="mr-1 size-4" /> Kanban
            </Button>
          </div>
        }
      />

      <Card className="shadow-soft mb-5">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-1">
            <Input
              placeholder="Tìm mã đơn / khách hàng"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <FilterSelect
            value={branch}
            onChange={setBranch}
            label="Chi nhánh"
            options={adminBranches.map((b) => ({ v: b.id, l: b.name }))}
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="Trạng thái"
            options={statuses.map((s) => ({ v: s, l: s }))}
          />
          <FilterSelect
            value={type}
            onChange={setType}
            label="Loại đơn"
            options={types.map((s) => ({ v: s, l: s }))}
          />
          <FilterSelect
            value={payment}
            onChange={setPayment}
            label="Thanh toán"
            options={payments.map((s) => ({ v: s, l: s }))}
          />
        </CardContent>
      </Card>

      {view === "list" ? (
        <Card className="shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead className="hidden md:table-cell">Chi nhánh</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="hidden lg:table-cell">PTTT</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.id}</TableCell>
                    <TableCell>
                      <p className="text-sm">{o.customer}</p>
                      <p className="text-muted-foreground text-xs">{o.time}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{o.branch}</TableCell>
                    <TableCell className="text-sm">{o.type}</TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{o.payment}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[o.status]}`}
                      >
                        {o.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{vnd(o.total)}</TableCell>
                    <TableCell className="text-right">
                      <OrderDetail order={o} />
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground py-10 text-center text-sm"
                    >
                      <Filter className="mx-auto mb-2 size-5" /> Không có đơn nào khớp bộ lọc.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {["Chờ xác nhận", "Đang chuẩn bị", "Đang giao", "Hoàn thành"].map((col) => (
            <div key={col} className="bg-card rounded-2xl border p-3">
              <p className="mb-3 flex items-center justify-between text-sm font-semibold">
                {col}
                <Badge variant="secondary">{filtered.filter((o) => o.status === col).length}</Badge>
              </p>
              <div className="space-y-3">
                {filtered
                  .filter((o) => o.status === col)
                  .map((o) => (
                    <div key={o.id} className="bg-background rounded-xl border p-3">
                      <p className="text-sm font-semibold">{o.id}</p>
                      <p className="text-muted-foreground text-xs">
                        {o.customer} · {o.type}
                      </p>
                      <p className="text-primary mt-1 text-sm font-bold">{vnd(o.total)}</p>
                      <div className="mt-2">
                        <OrderDetail order={o} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v}>
            {o.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function OrderDetail({ order }: { order: AdminOrder }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="mr-1 size-4" /> Chi tiết
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Đơn {order.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Info label="Khách hàng" value={order.customer} />
            <Info label="Số điện thoại" value={order.phone} />
            <Info label="Chi nhánh" value={order.branch} />
            <Info label="Loại đơn" value={order.type} />
            <Info label="Thanh toán" value={order.payment} />
            <Info label="Trạng thái" value={order.status} />
          </div>
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold tracking-wide uppercase">Món đã đặt</p>
            <ul className="space-y-2">
              {order.items.map((it) => (
                <li key={it.name} className="flex justify-between gap-3">
                  <span>
                    <span className="font-medium">
                      {it.qty}× {it.name}
                    </span>
                    <span className="text-muted-foreground block text-xs">{it.options}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="font-semibold">Tổng thanh toán</span>
            <span className="text-primary font-display text-lg font-extrabold">
              {vnd(order.total)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="hero" className="flex-1">
              Xác nhận đơn
            </Button>
            <Button variant="outline" className="flex-1">
              Hủy đơn
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-2">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
