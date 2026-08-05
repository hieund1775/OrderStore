import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { b as vnd, t as Button } from "./data-BKElHwIS.mjs";
import { E as PartyPopper, Z as CupSoda, ct as Check, dt as Bike, l as Timer, nt as ClipboardCheck } from "../_libs/lucide-react.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as PageHeader } from "./PageHeader-4GMedA0k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/theo-doi-don-ukQSxgj1.js
var import_jsx_runtime = require_jsx_runtime();
var steps = [
	{
		icon: Timer,
		label: "Chờ xác nhận",
		desc: "Hệ thống đã nhận đơn"
	},
	{
		icon: ClipboardCheck,
		label: "Đã xác nhận",
		desc: "Cửa hàng đã chấp nhận đơn"
	},
	{
		icon: CupSoda,
		label: "Đang chuẩn bị",
		desc: "Barista đang pha chế trà"
	},
	{
		icon: Bike,
		label: "Đang giao",
		desc: "Shipper đang trên đường"
	},
	{
		icon: PartyPopper,
		label: "Hoàn thành",
		desc: "Giao thành công"
	}
];
var currentStep = 2;
function Tracking() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Tracking",
		title: "Theo dõi đơn hàng",
		desc: "Đơn VX240726 · Chi nhánh Nguyễn Huệ"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "bg-card rounded-2xl border p-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground text-xs",
					children: "Mã đơn"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-xl font-extrabold",
					children: "VX240726"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-accent text-accent-foreground rounded-full px-3 py-1.5 text-xs font-semibold",
					children: "Dự kiến 15:40"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-8 space-y-0",
				children: steps.map((s, i) => {
					const done = i < currentStep;
					const active = i === currentStep;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "relative flex gap-4 pb-8 last:pb-0",
						children: [
							i < steps.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-10 left-5 h-full w-0.5 ${done ? "bg-leaf" : "bg-border"}` }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 ${done ? "bg-leaf border-leaf text-leaf-foreground" : active ? "gradient-warm border-primary text-primary-foreground animate-pulse" : "bg-card border-border text-muted-foreground"}`,
								children: done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(s.icon, { className: "size-5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: `text-sm font-bold ${active ? "text-primary" : ""}`,
									children: s.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground text-xs",
									children: s.desc
								})]
							})
						]
					}, s.label);
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "space-y-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card rounded-2xl border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display mb-3 text-lg font-bold",
						children: "Chi tiết đơn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "text-muted-foreground space-y-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "1× Trà Dâu Tây Lài Thơm (L, 50% đường, thạch nha đam)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "1× Trà Cam Sả Mật Ong (M, 30% đường)" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex justify-between border-t pt-3 font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tổng thanh toán" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-primary",
							children: vnd(118e3)
						})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card rounded-2xl border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-semibold",
						children: "Giao đến"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground mt-1 text-sm",
						children: "125 Nguyễn Huệ, P. Bến Nghé, Quận 1 · 0901 234 567"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "soft",
						className: "mt-4 w-full",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/ho-so",
							children: "Xem lịch sử đơn hàng"
						})
					})
				]
			})]
		})]
	})] });
}
//#endregion
export { Tracking as component };
