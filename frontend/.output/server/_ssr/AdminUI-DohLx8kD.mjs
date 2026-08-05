import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as cn } from "./data-BKElHwIS.mjs";
import { n as CardContent, t as Card } from "./card-DaABMcTj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AdminUI-DohLx8kD.js
var import_jsx_runtime = require_jsx_runtime();
function AdminPageHeader({ title, desc, actions }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-6 flex flex-wrap items-end justify-between gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-2xl font-extrabold md:text-3xl",
			children: title
		}), desc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted-foreground mt-1 text-sm",
			children: desc
		})] }), actions && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap items-center gap-2",
			children: actions
		})]
	});
}
function StatCard({ label, value, delta, icon, tone = "primary" }) {
	const toneClass = {
		primary: "bg-primary/10 text-primary",
		leaf: "bg-leaf/10 text-leaf",
		berry: "bg-berry/10 text-berry",
		muted: "bg-muted text-muted-foreground"
	}[tone];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "shadow-soft",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "flex items-start gap-4 p-5",
			children: [icon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn("grid size-10 shrink-0 place-items-center rounded-xl", toneClass),
				children: icon
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-xs font-medium",
						children: label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display mt-1 text-xl font-extrabold md:text-2xl",
						children: value
					}),
					delta && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-muted-foreground mt-1 text-xs",
						children: [delta, " so với hôm qua"]
					})
				]
			})]
		})
	});
}
function SectionCard({ title, desc, actions, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: cn("shadow-soft", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-base font-bold",
					children: title
				}), desc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground text-xs",
					children: desc
				})] }), actions]
			}), children]
		})
	});
}
//#endregion
export { SectionCard as n, StatCard as r, AdminPageHeader as t };
