import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { C as Plus, T as Pencil, u as Ticket } from "../_libs/lucide-react.mjs";
import { _ as vnd } from "./data-Z_klJ5jj.mjs";
import { a as apiPut, i as apiPost, n as apiGet } from "./api-CyIKtyVS.mjs";
import { t as Card } from "./card-N78Fb1PV.mjs";
import { t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { a as TableHeader, i as TableHead, n as TableBody, o as TableRow, r as TableCell, t as Table } from "./table-B4dSFUe4.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, r as DialogFooter, t as Dialog } from "./dialog-Di5jevJl.mjs";
import { t as Switch } from "./switch-BCfmMxEa.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DXom7Yjz.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.khuyen-mai-9rgmtbCd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var statusTone = {
	"Đang diễn ra": "bg-leaf/15 text-leaf",
	"Đang chạy": "bg-leaf/15 text-leaf",
	"Lên lịch": "bg-primary/15 text-primary",
	"Sắp diễn ra": "bg-primary/15 text-primary",
	"Đã kết thúc": "bg-muted text-muted-foreground",
	"Kết thúc": "bg-muted text-muted-foreground"
};
var emptyForm = {
	title: "",
	code: "",
	discount_value: "",
	max_discount: "",
	min_order: "",
	voucher_type: "time_bounded",
	usage_limit: "",
	start_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
	end_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
};
function PromotionsAdminPage() {
	const [promos, setPromos] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [dialogOpen, setDialogOpen] = (0, import_react.useState)(false);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [form, setForm] = (0, import_react.useState)(emptyForm);
	const load = (0, import_react.useCallback)(async () => {
		setLoading(true);
		try {
			const rows = await apiGet("/admin/promotions");
			setPromos(rows);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Không tải được danh sách");
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		load();
	}, [load]);
	function openCreate() {
		setEditing(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}
	function openEdit(p) {
		setEditing(p);
		setForm({
			title: p.title,
			code: p.code || "",
			discount_value: p.discount_value != null ? String(p.discount_value) : "",
			max_discount: p.max_discount != null ? String(p.max_discount) : "",
			min_order: p.min_order != null ? String(p.min_order) : "",
			voucher_type: p.voucher_type,
			usage_limit: p.usage_limit != null ? String(p.usage_limit) : "",
			start_date: p.start_date?.slice(0, 10) || "",
			end_date: p.end_date?.slice(0, 10) || ""
		});
		setDialogOpen(true);
	}
	async function save() {
		if (!form.title.trim()) return toast.error("Nhập tên chương trình");
		if (!form.code.trim()) return toast.error("Nhập mã giảm giá");
		const discount = Number(form.discount_value);
		if (!discount || discount <= 0 || discount > 100) return toast.error("Phần trăm giảm phải từ 1 đến 100");
		setSaving(true);
		try {
			const payload = {
				title: form.title.trim(),
				code: form.code.trim().toUpperCase(),
				type: "Giảm giá",
				discount_value: discount,
				discount_type: "percent",
				max_discount: form.max_discount ? Number(form.max_discount) : null,
				min_order: form.min_order ? Number(form.min_order) : null,
				voucher_type: form.voucher_type,
				usage_limit: form.voucher_type === "time_bounded" && form.usage_limit ? Number(form.usage_limit) : null,
				start_date: form.start_date,
				end_date: form.end_date
			};
			if (editing) {
				await apiPut(`/admin/promotions/${editing.id}`, payload);
				toast.success("Đã cập nhật mã giảm giá");
			} else {
				await apiPost("/admin/promotions", payload);
				toast.success("Đã tạo mã giảm giá");
			}
			setDialogOpen(false);
			load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lưu thất bại");
		} finally {
			setSaving(false);
		}
	}
	async function toggleActive(p, active) {
		try {
			await apiPut(`/admin/promotions/${p.id}`, { is_active: active });
			setPromos((prev) => prev.map((x) => x.id === p.id ? {
				...x,
				is_active: active
			} : x));
			toast.success(active ? "Đã bật mã" : "Đã tắt mã");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Khuyến mãi & Voucher",
			desc: "Mã giảm giá % — dùng 1 lần hoặc theo thời hạn giới hạn lượt",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: openCreate,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Tạo mã giảm giá"]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "shadow-soft overflow-hidden",
			children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "py-16 text-center text-sm text-muted-foreground",
				children: "Đang tải…"
			}) : promos.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "py-16 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ticket, { className: "text-muted-foreground mx-auto mb-2 size-8" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-semibold",
						children: "Chưa có mã giảm giá nào"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-sm",
						children: "Bấm \"Tạo mã giảm giá\" để bắt đầu."
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Table, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Chương trình" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Giảm" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Loại mã" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
						className: "hidden md:table-cell",
						children: "Điều kiện"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
						className: "hidden lg:table-cell",
						children: "Hạn dùng"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
						className: "hidden lg:table-cell",
						children: "Lượt dùng"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Trạng thái" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
						className: "text-right",
						children: "Thao tác"
					})
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableBody, { children: promos.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, {
					className: p.is_active ? "" : "opacity-50",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold",
							children: p.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-primary font-mono text-xs font-bold",
							children: p.code
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: p.discount_type === "percent" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-bold",
							children: [
								p.discount_value,
								"%",
								p.max_discount ? ` (max ${vnd(p.max_discount)})` : ""
							]
						}) : vnd(p.discount_value || 0) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: p.voucher_type === "single_use" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "secondary",
							className: "bg-berry/10 text-berry",
							children: "🎟️ Mã 1 lần"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "secondary",
							className: "bg-primary/10 text-primary",
							children: "📅 Theo thời hạn"
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							className: "text-muted-foreground hidden text-xs md:table-cell",
							children: p.min_order ? `Đơn từ ${vnd(p.min_order)}` : "Không giới hạn"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, {
							className: "text-muted-foreground hidden text-xs lg:table-cell",
							children: [
								p.start_date?.slice(0, 10),
								" → ",
								p.end_date?.slice(0, 10)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, {
							className: "hidden text-xs lg:table-cell",
							children: [p.used_count, p.usage_limit != null && ` / ${p.usage_limit}`]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "secondary",
							className: statusTone[p.status] || "",
							children: p.status
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							className: "text-right",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-end gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: p.is_active,
									onCheckedChange: (v) => toggleActive(p, v),
									"aria-label": `Bật/tắt mã ${p.code}`
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "sm",
									onClick: () => openEdit(p),
									"aria-label": `Sửa mã ${p.code}`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" })
								})]
							})
						})
					]
				}, p.id)) })] })
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: dialogOpen,
			onOpenChange: setDialogOpen,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "sm:max-w-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: editing ? "Sửa mã giảm giá" : "Tạo mã giảm giá mới" }) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5 sm:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "promo-title",
									children: "Tên chương trình"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "promo-title",
									placeholder: "VD: Giảm 10% cho khách mới",
									value: form.title,
									onChange: (e) => setForm({
										...form,
										title: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "promo-code",
									children: "Mã giảm giá"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "promo-code",
									placeholder: "VD: NEW10",
									value: form.code,
									onChange: (e) => setForm({
										...form,
										code: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "promo-value",
									children: "Phần trăm giảm (%)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "promo-value",
									type: "number",
									min: 1,
									max: 100,
									placeholder: "10",
									value: form.discount_value,
									onChange: (e) => setForm({
										...form,
										discount_value: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "promo-max",
									children: "Mức giảm tối đa (₫)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "promo-max",
									type: "number",
									min: 0,
									placeholder: "VD: 30000",
									value: form.max_discount,
									onChange: (e) => setForm({
										...form,
										max_discount: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "promo-min",
									children: "Đơn tối thiểu (₫)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "promo-min",
									type: "number",
									min: 0,
									placeholder: "VD: 89000",
									value: form.min_order,
									onChange: (e) => setForm({
										...form,
										min_order: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Loại mã" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
									value: form.voucher_type,
									onValueChange: (v) => setForm({
										...form,
										voucher_type: v
									}),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
										value: "single_use",
										children: "🎟️ Mã 1 lần (mỗi SĐT 1 lần)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
										value: "time_bounded",
										children: "📅 Theo thời hạn & lượt dùng"
									})] })]
								})]
							}),
							form.voucher_type === "time_bounded" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "promo-limit",
									children: "Giới hạn lượt dùng"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "promo-limit",
									type: "number",
									min: 1,
									placeholder: "VD: 500",
									value: form.usage_limit,
									onChange: (e) => setForm({
										...form,
										usage_limit: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "promo-start",
									children: "Ngày bắt đầu"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "promo-start",
									type: "date",
									value: form.start_date,
									onChange: (e) => setForm({
										...form,
										start_date: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "promo-end",
									children: "Ngày kết thúc"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "promo-end",
									type: "date",
									value: form.end_date,
									onChange: (e) => setForm({
										...form,
										end_date: e.target.value
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => setDialogOpen(false),
						children: "Hủy"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: save,
						disabled: saving,
						children: saving ? "Đang lưu…" : editing ? "Cập nhật" : "Tạo mã"
					})] })
				]
			})
		})
	] });
}
//#endregion
export { PromotionsAdminPage as component };
