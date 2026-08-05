import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { $ as CupSoda, R as LoaderCircle, gt as Ban, h as ShoppingBag, k as PackageX, s as TriangleAlert, tt as Coins, ut as ChefHat } from "../_libs/lucide-react.mjs";
import { _ as vnd } from "./data-Z_klJ5jj.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as apiGet } from "./api-Cnar3gwH.mjs";
import { n as SectionCard, r as StatCard, t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { a as XAxis, d as ResponsiveContainer, f as Tooltip, i as YAxis, o as Area, s as CartesianGrid, t as AreaChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.index-B_bl1Ric.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var kpiIcons = [
	Coins,
	ShoppingBag,
	Ban,
	CupSoda
];
function AdminDashboard() {
	const [kpis, setKpis] = (0, import_react.useState)(null);
	const [urgent, setUrgent] = (0, import_react.useState)(null);
	const [byHour, setByHour] = (0, import_react.useState)([]);
	const [recent, setRecent] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		Promise.all([
			apiGet("/admin/dashboard/kpi"),
			apiGet("/admin/dashboard/urgent"),
			apiGet("/admin/dashboard/revenue-by-hour"),
			apiGet(`/admin/orders?status=${encodeURIComponent("Chờ xác nhận")}`)
		]).then(([k, u, hour, orders]) => {
			if (cancelled) return;
			setKpis(k);
			setUrgent(u);
			setByHour(Array.from({ length: 24 }, (_, h) => {
				return {
					hour: h,
					value: hour.find((x) => Number(x.hour) === h)?.value ?? 0
				};
			}).filter((x) => x.value > 0));
			setRecent(orders.slice(0, 6));
		}).catch((err) => console.error(err)).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	const today = (/* @__PURE__ */ new Date()).toLocaleDateString("vi-VN", {
		weekday: "long",
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	});
	const kpiCards = kpis ? [
		{
			id: "revenue",
			label: kpis.revenue.label,
			value: vnd(Number(kpis.revenue.value)),
			tone: "primary"
		},
		{
			id: "orders",
			label: kpis.orders.label,
			value: Number(kpis.orders.value),
			tone: "leaf"
		},
		{
			id: "cancel",
			label: kpis.cancelRate.label,
			value: String(kpis.cancelRate.value),
			tone: "berry"
		},
		{
			id: "cups",
			label: kpis.cups.label,
			value: Number(kpis.cups.value),
			tone: "primary"
		}
	] : [];
	const urgentCards = urgent ? [{
		id: "paused",
		label: "Món đang tạm ngưng",
		value: urgent.paused,
		tone: "danger",
		to: "/admin/thuc-don"
	}, {
		id: "prep",
		label: "Đơn đang chuẩn bị",
		value: urgent.preparing,
		tone: "info",
		to: "/admin/bep"
	}] : [];
	const urgentIcons = {
		paused: PackageX,
		prep: ChefHat
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
		title: "Tổng quan hôm nay",
		desc: `Cập nhật ${today} · Toàn chuỗi`,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "outline",
			children: "Hôm nay"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			asChild: true,
			variant: "hero",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/admin/bao-cao",
				children: "Xuất báo cáo"
			})
		})] })
	}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex items-center justify-center py-20 text-muted-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
			children: kpiCards.map((k, i) => {
				const Icon = kpiIcons[i];
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: k.label,
					value: k.value,
					tone: k.tone,
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5" })
				}, k.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
			children: urgentCards.map((u) => {
				const Icon = urgentIcons[u.id] ?? TriangleAlert;
				const tone = u.tone === "danger" ? "border-berry/40 bg-berry/5 text-berry" : "border-leaf/40 bg-leaf/5 text-leaf";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: u.to,
					className: `flex items-center gap-3 rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${tone}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-lg font-extrabold",
						children: u.value
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-foreground/70 text-xs",
						children: u.label
					})] })]
				}, u.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-4 lg:grid-cols-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
				className: "lg:col-span-2",
				title: "Doanh thu theo khung giờ",
				desc: "Đơn vị: VNĐ · dữ liệu hôm nay",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-72 w-full",
					children: byHour.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground py-24 text-center text-sm",
						children: "Chưa có dữ liệu hôm nay"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
							data: byHour,
							margin: {
								left: 8,
								right: 8,
								top: 8
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
									id: "rev",
									x1: "0",
									y1: "0",
									x2: "0",
									y2: "1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
										offset: "0%",
										stopColor: "var(--primary)",
										stopOpacity: .5
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
										offset: "100%",
										stopColor: "var(--primary)",
										stopOpacity: 0
									})]
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									strokeDasharray: "4 4",
									stroke: "var(--border)",
									vertical: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									dataKey: "hour",
									tickFormatter: (h) => `${h}h`,
									tickLine: false,
									axisLine: false,
									fontSize: 12
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									tickLine: false,
									axisLine: false,
									fontSize: 12
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
									formatter: (v) => vnd(Number(v)),
									contentStyle: {
										borderRadius: 12,
										border: "1px solid var(--border)",
										background: "var(--popover)",
										fontSize: 12
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
									dataKey: "value",
									stroke: "var(--primary)",
									strokeWidth: 2.5,
									fill: "url(#rev)"
								})
							]
						})
					})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SectionCard, {
				title: "Đơn mới cần xử lý",
				desc: "Nhấp để mở chi tiết trong module đơn hàng",
				children: [recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground py-16 text-center text-sm",
					children: "Không có đơn đang chờ"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-3",
					children: recent.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-xl border p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-semibold",
									children: o.order_code
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: "secondary",
									children: o.current_status
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground mt-1 text-xs",
								children: [
									o.customer_name,
									" · ",
									o.order_type,
									" · ",
									new Date(o.created_at).toLocaleString("vi-VN")
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-primary mt-1 text-sm font-bold",
								children: vnd(o.total)
							})
						]
					}, o.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "soft",
					className: "mt-4 w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/admin/don-hang",
						children: "Xem tất cả đơn hàng"
					})
				})]
			})]
		})
	] })] });
}
//#endregion
export { AdminDashboard as component };
