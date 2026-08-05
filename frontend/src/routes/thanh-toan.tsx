import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Bike, MapPin, Store, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/site/PageHeader";
import { useCart } from "@/lib/cart";
import { vnd } from "@/lib/data";
import { apiGet, apiPost } from "@/lib/api";

export const Route = createFileRoute("/thanh-toan")({
  validateSearch: (search: Record<string, unknown>): { table_id?: string } => ({
    table_id: typeof search.table_id === "string" ? search.table_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Giỏ hàng & Thanh toán — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Xác nhận đơn trà trái cây: chọn giao tận nơi hoặc lấy tại cửa hàng, áp mã ưu đãi và thanh toán COD, VietQR, MoMo, ZaloPay.",
      },
      { property: "og:title", content: "Thanh toán đơn trà — Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Đặt nhanh, thanh toán linh hoạt.",
      },
    ],
  }),
  component: Checkout,
});

const payMethods = [
  { id: "cod", label: "Thanh toán khi nhận hàng (COD)" },
  { id: "qr", label: "Chuyển khoản VietQR / VNPAY" },
  { id: "momo", label: "Ví MoMo" },
  { id: "zalopay", label: "Ví ZaloPay" },
];

const PAY_MAP: Record<string, string> = { cod: "COD", qr: "VietQR", momo: "MoMo", zalopay: "ZaloPay" };

type TableInfo = {
  table: { id: number; name: string; store_id: number; store_name: string; store_address: string };
};

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const { table_id: searchTableId } = useSearch({ from: "/thanh-toan" });

  const [method, setMethod] = useState<"delivery" | "takeaway">("delivery");
  const [pay, setPay] = useState("cod");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState("");
  const [branch, setBranch] = useState<string | null>(null);
  const [storeOptions, setStoreOptions] = useState<{ id: number; name: string }[]>([]);
  const [note, setNote] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [appliedCode, setAppliedCode] = useState("");
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tableId, setTableId] = useState<string | null>(
    searchTableId ||
      (typeof window !== "undefined" ? sessionStorage.getItem("teaplus_table_id") : null),
  );

  // Quét QR bàn → tự nhận diện bàn, mặc định "Tại bàn"
  useEffect(() => {
    if (!tableId) return;
    let cancelled = false;
    sessionStorage.setItem("teaplus_table_id", tableId);
    apiGet<TableInfo>(`/api/table/resolve?table_id=${encodeURIComponent(tableId)}`)
      .then((res) => {
        if (cancelled) return;
        setTableInfo(res);
        setMethod("takeaway");
        setBranch(String(res.table.store_id));
      })
      .catch(() => {
        if (!cancelled) setTableInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  const discount = Math.min(voucherDiscount, subtotal);
  const total = Math.max(0, subtotal - discount);

  async function applyVoucher() {
    if (!voucherCode.trim()) return toast.error("Nhập mã ưu đãi trước");
    try {
      const res = await apiPost<{ valid: boolean; discount_amount: number; message: string }>(
        "/api/vouchers/apply",
        { code: voucherCode.trim(), subtotal, customer_phone: phone || "khach" },
      );
      if (!res.valid) return toast.error(res.message);
      setVoucherDiscount(res.discount_amount);
      setAppliedCode(voucherCode.trim());
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không áp dụng được mã");
    }
  }

  // Chi nhánh thật từ API — ưu tiên chi nhánh đã chọn từ trang cửa hàng (teaplus_store_id)
  useEffect(() => {
    let cancelled = false;
    apiGet<{ id: number; name: string }[]>("/api/stores")
      .then((rows) => {
        if (cancelled || rows.length === 0) return;
        setStoreOptions(rows);
        const savedId = Number(sessionStorage.getItem("teaplus_store_id"));
        const tableStoreId = Number(tableId);
        const initial =
          rows.find((s) => s.id === savedId)?.id ??
          rows.find((s) => s.id === tableStoreId)?.id ??
          rows[0].id;
        setBranch((prev) => prev ?? String(initial));
      })
      .catch(() => {
        if (!cancelled) toast.error("Không tải được danh sách chi nhánh");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitOrder() {
    if (items.length === 0) return;
    if (!name.trim() || !phone.trim()) {
      return toast.error("Vui lòng nhập họ tên và số điện thoại");
    }
    if (!branch && !tableInfo) {
      return toast.error("Vui lòng chọn chi nhánh nhận hàng");
    }
    setSubmitting(true);
    try {
      // Map slug → id qua API (backend chỉ chấp nhận id int)
      const [products, sizes, toppings] = await Promise.all([
        apiGet<{ id: number; slug: string }[]>("/api/products"),
        apiGet<{ id: number; label: string }[]>("/api/options/sizes"),
        apiGet<{ id: number; name: string }[]>("/api/options/toppings"),
      ]);
      const productIdBySlug = new Map(products.map((p) => [p.slug, p.id]));
      const sizeIdByLabel = new Map(sizes.map((s) => [s.label.toLowerCase(), s.id]));
      const toppingIdByName = new Map(toppings.map((t) => [t.name.toLowerCase(), t.id]));

      const payload = {
        store_id: tableInfo ? tableInfo.table.store_id : Number(branch),
        table_id: tableId ? Number(tableId) : null,
        order_type: method === "delivery" ? "Delivery" : "Take-away",
        payment_method: PAY_MAP[pay] || "COD",
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_addr: method === "delivery" && addr.trim() ? addr.trim() : null,
        voucher_code: appliedCode || null,
        note: note.trim() || null,
        items: items.map((i) => ({
          product_id: productIdBySlug.get(i.productId),
          size_id: sizeIdByLabel.get(i.size.toLowerCase()) ?? null,
          base_tea: i.base,
          sugar_level: i.sugar,
          ice_level: i.ice,
          topping_ids: i.toppings
            .map((t) => toppingIdByName.get(t.toLowerCase()))
            .filter((id): id is number => id != null),
          qty: i.qty,
          note: i.note,
        })),
      };

      const res = await apiPost<{
        order_code: string;
        order_id: number;
        subtotal: number;
        discount_amount: number;
        total: number;
      }>("/api/orders", payload);

      clear();
      toast.success("Đặt hàng thành công!", {
        description: `Mã đơn ${res.order_code} · ${vnd(res.total)} — đang chờ xác nhận.`,
      });
      navigate({ to: "/theo-doi-don", search: { code: res.order_code } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đặt hàng thất bại, thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Checkout" title="Giỏ hàng & Thanh toán" />

      {tableInfo && (
        <div className="container-page">
          <div className="gradient-warm text-primary-foreground flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 px-5 py-4 shadow-glow">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 flex size-11 shrink-0 items-center justify-center rounded-xl">
                <MapPin className="size-6" />
              </span>
              <div>
                <p className="font-display text-base font-bold">
                  Đặt món tại: {tableInfo.table.name}
                </p>
                <p className="text-sm opacity-90">
                  {tableInfo.table.store_name} · {tableInfo.table.store_address}
                </p>
              </div>
            </div>
            <span className="bg-white/20 rounded-full px-3 py-1 text-xs font-semibold">
              Bàn đã được gắn vào đơn
            </span>
          </div>
        </div>
      )}

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Items */}
          <section className="bg-card rounded-2xl border p-5">
            <h2 className="font-display mb-4 text-lg font-bold">Món đã chọn ({items.length})</h2>
            {items.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-muted-foreground text-sm">Giỏ hàng trống.</p>
                <Button asChild variant="hero" size="sm" className="mt-3">
                  <Link to="/menu">Chọn món ngay</Link>
                </Button>
              </div>
            )}
            <div className="space-y-4">
              {items.map((i) => (
                <div key={i.key} className="flex gap-3 border-b pb-4 last:border-0 last:pb-0">
                  <img
                    src={i.image}
                    alt={i.name}
                    loading="lazy"
                    className="size-16 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Size {i.size} · {i.base} · {i.sugar} đường · {i.ice} đá
                    </p>
                    {i.toppings.length > 0 && (
                      <p className="text-muted-foreground text-xs">
                        Topping: {i.toppings.join(", ")}
                      </p>
                    )}
                    {i.note && (
                      <p className="text-muted-foreground text-xs italic">Ghi chú: {i.note}</p>
                    )}
                    <p className="text-primary mt-1 font-bold text-sm">
                      {vnd(i.unitPrice)} × {i.qty}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Fulfilment */}
          <section className="bg-card rounded-2xl border p-5">
            <h2 className="font-display mb-4 text-lg font-bold">Hình thức nhận hàng</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setMethod("delivery")}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left ${method === "delivery" ? "border-primary bg-accent/50" : ""}`}
              >
                <Bike className="text-primary size-5" />
                <div>
                  <p className="text-sm font-semibold">Giao tận nơi</p>
                  <p className="text-muted-foreground text-xs">25–35 phút</p>
                </div>
              </button>
              <button
                onClick={() => setMethod("takeaway")}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left ${method === "takeaway" ? "border-primary bg-accent/50" : ""}`}
              >
                <Store className="text-primary size-5" />
                <div>
                  <p className="text-sm font-semibold">
                    {tableInfo ? "Đến lấy / Tại bàn" : "Đến lấy tại cửa hàng"}
                  </p>
                  <p className="text-muted-foreground text-xs">Sẵn sàng sau 15 phút</p>
                </div>
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Họ và tên</Label>
                <Input
                  id="name"
                  placeholder="Nguyễn Minh Trang"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tel">Số điện thoại</Label>
                <Input
                  id="tel"
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {method === "delivery" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr">Địa chỉ giao hàng</Label>
                  <Input
                    id="addr"
                    placeholder="Số nhà, đường, phường, quận"
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Chi nhánh nhận hàng</Label>
                  <Select
                    value={branch ?? undefined}
                    onValueChange={setBranch}
                    disabled={!!tableInfo || storeOptions.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {storeOptions.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tableInfo && (
                    <p className="text-muted-foreground text-xs">
                      Bàn {tableInfo.table.name} — {tableInfo.table.store_name}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Textarea
                  id="note"
                  rows={2}
                  placeholder="VD: Ít đá hơn, gọi trước khi giao…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="bg-card rounded-2xl border p-5">
            <h2 className="font-display mb-4 text-lg font-bold">Phương thức thanh toán</h2>
            <RadioGroup value={pay} onValueChange={setPay} className="grid gap-2 sm:grid-cols-2">
              {payMethods.map((m) => (
                <label
                  key={m.id}
                  htmlFor={`pay-${m.id}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${pay === m.id ? "border-primary bg-accent/40" : ""}`}
                >
                  <RadioGroupItem value={m.id} id={`pay-${m.id}`} />
                  {m.label}
                </label>
              ))}
            </RadioGroup>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-32 lg:h-fit">
          <div className="bg-card space-y-4 rounded-2xl border p-5">
            <h2 className="font-display text-lg font-bold">Tóm tắt đơn hàng</h2>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder="Nhập mã ưu đãi"
                  className="pl-9"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                />
              </div>
              <Button variant="soft" onClick={applyVoucher} disabled={!!appliedCode}>
                {appliedCode ? "Đã áp dụng" : "Áp dụng"}
              </Button>
            </div>
            {appliedCode && (
              <p className="text-leaf text-xs font-medium">
                Mã {appliedCode}: giảm {vnd(discount)}
              </p>
            )}

            <Separator />

            <div className="space-y-2 text-sm">
              <Row label="Tiền món" value={vnd(subtotal)} />
              <Row label="Giảm giá" value={discount ? `− ${vnd(discount)}` : "0₫"} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="font-semibold">Tổng thanh toán</span>
              <span className="text-primary font-display text-2xl font-extrabold">
                {vnd(total)}
              </span>
            </div>

            <Button
              variant="hero"
              className="w-full"
              disabled={items.length === 0 || submitting}
              onClick={submitOrder}
            >
              {submitting ? "Đang đặt hàng…" : "Xác nhận đặt hàng"}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Tổng tiền do hệ thống tính toán chính xác từ giá niêm yết.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
