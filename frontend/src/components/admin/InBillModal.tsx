import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiPost } from "@/lib/api";
import { vnd } from "@/lib/data";

export type BillItem = {
  product_name: string;
  qty: number;
  size_label?: string | null;
  note?: string | null;
  toppings?: { name: string }[];
  line_total: number;
};

export type BillOrder = {
  id: number;
  order_code: string;
  store_name?: string;
  location_name?: string | null;
  customer_name?: string;
  customer_phone?: string;
  payment_method?: string;
  created_at: string;
  items: BillItem[];
  subtotal: number;
  discount_amount: number;
  total: number;
};

function billHtml(order: BillOrder, qrDataUrl: string | null) {
  const rows = order.items
    .map((it) => {
      const opts = [
        it.size_label || null,
        it.toppings && it.toppings.length > 0 ? it.toppings.map((t) => t.name).join(", ") : null,
        it.note ? `(${it.note})` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr>
          <td colspan="2"><strong>${it.qty}× ${it.product_name}</strong></td>
        </tr>
        ${opts ? `<tr><td class="dim" colspan="2">${opts}</td></tr>` : ""}
        <tr><td></td><td class="right">${vnd(it.line_total)}</td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Hóa đơn ${order.order_code}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; color: #000; font-size: 12px; line-height: 1.45; }
  h1 { font-size: 15px; text-align: center; }
  .center { text-align: center; }
  .dim { color: #444; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  .right { text-align: right; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .total { font-size: 14px; font-weight: bold; }
  .qr { text-align: center; margin: 8px 0; }
  .qr img { width: 42mm; height: 42mm; }
  @media print { body { width: 72mm; } @page { size: 80mm auto; margin: 4mm; } }
</style>
</head>
<body>
  <h1>TRÀ TRÁI CÂY TÔ</h1>
  <p class="center dim">${order.store_name || "Hệ thống cửa hàng trà trái cây"}</p>
  <p class="center dim">Hotline 1900 8386</p>
  <div class="sep"></div>
  <p><strong>Mã đơn:</strong> ${order.order_code}</p>
  <p>${order.location_name ? `<strong>Bàn:</strong> ${order.location_name}` : `<strong>Loại:</strong> ${order.payment_method || "Take-away"}`}</p>
  <p><strong>Giờ:</strong> ${new Date(order.created_at).toLocaleString("vi-VN")}</p>
  ${order.customer_name ? `<p><strong>Khách:</strong> ${order.customer_name}${order.customer_phone ? " · " + order.customer_phone : ""}</p>` : ""}
  <div class="sep"></div>
  <table>${rows}</table>
  <div class="sep"></div>
  <table>
    <tr><td>Tiền món</td><td class="right">${vnd(order.subtotal)}</td></tr>
    <tr><td>Giảm giá</td><td class="right">${order.discount_amount ? "− " + vnd(order.discount_amount) : "0₫"}</td></tr>
    <tr class="total"><td>TỔNG CỘNG</td><td class="right">${vnd(order.total)}</td></tr>
  </table>
  <div class="sep"></div>
  ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="QR đơn" /></div>` : ""}
  <p class="center dim">Quét mã QR để theo dõi đơn hàng</p>
  <p class="center"><strong>Cảm ơn quý khách!</strong></p>
  <p class="center dim">Trà đậm vị – Trái cây tươi mỗi ngày</p>
</body>
</html>`;
}

export function InBillModal({
  order,
  open,
  onClose,
}: {
  order: BillOrder | null;
  open: boolean;
  onClose: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open || !order) return;
    let cancelled = false;
    QRCode.toDataURL(
      `${window.location.origin}/theo-doi-don?code=${order.order_code}`,
      { width: 180, margin: 1 },
    )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, order]);

  async function handlePrint() {
    if (!order) return;
    setPrinting(true);
    try {
      await apiPost(`/admin/orders/${order.id}/print`, {});
      const w = window.open("", "_blank", "width=420,height=640");
      if (!w) return toast.error("Trình duyệt chặn cửa sổ in — hãy cho phép popup");
      w.document.write(billHtml(order, qrDataUrl));
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
      toast.success("Đã in hóa đơn");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "In hóa đơn thất bại");
    } finally {
      setPrinting(false);
    }
  }

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="size-4" /> Hóa đơn {order.order_code}
          </DialogTitle>
        </DialogHeader>

        {/* Preview bill 80mm */}
        <div className="bg-black/90 mx-auto w-[80mm] max-w-full rounded-lg p-4">
          <div className="bg-white p-3 text-[11px] leading-relaxed text-black">
            <p className="text-center text-sm font-bold">TRÀ TRÁI CÂY TÔ</p>
            <p className="text-center text-[10px] text-neutral-500">
              {order.store_name || "Hệ thống cửa hàng trà trái cây"}
            </p>
            <p className="text-center text-[10px] text-neutral-500">Hotline 1900 8386</p>
            <div className="my-2 border-t border-dashed border-black" />
            <p className="font-bold">Mã đơn: {order.order_code}</p>
            <p>
              {order.location_name
                ? `Bàn: ${order.location_name}`
                : `Loại: ${order.payment_method || "Take-away"}`}
            </p>
            <p>Giờ: {new Date(order.created_at).toLocaleString("vi-VN")}</p>
            {order.customer_name && (
              <p>
                Khách: {order.customer_name}
                {order.customer_phone ? ` · ${order.customer_phone}` : ""}
              </p>
            )}
            <div className="my-2 border-t border-dashed border-black" />
            {order.items.map((it, idx) => (
              <div key={idx}>
                <p className="font-semibold">
                  {it.qty}× {it.product_name}
                </p>
                <div className="flex justify-between gap-2">
                  <span className="text-[10px] text-neutral-500">
                    {[
                      it.size_label || null,
                      it.toppings && it.toppings.length > 0
                        ? it.toppings.map((t) => t.name).join(", ")
                        : null,
                      it.note ? `(${it.note})` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="font-medium">{vnd(it.line_total)}</span>
                </div>
              </div>
            ))}
            <div className="my-2 border-t border-dashed border-black" />
            <div className="flex justify-between">
              <span>Tiền món</span>
              <span>{vnd(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Giảm giá</span>
              <span>{order.discount_amount ? `− ${vnd(order.discount_amount)}` : "0₫"}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm font-bold">
              <span>TỔNG CỘNG</span>
              <span>{vnd(order.total)}</span>
            </div>
            <div className="my-2 border-t border-dashed border-black" />
            {qrDataUrl && (
              <div className="flex justify-center py-1">
                <img src={qrDataUrl} alt="QR theo dõi đơn" className="size-28" />
              </div>
            )}
            <p className="text-center text-[10px] text-neutral-500">
              Quét mã QR để theo dõi đơn hàng
            </p>
            <p className="mt-1 text-center font-bold">Cảm ơn quý khách!</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            <X className="size-4" /> Đóng
          </Button>
          <Button variant="hero" className="flex-1" onClick={handlePrint} disabled={printing}>
            <Printer className="size-4" /> {printing ? "Đang in…" : "In hóa đơn"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
