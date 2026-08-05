import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { h as stores, t as Button } from "./data-BKElHwIS.mjs";
import { t as Badge } from "./badge-CmDb9cdk.mjs";
import { C as Plus, P as MapPin, et as Clock, w as Phone } from "../_libs/lucide-react.mjs";
import { n as CardContent, t as Card } from "./card-DaABMcTj.mjs";
import { t as AdminPageHeader } from "./AdminUI-DohLx8kD.mjs";
import { t as Switch } from "./switch-DyBOu_FE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.chi-nhanh-CmvDmle0.js
var import_jsx_runtime = require_jsx_runtime();
function StoresAdminPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
		title: "Hệ thống cửa hàng",
		desc: `${stores.length} chi nhánh đang vận hành`,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "hero",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm chi nhánh"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
		children: stores.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "shadow-soft",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display font-bold",
							children: s.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground text-xs",
							children: [
								s.district,
								" · ",
								s.city
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, { defaultChecked: i !== 4 })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "text-muted-foreground mt-4 space-y-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "text-primary mt-0.5 size-4 shrink-0" }),
									" ",
									s.address
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "text-primary mt-0.5 size-4 shrink-0" }),
									" ",
									s.hours
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "text-primary mt-0.5 size-4 shrink-0" }),
									" ",
									s.phone
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 flex flex-wrap gap-2",
						children: s.amenities.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "secondary",
							children: a
						}, a))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-2 border-t pt-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "soft",
							size: "sm",
							className: "flex-1",
							children: "Chỉnh sửa"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							className: "flex-1",
							children: "Xem doanh thu"
						})]
					})
				]
			})
		}, s.id))
	})] });
}
//#endregion
export { StoresAdminPage as component };
