import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { $ as CreditCard, R as LoaderCircle, a as UserPlus, h as ShoppingBag, k as PackageX, mt as Bell, s as TriangleAlert, u as Ticket } from "../_libs/lucide-react.mjs";
import { n as apiGet } from "./api-CyIKtyVS.mjs";
import { t as Card } from "./card-N78Fb1PV.mjs";
import { t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.thong-bao-DtVfAIbK.js
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
	},
	{
		id: "system",
		label: "Hệ thống"
	}
];
var icons = {
	order: ShoppingBag,
	stock: PackageX,
	voucher: Ticket,
	staff: UserPlus,
	payment: CreditCard,
	system: Bell
};
function NotificationsPage() {
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [rows, setRows] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		apiGet("/admin/notifications").then((data) => {
			if (!cancelled) setRows(data);
		}).catch((err) => console.error(err)).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	const shown = rows.filter((n) => filter === "all" || n.type === filter);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Trung tâm thông báo",
			desc: `${rows.filter((n) => !n.is_read).length} thông báo chưa đọc`
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
		loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex items-center justify-center py-20 text-muted-foreground",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
		}) : shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted-foreground py-20 text-center text-sm",
			children: "Không có thông báo nào"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children: shown.map((n) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "shadow-soft flex flex-wrap items-center gap-4 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(icons[n.type] ?? TriangleAlert, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-semibold",
									children: n.title
								}),
								n.body && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground text-xs",
									children: n.body
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground mt-0.5 text-xs",
									children: new Date(n.created_at).toLocaleString("vi-VN")
								})
							]
						}),
						!n.is_read && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "bg-primary size-2 shrink-0 animate-pulse rounded-full",
							title: "Chưa đọc"
						})
					]
				}, n.id);
			})
		})
	] });
}
//#endregion
export { NotificationsPage as component };
