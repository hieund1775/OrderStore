import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Eye, Filter, LayoutGrid, List, Loader2, Printer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InBillModal, type BillOrder } from "@/components/admin/InBillModal";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiPatch, apiPut } from "@/lib/api";
import { fmtDateTime, vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/don-hang")({
  head: () => ({
    meta: [
      { title: "Quản lý đơn hàng | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Danh sách đơn hàng dạng list và Kanban với bộ lọc chi nhánh, trạng thái, loại đơn.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Quản lý đơn hàng | Admin Trà Trái Cây Tô" },
      { property: "og:description", content: "Lọc, theo dõi và xử lý đơn hàng đa chi nhánh." },
    ],
  }),
  component: OrdersPage,
});

type OrderStatus =
  | "Chờ xác nhận"
  | "Đã xác nhận"
  | "Đang chuẩn bị"
  | "Đang giao"
  | "Hoàn thành"
  | "Đã hủy";

type AdminOrderRow = {
  id: number;
  order_code: string;
  store_id: number;
  store_name: string;
  order_type: "Delivery" | "Take-away" | "POS";
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  location_name: string | null;
  delivery_addr: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at: string;
  current_status: OrderStatus;
};

type OrderItem = {
  product_name: string;
  qty: number;
  size_label: string | null;
  base_tea: string;
  sugar_level: string;
  ice_level: string;
  note: string | null;
  unit_price: number;
  line_total: number;
  toppings: { name: string; price: number }[];
};

type AdminOrderFull = AdminOrderRow & {
  items: OrderItem[];
  status_history: {
    status: OrderStatus;
    note: string | null;
    changed_by_name: string | null;
    created_at: string;
  }[];
};

const statuses: ("Tất cả" | OrderStatus)[] = [
  "Tất cả",
  "Đang chuẩn bị",
  "Đang giao",
  "Hoàn thành",
  "Đã hủy",
];
const types = ["Tất cả", "Delivery", "Take-away", "POS"];
const payments = ["Tất cả", "COD", "VietQR", "MoMo", "ZaloPay"];

const statusTone: Record<string, string> = {
  "Chờ xác nhận": "bg-primary/15 text-primary",
  "Đã xác nhận": "bg-chart-5/15 text-chart-5",
  "Đang chuẩn bị": "bg-primary/15 text-primary",
  "Đang giao": "bg-accent text-accent-foreground",
  "Hoàn thành": "bg-leaf/15 text-leaf",
  "Đã hủy": "bg-berry/15 text-berry",
};

function OrdersPage() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [status, setStatus] = useState("Tất cả");
  const [type, setType] = useState("Tất cả");
  const [payment, setPayment] = useState("Tất cả");
  const [branchId, setBranchId] = useState("all");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    apiGet<{ id: number; name: string }[]>("/admin/branches")
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "Tất cả") params.set("status", status);
      if (branchId !== "all") params.set("store_id", branchId);
      if (q.trim()) params.set("search", q.trim());
      const rows = await apiGet<AdminOrderRow[]>(`/admin/orders?${params.toString()}`);
      setOrders(
        rows.filter(
          (o) =>
            (type === "Tất cả" || o.order_type === type) &&
            (payment === "Tất cả" || o.payment_method === payment),
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được đơn hàng");
    } finally {
      setLoading(false);
    }
  }, [status, type, payment, branchId, q]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  async function setStatusAndReload(orderId: number, next: OrderStatus) {
    setActionLoading(true);
    try {
      await apiPatch(`/admin/orders/${orderId}/status`, { status: next });
      toast.success(`Đơn #${orderId} → ${next}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Quản lý đơn hàng"
        desc={`${orders.length} đơn khớp bộ lọc · cập nhật real-time`}
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
            value={branchId}
            onChange={setBranchId}
            label="Chi nhánh"
            options={[
              { v: "all", l: "Tất cả chi nhánh" },
              ...branches.map((b) => ({ v: String(b.id), l: b.name })),
            ]}
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

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : view === "list" ? (
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
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_code}</TableCell>
                    <TableCell>
                      <p className="text-sm">{o.customer_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {fmtDateTime(o.created_at)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{o.store_name}</TableCell>
                    <TableCell className="text-sm">{o.order_type}</TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{o.payment_method}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[o.current_status]}`}
                      >
                        {o.current_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{vnd(o.total)}</TableCell>
                    <TableCell className="text-right">
                      <OrderDetail
                        orderId={o.id}
                        onChanged={load}
                        actionLoading={actionLoading}
                        setActionLoading={setActionLoading}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
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
                <Badge variant="secondary">{orders.filter((o) => o.current_status === col).length}</Badge>
              </p>
              <div className="space-y-3">
                {orders
                  .filter((o) => o.current_status === col)
                  .map((o) => (
                    <div key={o.id} className="bg-background rounded-xl border p-3">
                      <p className="text-sm font-semibold">{o.order_code}</p>
                      <p className="text-muted-foreground text-xs">
                        {o.customer_name} · {o.order_type}
                      </p>
                      <p className="text-primary mt-1 text-sm font-bold">{vnd(o.total)}</p>
                      <div className="mt-2">
                        <OrderDetail
                          orderId={o.id}
                          onChanged={load}
                          actionLoading={actionLoading}
                          setActionLoading={setActionLoading}
                        />
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

function toBillOrder(o: AdminOrderFull): BillOrder {
  return {
    id: o.id,
    order_code: o.order_code,
    store_name: o.store_name,
    location_name: o.location_name ?? null,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    payment_method: o.payment_method,
    created_at: o.created_at,
    items: o.items.map((it) => ({
      product_name: it.product_name,
      qty: it.qty,
      size_label: it.size_label ?? null,
      note: it.note ?? null,
      toppings: (it.toppings ?? []).map((t) => ({ name: t.name })),
      line_total: it.line_total,
    })),
    subtotal: o.subtotal,
    discount_amount: o.discount_amount,
    total: o.total,
  };
}

function OrderDetail({
  orderId,
  onChanged,
  actionLoading,
  setActionLoading,
}: {
  orderId: number;
  onChanged: () => void;
  actionLoading: boolean;
  setActionLoading: (v: boolean) => void;
}) {
  const [detail, setDetail] = useState<AdminOrderFull | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiGet<AdminOrderFull>(`/admin/orders/${orderId}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được chi tiết"));
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const [shipperOpen, setShipperOpen] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  async function changeStatus(next: string, extraData?: { driver_name?: string; driver_phone?: string; tracking_url?: string }) {
    setActionLoading(true);
    try {
      await apiPatch(`/admin/orders/${orderId}/status`, { status: next, ...extraData });
      toast.success(`Đơn #${orderId} → ${next}`);
      setShipperOpen(false);
      setOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await apiPut(`/admin/orders/${orderId}/cancel`, {
        reason: cancelReason.trim() || null,
      });
      toast.success("Đã hủy đơn hàng");
      setCancelOpen(false);
      setOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hủy đơn thất bại");
    } finally {
      setActionLoading(false);
    }
  }

  const st = detail?.current_status;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Eye className="mr-1 size-4" /> Chi tiết
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Đơn {detail?.order_code ?? `#${orderId}`}</DialogTitle>
          </DialogHeader>
          {!detail ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Khách hàng" value={detail.customer_name} />
                <Info label="Số điện thoại" value={detail.customer_phone} />
                <Info label="Chi nhánh" value={detail.store_name} />
                <Info label="Loại đơn" value={detail.order_type} />
                <Info label="Thanh toán" value={detail.payment_method} />
                <Info label="Trạng thái" value={st ?? ""} />
                {detail.location_name && <Info label="Vị trí" value={detail.location_name} />}
                {detail.delivery_addr && <Info label="Địa chỉ" value={detail.delivery_addr} />}
              </div>
              <div className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-semibold tracking-wide uppercase">Món đã đặt</p>
                <ul className="space-y-2">
                  {detail.items.map((it, idx) => (
                    <li key={idx} className="flex justify-between gap-3">
                      <span>
                        <span className="font-medium">
                          {it.qty}× {it.product_name}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {[
                            it.size_label ? `Size ${it.size_label}` : null,
                            it.base_tea || null,
                            it.sugar_level ? `${it.sugar_level} đường` : null,
                            it.ice_level ? `${it.ice_level} đá` : null,
                            it.toppings.length > 0 ? it.toppings.map((t) => t.name).join(", ") : null,
                            it.note ? `(${it.note})` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="font-semibold whitespace-nowrap">{vnd(it.line_total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {detail.status_history && detail.status_history.length > 0 && (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-semibold tracking-wide uppercase">Lịch sử trạng thái</p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    {detail.status_history.map((h, idx) => (
                      <li key={idx} className="flex justify-between gap-2">
                        <span>
                          {h.status}
                          {h.changed_by_name ? ` · ${h.changed_by_name}` : ""}
                        </span>
                        <span className="whitespace-nowrap">
                          {fmtDateTime(h.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-semibold">Tổng thanh toán</span>
                <span className="text-primary font-display text-lg font-extrabold">
                  {vnd(detail.total)}
                  {detail.discount_amount > 0 && (
                    <span className="text-muted-foreground text-xs font-normal">
                      {" "}
                      (giảm {vnd(detail.discount_amount)})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(st === "Đang chuẩn bị" || st === "Chờ xác nhận" || st === "Đã xác nhận") && (
                  <>
                    <Button
                      variant="hero"
                      className="flex-1"
                      disabled={actionLoading}
                      onClick={() => {
                        if (detail.order_type === "Delivery") {
                          setShipperOpen(true);
                        } else {
                          changeStatus("Đang giao");
                        }
                      }}
                    >
                      🚚 Chuyển Đang giao
                    </Button>
                    <Button
                      variant="soft"
                      className="flex-1"
                      disabled={actionLoading}
                      onClick={() => changeStatus("Hoàn thành")}
                    >
                      ✅ Hoàn thành
                    </Button>
                  </>
                )}
                {st === "Đang giao" && (
                  <Button
                    variant="hero"
                    className="flex-1"
                    disabled={actionLoading}
                    onClick={() => changeStatus("Hoàn thành")}
                  >
                    Xác nhận giao xong (Hoàn thành)
                  </Button>
                )}
                {st !== "Đã hủy" && st !== "Hoàn thành" && (
                  <Button
                    variant="outline"
                    className="text-berry flex-1"
                    disabled={actionLoading}
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle className="mr-1 size-4" /> Hủy đơn
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => setBillOpen(true)}>
                  <Printer className="mr-1 size-4" /> In bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Nhập thông tin Shipper & Link Tracking */}
      <Dialog open={shipperOpen} onOpenChange={setShipperOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Giao hàng — Thông tin Shipper / Live Tracking</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground text-xs">
              Nhập thông tin tài xế Grab, Ahamove... để khách hàng có thể xem live tracking trên trang theo dõi đơn.
            </p>
            <div>
              <label className="text-xs font-semibold">Tên Shipper</label>
              <Input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="VD: Nguyễn Văn A (Grab)"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Số điện thoại Shipper</label>
              <Input
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="VD: 0901234567"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Link Tracking (Grab / Ahamove)</label>
              <Input
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="VD: https://express.grab.com/tracking/..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setShipperOpen(false)}>Hủy</Button>
            <Button
              variant="hero"
              disabled={actionLoading}
              onClick={() =>
                changeStatus("Đang giao", {
                  driver_name: driverName.trim() || undefined,
                  driver_phone: driverPhone.trim() || undefined,
                  tracking_url: trackingUrl.trim() || undefined,
                })
              }
            >
              Xác nhận Đang giao
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <InBillModal
        order={detail ? toBillOrder(detail) : null}
        open={billOpen}
        onClose={() => setBillOpen(false)}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy đơn {detail?.order_code ?? `#${orderId}`}?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Lý do hủy"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Thoát</AlertDialogCancel>
            <AlertDialogAction
              className="bg-berry hover:bg-berry/90"
              disabled={actionLoading}
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
            >
              Xác nhận hủy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
