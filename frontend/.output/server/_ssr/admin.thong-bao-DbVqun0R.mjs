import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./data-BKElHwIS.mjs";
import { Q as CreditCard, a as UserPlus, h as ShoppingBag, k as PackageX, s as TriangleAlert, u as Ticket } from "../_libs/lucide-react.mjs";
import { r as adminNotifications } from "./admin-data-D7T31PXz.mjs";
import { t as Card } from "./card-DaABMcTj.mjs";
import { t as AdminPageHeader } from "./AdminUI-DohLx8kD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.thong-bao-DbVqun0R.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var filters = [
	{
		id: "all",
		label: "Tất cả"
	},
	{
		id: "order",
		label: "Đơn hàng mới"
	},
	{
		id: "stock",
		label: "Cảnh báo kho"
	},
	{
		id: "voucher",
		label: "Voucher"
	},
	{
		id: "staff",
		label: "Nhân sự"
	},
	{
		id: "payment",
		label: "Thanh toán"
	}
];
var icons = {
	order: ShoppingBag,
	stock: PackageX,
	voucher: Ticket,
	staff: UserPlus,
	payment: CreditCard
};
var tones = {
	info: "bg-primary/10 text-primary",
	warn: "bg-accent text-accent-foreground",
	danger: "bg-berry/10 text-berry"
};
function NotificationsPage() {
	const [filter, setFilter] = (0, import_react.useState)("all");
	const rows = adminNotifications.filter((n) => filter === "all" || n.type === filter);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Trung tâm thông báo",
			desc: `${adminNotifications.length} thông báo chưa xử lý`,
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				children: "Đánh dấu đã đọc tất cả"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-5 flex flex-wrap gap-2",
			children: filters.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: filter === f.id ? "default" : "outline",
				onClick: () => setFilter(f.id),
				children: f.label
			}, f.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children: rows.map((n) => {
				const Icon = icons[n.type] ?? TriangleAlert;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "shadow-soft flex flex-wrap items-center gap-4 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `grid size-10 shrink-0 place-items-center rounded-xl ${tones[n.tone]}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold",
								children: n.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground text-xs",
								children: n.time
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "soft",
							size: "sm",
							children: "Xử lý ngay"
						})
					]
				}, n.id);
			})
		})
	] });
}
//#endregion
export { NotificationsPage as component };
