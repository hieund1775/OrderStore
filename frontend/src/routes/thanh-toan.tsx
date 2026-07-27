import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bike, Store, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { stores, vnd } from "@/lib/data";

export const Route = createFileRoute("/thanh-toan")({
  head: () => ({
    meta: [
      { title: "Giỏ hàng & Thanh toán — Tiệm Trà Vườn Xanh" },
      {
        name: "description",
        content:
          "Xác nhận đơn trà trái cây: chọn giao tận nơi hoặc lấy tại cửa hàng, áp mã ưu đãi và thanh toán COD, VietQR, MoMo, ZaloPay.",
      },
      { property: "og:title", content: "Thanh toán đơn trà — Vườn Xanh" },
      {
        property: "og:description",
        content: "Đặt nhanh, thanh toán linh hoạt, tích điểm tự động.",
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

function Checkout() {
  const { items, subtotal, setQty, removeItem, clear } = useCart();
  const navigate = useNavigate();
  const [method, setMethod] = useState<"delivery" | "takeaway">("delivery");
  const [pay, setPay] = useState("cod");
  const [usePoints, setUsePoints] = useState(false);

  const shipping = method === "delivery" && subtotal > 0 ? (subtotal >= 99000 ? 0 : 18000) : 0;
  const pointDiscount = usePoints ? Math.min(50000, Math.floor(subtotal * 0.1)) : 0;
  const total = Math.max(0, subtotal + shipping - pointDiscount);

  return (
    <>
      <PageHeader eyebrow="Checkout" title="Giỏ hàng & Thanh toán" />

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
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-1 rounded-full border px-1.5 py-0.5">
                        <button onClick={() => setQty(i.key, i.qty - 1)} className="px-1.5">
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-bold">{i.qty}</span>
                        <button onClick={() => setQty(i.key, i.qty + 1)} className="px-1.5">
                          +
                        </button>
                      </div>
                      <button
                        className="text-muted-foreground text-xs underline"
                        onClick={() => removeItem(i.key)}
                      >
                        Xóa
                      </button>
                      <span className="text-primary ml-auto font-bold">
                        {vnd(i.unitPrice * i.qty)}
                      </span>
                    </div>
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
                  <p className="text-sm font-semibold">Đến lấy tại cửa hàng</p>
                  <p className="text-muted-foreground text-xs">Sẵn sàng sau 15 phút</p>
                </div>
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Họ và tên</Label>
                <Input id="name" placeholder="Nguyễn Minh Trang" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tel">Số điện thoại</Label>
                <Input id="tel" inputMode="tel" placeholder="09xx xxx xxx" />
              </div>
              {method === "delivery" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr">Địa chỉ giao hàng</Label>
                  <Input id="addr" placeholder="Số nhà, đường, phường, quận" />
                </div>
              ) : (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Chi nhánh nhận hàng</Label>
                  <Select defaultValue={stores[0].id}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="note">Ghi chú cho tài xế</Label>
                <Textarea
                  id="note"
                  rows={2}
                  placeholder="VD: Gọi trước khi giao, gửi lễ tân tầng 3…"
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
                <Input placeholder="Nhập mã ưu đãi" className="pl-9" />
              </div>
              <Button variant="soft" onClick={() => toast.success("Đã áp dụng mã ưu đãi")}>
                Áp dụng
              </Button>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={usePoints} onCheckedChange={(c) => setUsePoints(!!c)} />
              Dùng 1.820 điểm tích lũy để trừ tiền
            </label>

            <Separator />

            <div className="space-y-2 text-sm">
              <Row label="Tiền món" value={vnd(subtotal)} />
              <Row label="Phí giao hàng" value={shipping === 0 ? "Miễn phí" : vnd(shipping)} />
              <Row label="Giảm giá" value={pointDiscount ? `− ${vnd(pointDiscount)}` : "0₫"} />
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
              disabled={items.length === 0}
              onClick={() => {
                toast.success("Đặt hàng thành công!", {
                  description: "Đơn VX240726 đang chờ xác nhận.",
                });
                clear();
                navigate({ to: "/theo-doi-don" });
              }}
            >
              Xác nhận đặt hàng
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Bạn sẽ nhận thêm {Math.floor(total / 10000)} điểm sau khi đơn hoàn tất.
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
