import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { b as vnd, t as Button } from "./data-BKElHwIS.mjs";
import { S as Printer, t as X } from "../_libs/lucide-react.mjs";
import { i as apiPost } from "./api-CyIKtyVS.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, t as Dialog } from "./dialog-Bztdc_I8.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as require_lib } from "../_libs/qrcode.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/InBillModal-HmVgg5fA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_lib = /* @__PURE__ */ __toESM(require_lib());
function billHtml(order, qrDataUrl) {
	const rows = order.items.map((it) => {
		const opts = [
			it.size_label || null,
			it.toppings && it.toppings.length > 0 ? it.toppings.map((t) => t.name).join(", ") : null,
			it.note ? `(${it.note})` : null
		].filter(Boolean).join(" · ");
		return `
        <tr>
          <td colspan="2"><strong>${it.qty}× ${it.product_name}</strong></td>
        </tr>
        ${opts ? `<tr><td class="dim" colspan="2">${opts}</td></tr>` : ""}
        <tr><td></td><td class="right">${vnd(it.line_total)}</td></tr>`;
	}).join("");
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
function InBillModal({ order, open, onClose }) {
	const [qrDataUrl, setQrDataUrl] = (0, import_react.useState)(null);
	const [printing, setPrinting] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!open || !order) return;
		let cancelled = false;
		import_lib.toDataURL(`${window.location.origin}/theo-doi-don?code=${order.order_code}`, {
			width: 180,
			margin: 1
		}).then((url) => {
			if (!cancelled) setQrDataUrl(url);
		}).catch(() => {
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "sm:max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-4" }),
						" Hóa đơn ",
						order.order_code
					]
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-black/90 mx-auto w-[80mm] max-w-full rounded-lg p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white p-3 text-[11px] leading-relaxed text-black",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-center text-sm font-bold",
								children: "TRÀ TRÁI CÂY TÔ"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-center text-[10px] text-neutral-500",
								children: order.store_name || "Hệ thống cửa hàng trà trái cây"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-center text-[10px] text-neutral-500",
								children: "Hotline 1900 8386"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "my-2 border-t border-dashed border-black" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-bold",
								children: ["Mã đơn: ", order.order_code]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: order.location_name ? `Bàn: ${order.location_name}` : `Loại: ${order.payment_method || "Take-away"}` }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Giờ: ", new Date(order.created_at).toLocaleString("vi-VN")] }),
							order.customer_name && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								"Khách: ",
								order.customer_name,
								order.customer_phone ? ` · ${order.customer_phone}` : ""
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "my-2 border-t border-dashed border-black" }),
							order.items.map((it, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-semibold",
								children: [
									it.qty,
									"× ",
									it.product_name
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-neutral-500",
									children: [
										it.size_label || null,
										it.toppings && it.toppings.length > 0 ? it.toppings.map((t) => t.name).join(", ") : null,
										it.note ? `(${it.note})` : null
									].filter(Boolean).join(" · ")
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: vnd(it.line_total)
								})]
							})] }, idx)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "my-2 border-t border-dashed border-black" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tiền món" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: vnd(order.subtotal) })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Giảm giá" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: order.discount_amount ? `− ${vnd(order.discount_amount)}` : "0₫" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex justify-between text-sm font-bold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "TỔNG CỘNG" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: vnd(order.total) })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "my-2 border-t border-dashed border-black" }),
							qrDataUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex justify-center py-1",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: qrDataUrl,
									alt: "QR theo dõi đơn",
									className: "size-28"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-center text-[10px] text-neutral-500",
								children: "Quét mã QR để theo dõi đơn hàng"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-center font-bold",
								children: "Cảm ơn quý khách!"
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						className: "flex-1",
						onClick: onClose,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), " Đóng"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "hero",
						className: "flex-1",
						onClick: handlePrint,
						disabled: printing,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-4" }),
							" ",
							printing ? "Đang in…" : "In hóa đơn"
						]
					})]
				})
			]
		})
	});
}
//#endregion
export { InBillModal as t };
