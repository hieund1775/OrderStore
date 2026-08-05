import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { G as Funnel, R as LoaderCircle, S as Printer, V as LayoutGrid, X as Eye, ot as CircleX, z as List } from "../_libs/lucide-react.mjs";
import { _ as vnd } from "./data-Z_klJ5jj.mjs";
import { a as apiPut, n as apiGet, r as apiPatch } from "./api-Cnar3gwH.mjs";
import { n as CardContent, t as Card } from "./card-N78Fb1PV.mjs";
import { t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { a as TableHeader, i as TableHead, n as TableBody, o as TableRow, r as TableCell, t as Table } from "./table-B4dSFUe4.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, o as DialogTrigger, t as Dialog } from "./dialog-Di5jevJl.mjs";
import { t as InBillModal } from "./InBillModal-2hHyx7vx.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DXom7Yjz.mjs";
import { a as AlertDialogDescription, c as AlertDialogTitle, i as AlertDialogContent, n as AlertDialogAction, o as AlertDialogFooter, r as AlertDialogCancel, s as AlertDialogHeader, t as AlertDialog } from "./alert-dialog-DTqLMw86.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.don-hang-DMrScoxU.js
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
	const [branchId, setBranchId] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const [orders, setOrders] = (0, import_react.useState)([]);
	const [branches, setBranches] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [actionLoading, setActionLoading] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		apiGet("/admin/branches").then(setBranches).catch(() => setBranches([]));
	}, []);
	const load = (0, import_react.useCallback)(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (status !== "Tất cả") params.set("status", status);
			if (branchId !== "all") params.set("store_id", branchId);
			if (q.trim()) params.set("search", q.trim());
			const rows = await apiGet(`/admin/orders?${params.toString()}`);
			setOrders(rows.filter((o) => (type === "Tất cả" || o.order_type === type) && (payment === "Tất cả" || o.payment_method === payment)));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Không tải được đơn hàng");
		} finally {
			setLoading(false);
		}
	}, [
		status,
		type,
		payment,
		branchId,
		q
	]);
	(0, import_react.useEffect)(() => {
		const t = window.setTimeout(load, 250);
		return () => window.clearTimeout(t);
	}, [load]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Quản lý đơn hàng",
			desc: `${orders.length} đơn khớp bộ lọc · cập nhật real-time`,
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
						value: branchId,
						onChange: setBranchId,
						label: "Chi nhánh",
						options: [{
							v: "all",
							l: "Tất cả chi nhánh"
						}, ...branches.map((b) => ({
							v: String(b.id),
							l: b.name
						}))]
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
		loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex items-center justify-center py-20 text-muted-foreground",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
		}) : view === "list" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
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
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableBody, { children: [orders.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "font-medium",
						children: o.order_code
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: o.customer_name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-xs",
						children: new Date(o.created_at).toLocaleString("vi-VN")
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "hidden text-sm md:table-cell",
						children: o.store_name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "text-sm",
						children: o.order_type
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "hidden text-sm lg:table-cell",
						children: o.payment_method
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[o.current_status]}`,
						children: o.current_status
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "text-right font-semibold",
						children: vnd(o.total)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "text-right",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderDetail, {
							orderId: o.id,
							onChanged: load,
							actionLoading,
							setActionLoading
						})
					})
				] }, o.id)), orders.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableRow, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, {
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
						children: orders.filter((o) => o.current_status === col).length
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-3",
					children: orders.filter((o) => o.current_status === col).map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-background rounded-xl border p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold",
								children: o.order_code
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground text-xs",
								children: [
									o.customer_name,
									" · ",
									o.order_type
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-primary mt-1 text-sm font-bold",
								children: vnd(o.total)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderDetail, {
									orderId: o.id,
									onChanged: load,
									actionLoading,
									setActionLoading
								})
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
function toBillOrder(o) {
	return {
		id: o.id,
		order_code: o.order_code,
		store_name: o.store_name,
		location_name: o.location_name ?? null,
		customer_name: o.customer_name,
		customer_phone: o.customer_phone,
		payment_method: o.payment_method,
		created_at: o.created_at,
		items: o.items.map((it) => ({
			product_name: it.product_name,
			qty: it.qty,
			size_label: it.size_label ?? null,
			note: it.note ?? null,
			toppings: (it.toppings ?? []).map((t) => ({ name: t.name })),
			line_total: it.line_total
		})),
		subtotal: o.subtotal,
		discount_amount: o.discount_amount,
		total: o.total
	};
}
function OrderDetail({ orderId, onChanged, actionLoading, setActionLoading }) {
	const [detail, setDetail] = (0, import_react.useState)(null);
	const [billOpen, setBillOpen] = (0, import_react.useState)(false);
	const [cancelOpen, setCancelOpen] = (0, import_react.useState)(false);
	const [cancelReason, setCancelReason] = (0, import_react.useState)("");
	const [open, setOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		let cancelled = false;
		apiGet(`/admin/orders/${orderId}`).then((d) => {
			if (!cancelled) setDetail(d);
		}).catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được chi tiết"));
		return () => {
			cancelled = true;
		};
	}, [open, orderId]);
	async function changeStatus(next) {
		setActionLoading(true);
		try {
			await apiPatch(`/admin/orders/${orderId}/status`, { status: next });
			toast.success(`Đơn #${orderId} → ${next}`);
			setOpen(false);
			onChanged();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
		} finally {
			setActionLoading(false);
		}
	}
	async function handleCancel() {
		setActionLoading(true);
		try {
			await apiPut(`/admin/orders/${orderId}/cancel`, { reason: cancelReason.trim() || null });
			toast.success("Đã hủy đơn hàng");
			setCancelOpen(false);
			setOpen(false);
			onChanged();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Hủy đơn thất bại");
		} finally {
			setActionLoading(false);
		}
	}
	const st = detail?.current_status;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
			open,
			onOpenChange: setOpen,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					size: "sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "mr-1 size-4" }), " Chi tiết"]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-h-[85vh] max-w-lg overflow-y-auto",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: ["Đơn ", detail?.order_code ?? `#${orderId}`] }) }), !detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-center py-10 text-muted-foreground",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
									label: "Khách hàng",
									value: detail.customer_name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
									label: "Số điện thoại",
									value: detail.customer_phone
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
									label: "Chi nhánh",
									value: detail.store_name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
									label: "Loại đơn",
									value: detail.order_type
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
									label: "Thanh toán",
									value: detail.payment_method
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
									label: "Trạng thái",
									value: st ?? ""
								}),
								detail.location_name && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
									label: "Vị trí",
									value: detail.location_name
								}),
								detail.delivery_addr && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
									label: "Địa chỉ",
									value: detail.delivery_addr
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
								children: detail.items.map((it, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-medium",
										children: [
											it.qty,
											"× ",
											it.product_name
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground block text-xs",
										children: [
											it.size_label ? `Size ${it.size_label}` : null,
											it.base_tea || null,
											it.sugar_level ? `${it.sugar_level} đường` : null,
											it.ice_level ? `${it.ice_level} đá` : null,
											it.toppings.length > 0 ? it.toppings.map((t) => t.name).join(", ") : null,
											it.note ? `(${it.note})` : null
										].filter(Boolean).join(" · ") || "—"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold whitespace-nowrap",
										children: vnd(it.line_total)
									})]
								}, idx))
							})]
						}),
						detail.status_history.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 text-xs font-semibold tracking-wide uppercase",
								children: "Lịch sử trạng thái"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "text-muted-foreground space-y-1 text-xs",
								children: detail.status_history.map((h, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [h.status, h.changed_by_name ? ` · ${h.changed_by_name}` : ""] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "whitespace-nowrap",
										children: new Date(h.created_at).toLocaleString("vi-VN")
									})]
								}, idx))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-t pt-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold",
								children: "Tổng thanh toán"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-primary font-display text-lg font-extrabold",
								children: [vnd(detail.total), detail.discount_amount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground text-xs font-normal",
									children: [
										" ",
										"(giảm ",
										vnd(detail.discount_amount),
										")"
									]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								st === "Chờ xác nhận" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "hero",
									className: "flex-1",
									disabled: actionLoading,
									onClick: () => changeStatus("Đã xác nhận"),
									children: "Xác nhận đơn"
								}),
								st === "Đã xác nhận" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "hero",
									className: "flex-1",
									disabled: actionLoading,
									onClick: () => changeStatus("Đang chuẩn bị"),
									children: "Bắt đầu làm"
								}),
								st === "Đang chuẩn bị" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "hero",
									className: "flex-1",
									disabled: actionLoading,
									onClick: () => changeStatus("Hoàn thành"),
									children: "Hoàn thành"
								}),
								st === "Đang giao" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "hero",
									className: "flex-1",
									disabled: actionLoading,
									onClick: () => changeStatus("Hoàn thành"),
									children: "Xác nhận giao xong"
								}),
								st !== "Đã hủy" && st !== "Hoàn thành" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "outline",
									className: "text-berry flex-1",
									disabled: actionLoading,
									onClick: () => setCancelOpen(true),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "mr-1 size-4" }), " Hủy đơn"]
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
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InBillModal, {
			order: detail ? toBillOrder(detail) : null,
			open: billOpen,
			onClose: () => setBillOpen(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
			open: cancelOpen,
			onOpenChange: setCancelOpen,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
					"Hủy đơn ",
					detail?.order_code ?? `#${orderId}`,
					"?"
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "Hành động này không thể hoàn tác." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: cancelReason,
					onChange: (e) => setCancelReason(e.target.value),
					placeholder: "Lý do hủy"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Thoát" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
					className: "bg-berry hover:bg-berry/90",
					disabled: actionLoading,
					onClick: (e) => {
						e.preventDefault();
						handleCancel();
					},
					children: "Xác nhận hủy"
				})] })
			] })
		})
	] });
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
