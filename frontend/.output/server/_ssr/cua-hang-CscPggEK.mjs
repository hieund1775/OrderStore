import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { h as stores, t as Button } from "./data-BKElHwIS.mjs";
import { t as Badge } from "./badge-CmDb9cdk.mjs";
import { A as Navigation, L as LocateFixed, P as MapPin, et as Clock, w as Phone } from "../_libs/lucide-react.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-HGKjV_Eq.mjs";
import { t as PageHeader } from "./PageHeader-4GMedA0k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cua-hang-CscPggEK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function StoresPage() {
	const [city, setCity] = (0, import_react.useState)("all");
	const [district, setDistrict] = (0, import_react.useState)("all");
	const cities = Array.from(new Set(stores.map((s) => s.city)));
	const districts = Array.from(new Set(stores.filter((s) => city === "all" || s.city === city).map((s) => s.district)));
	const list = (0, import_react.useMemo)(() => stores.filter((s) => (city === "all" || s.city === city) && (district === "all" || s.district === district)), [city, district]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Cửa hàng",
		title: "Hệ thống chi nhánh",
		desc: "Chọn khu vực hoặc bật định vị để tìm tiệm trà gần bạn nhất."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "container-page grid gap-6 py-10 lg:grid-cols-[380px_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card space-y-3 rounded-2xl border p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: city,
						onValueChange: (v) => {
							setCity(v);
							setDistrict("all");
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							className: "w-full",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Tỉnh / Thành phố" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "all",
							children: "Tất cả tỉnh / thành"
						}), cities.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: c,
							children: c
						}, c))] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: district,
						onValueChange: setDistrict,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							className: "w-full",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Quận / Huyện" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "all",
							children: "Tất cả quận / huyện"
						}), districts.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: d,
							children: d
						}, d))] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "leaf",
						className: "w-full",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocateFixed, { className: "size-4" }), " Tìm chi nhánh gần tôi nhất"]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: list.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "bg-card rounded-2xl border p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display font-bold",
							children: s.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground mt-1 flex items-start gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "text-primary mt-0.5 size-4 shrink-0" }),
								" ",
								s.address
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground mt-1 flex items-center gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "text-primary size-4" }),
								" ",
								s.hours
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground mt-1 flex items-center gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "text-primary size-4" }),
								" ",
								s.phone
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex flex-wrap gap-1.5",
							children: s.amenities.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								className: "rounded-full text-[11px] font-normal",
								children: a
							}, a))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "outline",
								size: "sm",
								className: "flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "size-4" }), " Chỉ đường"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "hero",
								size: "sm",
								className: "flex-1",
								children: "Đặt từ chi nhánh này"
							})]
						})
					]
				}, s.id))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "bg-accent/40 relative min-h-[420px] overflow-hidden rounded-2xl border",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 opacity-40 [background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] [background-size:44px_44px]" }),
				list.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute flex -translate-x-1/2 -translate-y-full flex-col items-center",
					style: {
						left: `${18 + i * 17}%`,
						top: `${32 + i % 3 * 18}%`
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "bg-card rounded-full border px-2 py-1 text-[11px] font-semibold shadow-card-soft",
						children: s.district
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "fill-primary text-primary size-7" })]
				}, s.id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground absolute bottom-4 left-1/2 -translate-x-1/2 text-xs",
					children: "Bản đồ tương tác (Google Maps) sẽ hiển thị tại đây"
				})
			]
		})]
	})] });
}
//#endregion
export { StoresPage as component };
