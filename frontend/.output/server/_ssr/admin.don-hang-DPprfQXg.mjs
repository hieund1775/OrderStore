import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { b as vnd, t as Button } from "./data-BKElHwIS.mjs";
import { t as Input } from "./input-DvwfGdEz.mjs";
import { t as Badge } from "./badge-CmDb9cdk.mjs";
import { G as Funnel, J as Eye, S as Printer, V as LayoutGrid, z as List } from "../_libs/lucide-react.mjs";
import { i as adminOrders, n as adminBranches } from "./admin-data-D7T31PXz.mjs";
import { n as CardContent, t as Card } from "./card-DaABMcTj.mjs";
import { t as AdminPageHeader } from "./AdminUI-DohLx8kD.mjs";
import { a as TableHeader, i as TableHead, n as TableBody, o as TableRow, r as TableCell, t as Table } from "./table-Bdv5HUNZ.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, o as DialogTrigger, t as Dialog } from "./dialog-Bztdc_I8.mjs";
import { t as InBillModal } from "./InBillModal-HmVgg5fA.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-HGKjV_Eq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.don-hang-DPprfQXg.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var statuses = [
	"Tất cả",
	"Chờ xác nhận",
	"Đã xác nhận",
	"Đang chuẩn bị",
	"Đang giao",
	"Hoàn thành",
	"Đã hủy"
];
var types = [
	"Tất cả",
	"Delivery",
	"Take-away",
	"POS"
];
var payments = [
	"Tất cả",
	"COD",
	"VietQR",
	"MoMo",
	"ZaloPay"
];
var statusTone = {
	"Chờ xác nhận": "bg-primary/15 text-primary",
	"Đã xác nhận": "bg-chart-5/15 text-chart-5",
	"Đang chuẩn bị": "bg-chart-5/15 text-chart-5",
	"Đang giao": "bg-accent text-accent-foreground",
	"Hoàn thành": "bg-leaf/15 text-leaf",
	"Đã hủy": "bg-berry/15 text-berry"
};
function OrdersPage() {
	const [view, setView] = (0, import_react.useState)("list");
	const [status, setStatus] = (0, import_react.useState)("Tất cả");
	const [type, setType] = (0, import_react.useState)("Tất cả");
	const [payment, setPayment] = (0, import_react.useState)("Tất cả");
	const [branch, setBranch] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const filtered = (0, import_react.useMemo)(() => adminOrders.filter((o) => (status === "Tất cả" || o.status === status) && (type === "Tất cả" || o.type === type) && (payment === "Tất cả" || o.payment === payment) && (branch === "all" || o.branch === adminBranches.find((b) => b.id === branch)?.name) && (q.trim() === "" || `${o.id} ${o.customer} ${o.phone}`.toLowerCase().includes(q.toLowerCase()))), [
		status,
		type,
		payment,
		branch,
		q
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Quản lý đơn hàng",
			desc: `${filtered.length} đơn khớp bộ lọc · cập nhật real-time`,
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-muted flex rounded-xl p-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: view === "list" ? "default" : "ghost",
					onClick: () => setView("list"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { className: "mr-1 size-4" }), " List"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: view === "kanban" ? "default" : "ghost",
					onClick: () => setView("kanban"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutGrid, { className: "mr-1 size-4" }), " Kanban"]
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "shadow-soft mb-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
				className: "grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "xl:col-span-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							placeholder: "Tìm mã đơn / khách hàng",
							value: q,
							onChange: (e) => setQ(e.target.value)
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterSelect, {
						value: branch,
						onChange: setBranch,
						label: "Chi nhánh",
						options: adminBranches.map((b) => ({
							v: b.id,
							l: b.name
						}))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterSelect, {
						value: status,
						onChange: setStatus,
						label: "Trạng thái",
						options: statuses.map((s) => ({
							v: s,
							l: s
						}))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterSelect, {
						value: type,
						onChange: setType,
						label: "Loại đơn",
						options: types.map((s) => ({
							v: s,
							l: s
						}))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterSelect, {
						value: payment,
						onChange: setPayment,
						label: "Thanh toán",
						options: payments.map((s) => ({
							v: s,
							l: s
						}))
					})
				]
			})
		}),
		view === "list" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "shadow-soft overflow-hidden",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Table, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Mã đơn" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Khách hàng" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
						className: "hidden md:table-cell",
						children: "Chi nhánh"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Loại" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
						className: "hidden lg:table-cell",
						children: "PTTT"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Trạng thái" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
						className: "text-right",
						children: "Tổng tiền"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {})
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableBody, { children: [filtered.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "font-medium",
						children: o.id
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: o.customer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-xs",
						children: o.time
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "hidden text-sm md:table-cell",
						children: o.branch
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "text-sm",
						children: o.type
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "hidden text-sm lg:table-cell",
						children: o.payment
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[o.status]}`,
						children: o.status
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "text-right font-semibold",
						children: vnd(o.total)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "text-right",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderDetail, { order: o })
					})
				] }, o.id)), filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableRow, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, {
					colSpan: 8,
					className: "text-muted-foreground py-10 text-center text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { className: "mx-auto mb-2 size-5" }), " Không có đơn nào khớp bộ lọc."]
				}) })] })] })
			})
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-4 lg:grid-cols-4",
			children: [
				"Chờ xác nhận",
				"Đang chuẩn bị",
				"Đang giao",
				"Hoàn thành"
			].map((col) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card rounded-2xl border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mb-3 flex items-center justify-between text-sm font-semibold",
					children: [col, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "secondary",
						children: filtered.filter((o) => o.status === col).length
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-3",
					children: filtered.filter((o) => o.status === col).map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-background rounded-xl border p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold",
								children: o.id
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground text-xs",
								children: [
									o.customer,
									" · ",
									o.type
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-primary mt-1 text-sm font-bold",
								children: vnd(o.total)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderDetail, { order: o })
							})
						]
					}, o.id))
				})]
			}, col))
		})
	] });
}
function FilterSelect({ value, onChange, label, options }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
		value,
		onValueChange: onChange,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: label }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
			value: o.v,
			children: o.l
		}, o.v)) })]
	});
}
function OrderDetail({ order }) {
	const [billOpen, setBillOpen] = (0, import_react.useState)(false);
	const billOrder = {
		id: Number(order.id.replace(/\D/g, "")) || 0,
		order_code: order.id,
		store_name: order.branch,
		customer_name: order.customer,
		customer_phone: order.phone,
		payment_method: order.payment,
		created_at: (/* @__PURE__ */ new Date()).toISOString(),
		items: order.items.map((it) => ({
			product_name: it.name,
			qty: it.qty,
			line_total: 0,
			note: it.options || null
		})),
		subtotal: order.total,
		discount_amount: 0,
		total: order.total
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			size: "sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "mr-1 size-4" }), " Chi tiết"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: "max-w-lg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: ["Đơn ", order.id] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
							label: "Khách hàng",
							value: order.customer
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
							label: "Số điện thoại",
							value: order.phone
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
							label: "Chi nhánh",
							value: order.branch
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
							label: "Loại đơn",
							value: order.type
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
							label: "Thanh toán",
							value: order.payment
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
							label: "Trạng thái",
							value: order.status
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-xs font-semibold tracking-wide uppercase",
						children: "Món đã đặt"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-2",
						children: order.items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "flex justify-between gap-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-medium",
								children: [
									it.qty,
									"× ",
									it.name
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground block text-xs",
								children: it.options
							})] })
						}, it.name))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between border-t pt-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold",
						children: "Tổng thanh toán"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-primary font-display text-lg font-extrabold",
						children: vnd(order.total)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "hero",
							className: "flex-1",
							children: "Xác nhận đơn"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							className: "flex-1",
							children: "Hủy đơn"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							className: "flex-1",
							onClick: () => setBillOpen(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "mr-1 size-4" }), " In bill"]
						})
					]
				})
			]
		})]
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InBillModal, {
		order: billOrder,
		open: billOpen,
		onClose: () => setBillOpen(false)
	})] });
}
function Info({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-muted/50 rounded-lg p-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted-foreground text-[11px]",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm font-medium",
			children: value
		})]
	});
}
//#endregion
export { OrdersPage as component };
