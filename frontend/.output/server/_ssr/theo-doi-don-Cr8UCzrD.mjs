import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { $ as CupSoda, E as PartyPopper, P as MapPin, R as LoaderCircle, dt as Check, it as ClipboardCheck, l as Timer, mt as Bike, ot as CircleX, y as Search } from "../_libs/lucide-react.mjs";
import { _ as vnd } from "./data-Z_klJ5jj.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as apiPost, n as apiGet } from "./api-Cnar3gwH.mjs";
import { n as CardContent, t as Card } from "./card-N78Fb1PV.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Route } from "./theo-doi-don-DjCbFQlj.mjs";
import { a as AlertDialogDescription, c as AlertDialogTitle, i as AlertDialogContent, n as AlertDialogAction, o as AlertDialogFooter, r as AlertDialogCancel, s as AlertDialogHeader, t as AlertDialog } from "./alert-dialog-DTqLMw86.mjs";
import { t as PageHeader } from "./PageHeader-4GMedA0k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/theo-doi-don-Cr8UCzrD.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var steps = [
	{
		status: "Chờ xác nhận",
		icon: Timer,
		desc: "Hệ thống đã nhận đơn"
	},
	{
		status: "Đã xác nhận",
		icon: ClipboardCheck,
		desc: "Cửa hàng đã chấp nhận đơn"
	},
	{
		status: "Đang chuẩn bị",
		icon: CupSoda,
		desc: "Barista đang pha chế trà"
	},
	{
		status: "Đang giao",
		icon: Bike,
		desc: "Shipper đang trên đường"
	},
	{
		status: "Hoàn thành",
		icon: PartyPopper,
		desc: "Giao thành công"
	}
];
function itemOptions(it) {
	return [
		it.size_label ? `Size ${it.size_label}` : null,
		it.base_tea ? it.base_tea : null,
		it.sugar_level ? `${it.sugar_level} đường` : null,
		it.ice_level ? `${it.ice_level} đá` : null,
		it.toppings.length > 0 ? it.toppings.map((t) => t.name).join(", ") : null
	].filter(Boolean).join(" · ");
}
function Tracking() {
	const { code: searchCode } = Route.useSearch();
	const [input, setInput] = (0, import_react.useState)(searchCode ?? "");
	const [order, setOrder] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [cancelOpen, setCancelOpen] = (0, import_react.useState)(false);
	const [cancelReason, setCancelReason] = (0, import_react.useState)("");
	const [cancelling, setCancelling] = (0, import_react.useState)(false);
	const timerRef = (0, import_react.useRef)(null);
	const load = (0, import_react.useCallback)(async (c, silent = false) => {
		if (!c.trim()) return;
		if (!silent) {
			setLoading(true);
			setError("");
		}
		try {
			const res = await apiGet(`/api/orders/lookup?code=${encodeURIComponent(c.trim())}`);
			setOrder(res.order);
			setError("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Không tìm thấy đơn hàng");
			if (!silent) setOrder(null);
		} finally {
			if (!silent) setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		if (searchCode) load(searchCode);
	}, [searchCode, load]);
	(0, import_react.useEffect)(() => {
		if (!order) return;
		timerRef.current = window.setInterval(() => {
			load(order.order_code, true);
		}, 5e3);
		return () => {
			if (timerRef.current) window.clearInterval(timerRef.current);
		};
	}, [order?.order_code, load]);
	async function handleCancel() {
		if (!order) return;
		setCancelling(true);
		try {
			await apiPost(`/api/orders/${order.id}/cancel`, { reason: cancelReason.trim() || null });
			toast.success("Đã hủy đơn hàng");
			setCancelOpen(false);
			await load(order.order_code);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Hủy đơn thất bại");
		} finally {
			setCancelling(false);
		}
	}
	if (loading && !order) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Tracking",
		title: "Theo dõi đơn hàng",
		desc: "Đang tải thông tin đơn…"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex items-center justify-center py-24 text-muted-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
	})] });
	if (!order) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Tracking",
		title: "Theo dõi đơn hàng",
		desc: "Nhập mã đơn để xem trạng thái"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "container-page py-10",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "mx-auto max-w-md",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
				className: "space-y-4 p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-sm",
						children: error || "Quét mã QR trên hóa đơn hoặc nhập mã đơn (VD: TP2608051234) để theo dõi."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "flex gap-2",
						onSubmit: (e) => {
							e.preventDefault();
							load(input);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: input,
							onChange: (e) => setInput(e.target.value),
							placeholder: "Nhập mã đơn",
							className: "uppercase"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "submit",
							variant: "hero",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "mr-1 size-4" }), " Tra cứu"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "soft",
						className: "w-full",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/menu",
							children: "Đặt món mới"
						})
					})
				]
			})
		})
	})] });
	const cancelled = order.current_status === "Đã hủy";
	const currentStep = steps.findIndex((s) => s.status === order.current_status);
	const completed = order.current_status === "Hoàn thành";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Tracking",
			title: `Đơn ${order.order_code}`,
			desc: `${order.store_name}${order.location_name ? ` · ${order.location_name}` : ""} · cập nhật mỗi 5 giây`
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "bg-card rounded-2xl border p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-xs",
							children: "Mã đơn"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-xl font-extrabold",
							children: order.order_code
						})] }), cancelled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							className: "bg-berry/15 text-berry",
							children: "Đã hủy"
						}) : completed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							className: "bg-leaf/15 text-leaf",
							children: "Hoàn thành"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							className: "bg-primary/15 text-primary animate-pulse",
							children: order.current_status
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mt-8 space-y-0",
						children: steps.map((s, i) => {
							const done = !cancelled && currentStep >= 0 && i < currentStep;
							const active = !cancelled && i === currentStep;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "relative flex gap-4 pb-8 last:pb-0",
								children: [
									i < steps.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-10 left-5 h-full w-0.5 ${cancelled ? "bg-berry/20" : done || completed && i < steps.length - 1 ? "bg-leaf" : "bg-border"}` }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 ${cancelled ? i === 0 ? "bg-berry/15 border-berry/40 text-berry" : "bg-card border-border text-muted-foreground opacity-50" : done || completed ? "bg-leaf border-leaf text-leaf-foreground" : active ? "gradient-warm border-primary text-primary-foreground animate-pulse" : "bg-card border-border text-muted-foreground"}`,
										children: cancelled ? i === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-5" }) : done || completed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(s.icon, { className: "size-5" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "pt-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: `text-sm font-bold ${active ? "text-primary" : done || completed ? "text-foreground" : "text-muted-foreground"}`,
											children: s.status
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted-foreground text-xs",
											children: cancelled && i === 0 ? order.status_history.find((h) => h.status === "Đã hủy")?.note || "Đã hủy" : s.desc
										})]
									})
								]
							}, s.status);
						})
					}),
					order.current_status === "Chờ xác nhận" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						className: "text-berry w-full",
						onClick: () => setCancelOpen(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "size-4" }), " Hủy đơn hàng"]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "shadow-soft",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
						className: "p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display mb-3 text-lg font-bold",
								children: "Chi tiết đơn"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "text-muted-foreground space-y-3 text-sm",
								children: order.items.map((it, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-foreground font-semibold",
										children: [
											it.qty,
											"× ",
											it.product_name
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: itemOptions(it) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-primary mt-0.5 font-semibold",
										children: vnd(it.line_total)
									})
								] }, idx))
							}),
							order.note && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "bg-muted/60 text-muted-foreground mt-3 rounded-lg p-2 text-xs",
								children: ["Ghi chú: ", order.note]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 flex justify-between border-t pt-3 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: "Tiền món"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: vnd(order.subtotal) })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex justify-between text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: "Giảm giá"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: order.discount_amount ? `− ${vnd(order.discount_amount)}` : "0₫" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex justify-between border-t pt-3 font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tổng thanh toán" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-primary",
									children: vnd(order.total)
								})]
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "shadow-soft",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
						className: "space-y-2 p-5 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-base font-bold",
								children: "Thông tin nhận hàng"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "text-primary mt-0.5 size-4 shrink-0" }), order.location_name ? `${order.location_name} · ${order.store_name}` : order.delivery_addr || `${order.store_name} (Take-away)`]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground text-xs",
								children: [
									order.customer_name,
									" · ",
									order.payment_method,
									" ·",
									" ",
									new Date(order.created_at).toLocaleString("vi-VN")
								]
							})
						]
					})
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
			open: cancelOpen,
			onOpenChange: setCancelOpen,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
					"Hủy đơn ",
					order.order_code,
					"?"
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "Đơn chỉ hủy được khi đang ở trạng thái \"Chờ xác nhận\". Hành động này không thể hoàn tác." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: cancelReason,
					onChange: (e) => setCancelReason(e.target.value),
					placeholder: "Lý do hủy (không bắt buộc)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Giữ đơn" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
					className: "bg-berry hover:bg-berry/90",
					disabled: cancelling,
					onClick: (e) => {
						e.preventDefault();
						handleCancel();
					},
					children: cancelling ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : "Xác nhận hủy"
				})] })
			] })
		})
	] });
}
//#endregion
export { Tracking as component };
