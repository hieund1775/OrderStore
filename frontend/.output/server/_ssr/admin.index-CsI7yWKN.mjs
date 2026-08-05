import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { b as vnd, t as Button } from "./data-BKElHwIS.mjs";
import { t as Badge } from "./badge-CmDb9cdk.mjs";
import { $ as Coins, Z as CupSoda, h as ShoppingBag, k as PackageX, l as Timer, pt as Ban, s as TriangleAlert, st as ChefHat } from "../_libs/lucide-react.mjs";
import { c as kpis, d as urgentKpis, i as adminOrders, s as hourlyRevenue } from "./admin-data-D7T31PXz.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as SectionCard, r as StatCard, t as AdminPageHeader } from "./AdminUI-DohLx8kD.mjs";
import { a as XAxis, d as ResponsiveContainer, f as Tooltip, i as YAxis, o as Area, s as CartesianGrid, t as AreaChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.index-CsI7yWKN.js
var import_jsx_runtime = require_jsx_runtime();
var kpiIcons = [
	Coins,
	ShoppingBag,
	Ban,
	CupSoda
];
var urgentIcons = {
	low: TriangleAlert,
	paused: PackageX,
	prep: ChefHat,
	late: Timer
};
function AdminDashboard() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Tổng quan hôm nay",
			desc: "Cập nhật lúc 15:30 · 27/07/2026 · Toàn chuỗi 5 chi nhánh",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				children: "Hôm nay"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "hero",
				children: "Xuất báo cáo"
			})] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
			children: kpis.map((k, i) => {
				const Icon = kpiIcons[i];
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: k.label,
					value: k.value,
					delta: k.delta,
					tone: k.tone,
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5" })
				}, k.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
			children: urgentKpis.map((u) => {
				const Icon = urgentIcons[u.id];
				const tone = u.tone === "danger" ? "border-berry/40 bg-berry/5 text-berry" : u.tone === "warn" ? "border-primary/40 bg-primary/5 text-primary" : "border-leaf/40 bg-leaf/5 text-leaf";
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
				desc: "Đơn vị: nghìn đồng · Peak hour 15h – 18h",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-72 w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
							data: hourlyRevenue,
							margin: {
								left: -12,
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
									tickLine: false,
									axisLine: false,
									fontSize: 12
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									tickLine: false,
									axisLine: false,
									fontSize: 12
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { contentStyle: {
									borderRadius: 12,
									border: "1px solid var(--border)",
									background: "var(--popover)",
									fontSize: 12
								} }),
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
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-3",
					children: adminOrders.slice(0, 5).map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-xl border p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-semibold",
									children: o.id
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: "secondary",
									children: o.status
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground mt-1 text-xs",
								children: [
									o.customer,
									" · ",
									o.type,
									" · ",
									o.time
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
	] });
}
//#endregion
export { AdminDashboard as component };
