import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { P as MapPin, d as Store, mt as Bike, u as Ticket } from "../_libs/lucide-react.mjs";
import { _ as vnd } from "./data-Z_klJ5jj.mjs";
import { _ as useNavigate, g as Link, v as useSearch } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as apiPost, n as apiGet } from "./api-Cnar3gwH.mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DXom7Yjz.mjs";
import { n as useCart } from "./cart-BwPSPLo8.mjs";
import { t as Separator } from "./separator-B_-_Z5Eo.mjs";
import { t as Textarea } from "./textarea-DS1fyxUj.mjs";
import { t as PageHeader } from "./PageHeader-4GMedA0k.mjs";
import { n as RadioGroupItem, t as RadioGroup } from "./radio-group-DVLhDc-e.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/thanh-toan-BWMaT8QY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var payMethods = [
	{
		id: "cod",
		label: "Thanh toán khi nhận hàng (COD)"
	},
	{
		id: "qr",
		label: "Chuyển khoản VietQR / VNPAY"
	},
	{
		id: "momo",
		label: "Ví MoMo"
	},
	{
		id: "zalopay",
		label: "Ví ZaloPay"
	}
];
var PAY_MAP = {
	cod: "COD",
	qr: "VietQR",
	momo: "MoMo",
	zalopay: "ZaloPay"
};
function Checkout() {
	const { items, subtotal, clear } = useCart();
	const navigate = useNavigate();
	const { table_id: searchTableId } = useSearch({ from: "/thanh-toan" });
	const [method, setMethod] = (0, import_react.useState)("delivery");
	const [pay, setPay] = (0, import_react.useState)("cod");
	const [name, setName] = (0, import_react.useState)("");
	const [phone, setPhone] = (0, import_react.useState)("");
	const [addr, setAddr] = (0, import_react.useState)("");
	const [branch, setBranch] = (0, import_react.useState)(null);
	const [storeOptions, setStoreOptions] = (0, import_react.useState)([]);
	const [note, setNote] = (0, import_react.useState)("");
	const [voucherCode, setVoucherCode] = (0, import_react.useState)("");
	const [voucherDiscount, setVoucherDiscount] = (0, import_react.useState)(0);
	const [appliedCode, setAppliedCode] = (0, import_react.useState)("");
	const [tableInfo, setTableInfo] = (0, import_react.useState)(null);
	const [submitting, setSubmitting] = (0, import_react.useState)(false);
	const [tableId, setTableId] = (0, import_react.useState)(searchTableId || (typeof window !== "undefined" ? sessionStorage.getItem("teaplus_table_id") : null));
	(0, import_react.useEffect)(() => {
		if (!tableId) return;
		let cancelled = false;
		sessionStorage.setItem("teaplus_table_id", tableId);
		apiGet(`/api/table/resolve?table_id=${encodeURIComponent(tableId)}`).then((res) => {
			if (cancelled) return;
			setTableInfo(res);
			setMethod("takeaway");
			setBranch(String(res.table.store_id));
		}).catch(() => {
			if (!cancelled) setTableInfo(null);
		});
		return () => {
			cancelled = true;
		};
	}, [tableId]);
	const discount = Math.min(voucherDiscount, subtotal);
	const total = Math.max(0, subtotal - discount);
	async function applyVoucher() {
		if (!voucherCode.trim()) return toast.error("Nhập mã ưu đãi trước");
		try {
			const res = await apiPost("/api/vouchers/apply", {
				code: voucherCode.trim(),
				subtotal,
				customer_phone: phone || "khach"
			});
			if (!res.valid) return toast.error(res.message);
			setVoucherDiscount(res.discount_amount);
			setAppliedCode(voucherCode.trim());
			toast.success(res.message);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Không áp dụng được mã");
		}
	}
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		apiGet("/api/stores").then((rows) => {
			if (cancelled || rows.length === 0) return;
			setStoreOptions(rows);
			const savedId = Number(sessionStorage.getItem("teaplus_store_id"));
			const tableStoreId = Number(tableId);
			const initial = rows.find((s) => s.id === savedId)?.id ?? rows.find((s) => s.id === tableStoreId)?.id ?? rows[0].id;
			setBranch((prev) => prev ?? String(initial));
		}).catch(() => {
			if (!cancelled) toast.error("Không tải được danh sách chi nhánh");
		});
		return () => {
			cancelled = true;
		};
	}, []);
	async function submitOrder() {
		if (items.length === 0) return;
		if (!name.trim() || !phone.trim()) return toast.error("Vui lòng nhập họ tên và số điện thoại");
		if (!branch && !tableInfo) return toast.error("Vui lòng chọn chi nhánh nhận hàng");
		setSubmitting(true);
		try {
			const [products, sizes, toppings] = await Promise.all([
				apiGet("/api/products"),
				apiGet("/api/options/sizes"),
				apiGet("/api/options/toppings")
			]);
			const productIdBySlug = new Map(products.map((p) => [p.slug, p.id]));
			const sizeIdByLabel = new Map(sizes.map((s) => [s.label.toLowerCase(), s.id]));
			const toppingIdByName = new Map(toppings.map((t) => [t.name.toLowerCase(), t.id]));
			const res = await apiPost("/api/orders", {
				store_id: tableInfo ? tableInfo.table.store_id : Number(branch),
				table_id: tableId ? Number(tableId) : null,
				order_type: method === "delivery" ? "Delivery" : "Take-away",
				payment_method: PAY_MAP[pay] || "COD",
				customer_name: name.trim(),
				customer_phone: phone.trim(),
				delivery_addr: method === "delivery" && addr.trim() ? addr.trim() : null,
				voucher_code: appliedCode || null,
				note: note.trim() || null,
				items: items.map((i) => ({
					product_id: productIdBySlug.get(i.productId),
					size_id: sizeIdByLabel.get(i.size.toLowerCase()) ?? null,
					base_tea: i.base,
					sugar_level: i.sugar,
					ice_level: i.ice,
					topping_ids: i.toppings.map((t) => toppingIdByName.get(t.toLowerCase())).filter((id) => id != null),
					qty: i.qty,
					note: i.note
				}))
			});
			clear();
			toast.success("Đặt hàng thành công!", { description: `Mã đơn ${res.order_code} · ${vnd(res.total)} — đang chờ xác nhận.` });
			navigate({
				to: "/theo-doi-don",
				search: { code: res.order_code }
			});
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Đặt hàng thất bại, thử lại");
		} finally {
			setSubmitting(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Checkout",
			title: "Giỏ hàng & Thanh toán"
		}),
		tableInfo && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "container-page",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "gradient-warm text-primary-foreground flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 px-5 py-4 shadow-glow",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "bg-white/20 flex size-11 shrink-0 items-center justify-center rounded-xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-6" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-base font-bold",
						children: ["Đặt món tại: ", tableInfo.table.name]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm opacity-90",
						children: [
							tableInfo.table.store_name,
							" · ",
							tableInfo.table.store_address
						]
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "bg-white/20 rounded-full px-3 py-1 text-xs font-semibold",
					children: "Bàn đã được gắn vào đơn"
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "container-page grid gap-6 py-10 lg:grid-cols-[1fr_380px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "bg-card rounded-2xl border p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "font-display mb-4 text-lg font-bold",
								children: [
									"Món đã chọn (",
									items.length,
									")"
								]
							}),
							items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "py-8 text-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground text-sm",
									children: "Giỏ hàng trống."
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									variant: "hero",
									size: "sm",
									className: "mt-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/menu",
										children: "Chọn món ngay"
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-4",
								children: items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-3 border-b pb-4 last:border-0 last:pb-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: i.image,
										alt: i.name,
										loading: "lazy",
										className: "size-16 rounded-xl object-cover"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-semibold",
												children: i.name
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-muted-foreground text-xs",
												children: [
													"Size ",
													i.size,
													" · ",
													i.base,
													" · ",
													i.sugar,
													" đường · ",
													i.ice,
													" đá"
												]
											}),
											i.toppings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-muted-foreground text-xs",
												children: ["Topping: ", i.toppings.join(", ")]
											}),
											i.note && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-muted-foreground text-xs italic",
												children: ["Ghi chú: ", i.note]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-primary mt-1 font-bold text-sm",
												children: [
													vnd(i.unitPrice),
													" × ",
													i.qty
												]
											})
										]
									})]
								}, i.key))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "bg-card rounded-2xl border p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display mb-4 text-lg font-bold",
								children: "Hình thức nhận hàng"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setMethod("delivery"),
									className: `flex items-center gap-3 rounded-xl border p-4 text-left ${method === "delivery" ? "border-primary bg-accent/50" : ""}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bike, { className: "text-primary size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-semibold",
										children: "Giao tận nơi"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground text-xs",
										children: "25–35 phút"
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setMethod("takeaway"),
									className: `flex items-center gap-3 rounded-xl border p-4 text-left ${method === "takeaway" ? "border-primary bg-accent/50" : ""}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Store, { className: "text-primary size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-semibold",
										children: tableInfo ? "Đến lấy / Tại bàn" : "Đến lấy tại cửa hàng"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground text-xs",
										children: "Sẵn sàng sau 15 phút"
									})] })]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 grid gap-3 sm:grid-cols-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "name",
											children: "Họ và tên"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											id: "name",
											placeholder: "Nguyễn Minh Trang",
											value: name,
											onChange: (e) => setName(e.target.value)
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "tel",
											children: "Số điện thoại"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											id: "tel",
											inputMode: "tel",
											placeholder: "09xx xxx xxx",
											value: phone,
											onChange: (e) => setPhone(e.target.value)
										})]
									}),
									method === "delivery" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1.5 sm:col-span-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "addr",
											children: "Địa chỉ giao hàng"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											id: "addr",
											placeholder: "Số nhà, đường, phường, quận",
											value: addr,
											onChange: (e) => setAddr(e.target.value)
										})]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1.5 sm:col-span-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Chi nhánh nhận hàng" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
												value: branch ?? void 0,
												onValueChange: setBranch,
												disabled: !!tableInfo || storeOptions.length === 0,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
													className: "w-full",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: storeOptions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
													value: String(s.id),
													children: s.name
												}, s.id)) })]
											}),
											tableInfo && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-muted-foreground text-xs",
												children: [
													"Bàn ",
													tableInfo.table.name,
													" — ",
													tableInfo.table.store_name
												]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1.5 sm:col-span-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "note",
											children: "Ghi chú"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
											id: "note",
											rows: 2,
											placeholder: "VD: Ít đá hơn, gọi trước khi giao…",
											value: note,
											onChange: (e) => setNote(e.target.value)
										})]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "bg-card rounded-2xl border p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display mb-4 text-lg font-bold",
							children: "Phương thức thanh toán"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, {
							value: pay,
							onValueChange: setPay,
							className: "grid gap-2 sm:grid-cols-2",
							children: payMethods.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								htmlFor: `pay-${m.id}`,
								className: `flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${pay === m.id ? "border-primary bg-accent/40" : ""}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroupItem, {
									value: m.id,
									id: `pay-${m.id}`
								}), m.label]
							}, m.id))
						})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				className: "lg:sticky lg:top-32 lg:h-fit",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card space-y-4 rounded-2xl border p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-lg font-bold",
							children: "Tóm tắt đơn hàng"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ticket, { className: "text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									placeholder: "Nhập mã ưu đãi",
									className: "pl-9",
									value: voucherCode,
									onChange: (e) => setVoucherCode(e.target.value)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "soft",
								onClick: applyVoucher,
								disabled: !!appliedCode,
								children: appliedCode ? "Đã áp dụng" : "Áp dụng"
							})]
						}),
						appliedCode && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-leaf text-xs font-medium",
							children: [
								"Mã ",
								appliedCode,
								": giảm ",
								vnd(discount)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "Tiền món",
								value: vnd(subtotal)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "Giảm giá",
								value: discount ? `− ${vnd(discount)}` : "0₫"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold",
								children: "Tổng thanh toán"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-primary font-display text-2xl font-extrabold",
								children: vnd(total)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "hero",
							className: "w-full",
							disabled: items.length === 0 || submitting,
							onClick: submitOrder,
							children: submitting ? "Đang đặt hàng…" : "Xác nhận đặt hàng"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-center text-xs",
							children: "Tổng tiền do hệ thống tính toán chính xác từ giá niêm yết."
						})
					]
				})
			})]
		})
	] });
}
function Row({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-medium",
			children: value
		})]
	});
}
//#endregion
export { Checkout as component };
