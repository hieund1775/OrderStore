import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { G as Flame, P as MapPin, S as Printer, n as Volume2, tt as Clock, w as Phone } from "../_libs/lucide-react.mjs";
import { n as apiGet, r as apiPatch } from "./api-CyIKtyVS.mjs";
import { t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, t as Dialog } from "./dialog-Di5jevJl.mjs";
import { t as InBillModal } from "./InBillModal-YvFWzWoI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.bep-D2Kj9ymB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function toBillOrder(o) {
	return {
		id: o.id,
		order_code: o.order_code,
		store_name: o.store_name,
		location_name: o.location_name,
		customer_name: o.customer_name,
		customer_phone: o.customer_phone,
		payment_method: o.payment_method,
		created_at: o.created_at,
		items: o.items.map((it) => ({
			product_name: it.product_name,
			qty: it.qty,
			size_label: it.size_label,
			note: it.note,
			toppings: it.toppings,
			line_total: it.line_total
		})),
		subtotal: o.subtotal,
		discount_amount: o.discount_amount,
		total: o.total
	};
}
var lanes = [
	{
		id: "wait",
		label: "🔴 Chờ làm",
		ring: "border-primary/40 bg-primary/5"
	},
	{
		id: "prep",
		label: "🟡 Đang chuẩn bị",
		ring: "border-chart-5/40 bg-chart-5/5"
	},
	{
		id: "done",
		label: "🟢 Hoàn thành",
		ring: "border-leaf/40 bg-leaf/5"
	}
];
var WAIT_STATUSES = ["Chờ xác nhận", "Đã xác nhận"];
var DONE_AFTER_MS = 300 * 1e3;
var LATE_AFTER_MINUTES = 15;
var POLL_MS = 1e4;
function laneOf(status) {
	if (WAIT_STATUSES.includes(status)) return "wait";
	if (status === "Đang chuẩn bị") return "prep";
	return "done";
}
function fmtMinutes(ms) {
	const m = Math.max(0, Math.floor(ms / 6e4));
	const s = Math.max(0, Math.floor(ms % 6e4 / 1e3));
	return `${m}′${String(s).padStart(2, "0")}″`;
}
var audioCtx = null;
function playDingDong() {
	try {
		if (!audioCtx) audioCtx = new AudioContext();
		if (audioCtx.state === "suspended") audioCtx.resume();
		const now = audioCtx.currentTime;
		const playNote = (freq, at, dur) => {
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(1e-4, at);
			gain.gain.exponentialRampToValueAtTime(.35, at + .02);
			gain.gain.exponentialRampToValueAtTime(1e-4, at + dur);
			osc.connect(gain).connect(audioCtx.destination);
			osc.start(at);
			osc.stop(at + dur + .05);
		};
		playNote(1318.5, now, .6);
		playNote(1046.5, now + .35, .9);
	} catch {}
}
function KdsPage() {
	const [orders, setOrders] = (0, import_react.useState)([]);
	const [doneOrders, setDoneOrders] = (0, import_react.useState)([]);
	const [doneAt, setDoneAt] = (0, import_react.useState)({});
	const [newIds, setNewIds] = (0, import_react.useState)({});
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [billOpen, setBillOpen] = (0, import_react.useState)(false);
	const [now, setNow] = (0, import_react.useState)(Date.now());
	const [soundEnabled, setSoundEnabled] = (0, import_react.useState)(false);
	const prevIds = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const fetchOrders = (0, import_react.useCallback)(async () => {
		try {
			const rows = await apiGet("/admin/kitchen/orders");
			setOrders(rows);
			const ids = new Set(rows.map((o) => o.id));
			const fresh = rows.filter((o) => !prevIds.current.has(o.id));
			if (fresh.length > 0) {
				setNewIds((s) => ({
					...s,
					...Object.fromEntries(fresh.map((o) => [o.id, true]))
				}));
				if (soundEnabled) {
					playDingDong();
					toast.success(`Có ${fresh.length} đơn mới!`, { description: fresh[0].order_code });
				}
				setTimeout(() => {
					setNewIds((s) => {
						const next = { ...s };
						fresh.forEach((o) => delete next[o.id]);
						return next;
					});
				}, 6e3);
			}
			prevIds.current = ids;
		} catch {}
	}, [soundEnabled]);
	(0, import_react.useEffect)(() => {
		fetchOrders();
		const t = setInterval(fetchOrders, POLL_MS);
		return () => clearInterval(t);
	}, [fetchOrders]);
	(0, import_react.useEffect)(() => {
		const t = setInterval(() => {
			const ts = Date.now();
			setNow(ts);
			setDoneOrders((prev) => prev.filter((o) => ts - (doneAt[o.id] || ts) < DONE_AFTER_MS));
		}, 1e3);
		return () => clearInterval(t);
	}, [doneAt]);
	async function move(o, target) {
		const status = target === "prep" ? "Đang chuẩn bị" : "Hoàn thành";
		try {
			await apiPatch(`/admin/orders/${o.id}/status`, { status });
			if (target === "done") {
				setDoneAt((s) => ({
					...s,
					[o.id]: Date.now()
				}));
				setDoneOrders((s) => [...s.filter((x) => x.id !== o.id), o]);
			}
			toast.success(`Đơn ${o.order_code} → ${lanes.find((l) => l.id === target)?.label}`);
			fetchOrders();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Chuyển trạng thái thất bại");
		}
	}
	async function moveBack(o) {
		try {
			await apiPatch(`/admin/orders/${o.id}/status`, { status: "Đang chuẩn bị" });
			setDoneOrders((s) => s.filter((x) => x.id !== o.id));
			toast.success(`Đơn ${o.order_code} → 🟡 Đang chuẩn bị`);
			fetchOrders();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lùi trạng thái thất bại");
		}
	}
	const orderInLane = (lane) => {
		if (lane === "done") return doneOrders;
		return orders.filter((o) => laneOf(o.current_status) === lane);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Màn hình bếp (KDS)",
			desc: "Đơn quá 15 phút sẽ chuyển đỏ — đơn hoàn thành tự ẩn sau 5 phút"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-4 flex items-center justify-end",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: soundEnabled ? "hero" : "outline",
				size: "sm",
				onClick: () => {
					setSoundEnabled((v) => !v);
					if (!soundEnabled) playDingDong();
				},
				"aria-pressed": soundEnabled,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-4" }), soundEnabled ? "Chuông báo: BẬT" : "Chuông báo: TẮT"]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-4 lg:grid-cols-3",
			children: lanes.map((lane) => {
				const laneOrders = orderInLane(lane.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: `rounded-2xl border p-4 ${lane.ring}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mb-4 flex items-center justify-between text-sm font-bold",
						children: [lane.label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "bg-background rounded-full px-2 py-0.5 text-xs",
							children: laneOrders.length
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [laneOrders.map((o) => {
							const age = now - new Date(o.created_at).getTime();
							const late = lane.id !== "done" && age > LATE_AFTER_MINUTES * 6e4;
							const isNew = !!newIds[o.id];
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
								onClick: () => setSelected(o),
								className: `bg-card cursor-pointer rounded-2xl border-2 p-4 transition-colors ${late ? "border-berry animate-pulse shadow-[0_0_0_1px_theme(colors.berry/40)]" : isNew ? "border-primary animate-pulse" : "border-transparent hover:border-border"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-display text-lg font-extrabold",
											children: o.order_code
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: `flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${late ? "bg-berry text-berry-foreground" : "bg-muted text-muted-foreground"}`,
											children: [
												late ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3" }),
												" ",
												fmtMinutes(age)
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-muted-foreground mt-1 flex items-center gap-2 text-xs",
										children: [o.location_name && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "flex items-center gap-1",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-3" }),
												" ",
												o.location_name
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: o.store_name })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										className: "mt-3 space-y-2",
										children: o.items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "border-l-4 border-primary/40 pl-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-base font-semibold",
													children: [
														it.qty,
														"× ",
														it.product_name
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-muted-foreground text-xs",
													children: [
														it.size_label,
														" · ",
														it.base_tea,
														" · ",
														it.sugar_level,
														" đường ·",
														" ",
														it.ice_level,
														" đá",
														it.toppings.length > 0 && ` · ${it.toppings.map((t) => t.name).join(", ")}`
													]
												}),
												it.note && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-muted-foreground text-xs italic",
													children: ["📝 ", it.note]
												})
											]
										}, it.id))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-4 flex gap-2",
										children: lane.id === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "outline",
											size: "sm",
											className: "flex-1",
											onClick: (e) => {
												e.stopPropagation();
												moveBack(o);
											},
											children: "Lùi lại"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "hero",
											size: "sm",
											className: "flex-1",
											onClick: (e) => {
												e.stopPropagation();
												move(o, lane.id === "wait" ? "prep" : "done");
											},
											children: lane.id === "wait" ? "Bắt đầu làm" : "Hoàn thành"
										}) })
									})
								]
							}, o.id);
						}), laneOrders.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground py-8 text-center text-sm",
							children: "Chưa có đơn nào."
						})]
					})]
				}, lane.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!selected,
			onOpenChange: (open) => !open && setSelected(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "sm:max-w-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, {
						className: "flex items-center gap-2",
						children: [
							"Đơn ",
							selected?.order_code,
							selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								className: selected.current_status === "Hoàn thành" ? "bg-leaf/10 text-leaf" : "bg-primary/10 text-primary",
								children: selected.current_status
							})
						]
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							size: "sm",
							onClick: () => setBillOpen(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-4" }), " In hóa đơn"]
						})
					}),
					selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-muted/40 rounded-xl p-3 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "text-primary size-4" }),
											selected.location_name || "Không có bàn",
											" · ",
											selected.store_name
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-muted-foreground mt-1 flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "size-3.5" }),
											" ",
											selected.customer_phone || "—",
											" ·",
											" ",
											selected.customer_name
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-muted-foreground mt-1",
										children: [
											"Loại đơn: ",
											selected.order_type,
											" · Tạo lúc",
											" ",
											new Date(selected.created_at).toLocaleTimeString("vi-VN")
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-2",
								children: selected.items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "border-l-4 border-primary/40 pl-3 text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "font-semibold",
											children: [
												it.qty,
												"× ",
												it.product_name
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-muted-foreground text-xs",
											children: [
												it.size_label,
												" · ",
												it.base_tea,
												" · ",
												it.sugar_level,
												" đường · ",
												it.ice_level,
												" đá",
												it.toppings.length > 0 && ` · ${it.toppings.map((t) => t.name).join(", ")}`
											]
										}),
										it.note && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-muted-foreground text-xs italic",
											children: ["📝 ", it.note]
										})
									]
								}, it.id))
							}),
							selected.note && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "bg-accent/40 text-accent-foreground rounded-lg p-3 text-sm",
								children: ["📝 Ghi chú đơn: ", selected.note]
							})
						]
					})
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InBillModal, {
			order: selected ? toBillOrder(selected) : null,
			open: billOpen,
			onClose: () => setBillOpen(false)
		})
	] });
}
//#endregion
export { KdsPage as component };
