import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { C as Plus, R as LoaderCircle, T as Pencil, U as Image, c as Trash2, o as Upload, t as X } from "../_libs/lucide-react.mjs";
import { _ as vnd } from "./data-Z_klJ5jj.mjs";
import { a as apiPut, i as apiPost, n as apiGet, t as apiDelete } from "./api-Cnar3gwH.mjs";
import { n as CardContent, t as Card } from "./card-N78Fb1PV.mjs";
import { n as SectionCard, t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, o as DialogTrigger, t as Dialog } from "./dialog-Di5jevJl.mjs";
import { t as Switch } from "./switch-BCfmMxEa.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-BtxHXOBC.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DXom7Yjz.mjs";
import { a as AlertDialogDescription, c as AlertDialogTitle, i as AlertDialogContent, n as AlertDialogAction, o as AlertDialogFooter, r as AlertDialogCancel, s as AlertDialogHeader, t as AlertDialog } from "./alert-dialog-DTqLMw86.mjs";
import { t as Textarea } from "./textarea-DS1fyxUj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.thuc-don-a4RDJwh3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function slugify(s) {
	return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/ð/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function MenuAdminPage() {
	const [categories, setCategories] = (0, import_react.useState)([]);
	const [products, setProducts] = (0, import_react.useState)([]);
	const [options, setOptions] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [editProduct, setEditProduct] = (0, import_react.useState)(null);
	const [deleteProduct, setDeleteProduct] = (0, import_react.useState)(null);
	const [deleteCategory, setDeleteCategory] = (0, import_react.useState)(null);
	const [editCategory, setEditCategory] = (0, import_react.useState)(null);
	const [toppingDialog, setToppingDialog] = (0, import_react.useState)(false);
	const [editTopping, setEditTopping] = (0, import_react.useState)(null);
	const [toppingName, setToppingName] = (0, import_react.useState)("");
	const [toppingPrice, setToppingPrice] = (0, import_react.useState)("15000");
	const [savingTopping, setSavingTopping] = (0, import_react.useState)(false);
	const [deleteTopping, setDeleteTopping] = (0, import_react.useState)(null);
	const [baseDialog, setBaseDialog] = (0, import_react.useState)(false);
	const [editBase, setEditBase] = (0, import_react.useState)(null);
	const [baseName, setBaseName] = (0, import_react.useState)("");
	const [savingBase, setSavingBase] = (0, import_react.useState)(false);
	const [deleteBase, setDeleteBase] = (0, import_react.useState)(null);
	const [tab, setTab] = (0, import_react.useState)("products");
	const [reloadKey, setReloadKey] = (0, import_react.useState)(0);
	const load = (0, import_react.useCallback)(async () => {
		setLoading(true);
		try {
			const [cats, prods, opts] = await Promise.all([
				apiGet("/admin/menu/categories"),
				apiGet("/admin/menu/products"),
				apiGet("/admin/menu/options")
			]);
			setCategories(cats);
			setProducts(prods);
			setOptions(opts);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Không tải được thực đơn");
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		load();
	}, [load, reloadKey]);
	async function toggleProduct(p) {
		try {
			const res = await apiPut(`/admin/menu/products/${p.id}/toggle`, {});
			toast.success(res.message);
			setProducts((prev) => prev.map((x) => x.id === p.id ? {
				...x,
				is_available: res.is_available
			} : x));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
		}
	}
	async function confirmDeleteProduct() {
		if (!deleteProduct) return;
		try {
			await apiDelete(`/admin/menu/products/${deleteProduct.id}`);
			toast.success(`Đã xóa món ${deleteProduct.name}`);
			setDeleteProduct(null);
			setReloadKey((k) => k + 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Xóa món thất bại");
		}
	}
	async function confirmDeleteCategory() {
		if (!deleteCategory) return;
		try {
			await apiDelete(`/admin/menu/categories/${deleteCategory.id}`);
			toast.success(`Đã xóa danh mục ${deleteCategory.name}`);
			setDeleteCategory(null);
			setReloadKey((k) => k + 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Xóa danh mục thất bại");
		}
	}
	function openTopping(t) {
		setEditTopping(t ?? null);
		setToppingName(t?.name ?? "");
		setToppingPrice(String(t?.price ?? 15e3));
		setToppingDialog(true);
	}
	async function saveTopping() {
		if (!toppingName.trim()) return toast.error("Nhập tên topping");
		setSavingTopping(true);
		try {
			const payload = {
				name: toppingName.trim(),
				price: Number(toppingPrice) || 0
			};
			if (editTopping) {
				await apiPut(`/admin/menu/toppings/${editTopping.id}`, payload);
				toast.success("Đã cập nhật topping");
			} else {
				await apiPost("/admin/menu/toppings", payload);
				toast.success("Đã thêm topping");
			}
			setToppingDialog(false);
			setReloadKey((k) => k + 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lưu topping thất bại");
		} finally {
			setSavingTopping(false);
		}
	}
	async function toggleTopping(t) {
		try {
			await apiPut(`/admin/menu/toppings/${t.id}`, { is_available: t.is_available ? 0 : 1 });
			toast.success(t.is_available ? "Đã tắt topping" : "Đã bật topping");
			setReloadKey((k) => k + 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
		}
	}
	async function confirmDeleteTopping() {
		if (!deleteTopping) return;
		try {
			await apiDelete(`/admin/menu/toppings/${deleteTopping.id}`);
			toast.success("Đã xóa topping");
			setDeleteTopping(null);
			setReloadKey((k) => k + 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Xóa topping thất bại");
		}
	}
	function openBase(b) {
		setEditBase(b ?? null);
		setBaseName(b?.name ?? "");
		setBaseDialog(true);
	}
	async function saveBase() {
		if (!baseName.trim()) return toast.error("Nhập tên cốt trà nền");
		setSavingBase(true);
		try {
			if (editBase) {
				await apiPut(`/admin/menu/bases/${editBase.id}`, { name: baseName.trim() });
				toast.success("Đã cập nhật cốt trà");
			} else {
				await apiPost("/admin/menu/bases", { name: baseName.trim() });
				toast.success("Đã thêm cốt trà");
			}
			setBaseDialog(false);
			setReloadKey((k) => k + 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lưu cốt trà thất bại");
		} finally {
			setSavingBase(false);
		}
	}
	async function confirmDeleteBase() {
		if (!deleteBase) return;
		try {
			await apiDelete(`/admin/menu/bases/${deleteBase.id}`);
			toast.success("Đã xóa cốt trà");
			setDeleteBase(null);
			setReloadKey((k) => k + 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Xóa cốt trà thất bại");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Quản lý thực đơn",
			desc: "Danh mục, sản phẩm và nhóm tùy chọn hiển thị trên website khách hàng",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductForm, {
				categories,
				bases: options?.bases ?? [],
				onSaved: () => setReloadKey((k) => k + 1),
				product: editProduct,
				onClearEdit: () => setEditProduct(null)
			})
		}),
		loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex items-center justify-center py-20 text-muted-foreground",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
			value: tab,
			onValueChange: setTab,
			defaultValue: "products",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "products",
						children: "Sản phẩm"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "categories",
						children: "Danh mục"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "options",
						children: "Tùy chọn"
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "products",
					className: "mt-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
						children: [products.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "shadow-soft overflow-hidden",
							children: [p.image_url && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: p.image_url,
								alt: p.name,
								loading: "lazy",
								className: "h-40 w-full object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
								className: "p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-display font-bold",
											children: p.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-muted-foreground text-xs",
											children: [
												p.category_name || `Danh mục #${p.category_id}`,
												" · /",
												p.slug
											]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "secondary",
											children: p.base_tea
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-primary mt-2 font-bold",
										children: vnd(p.price)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 flex items-center justify-between border-t pt-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "flex items-center gap-2 text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
												checked: p.is_available,
												onCheckedChange: () => toggleProduct(p)
											}), p.is_available ? "Đang bán" : "Tạm ngưng"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												size: "icon",
												"aria-label": "Sửa",
												onClick: () => setEditProduct(p),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												size: "icon",
												"aria-label": `Xóa món ${p.name}`,
												className: "text-muted-foreground hover:text-destructive",
												onClick: () => setDeleteProduct(p),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
											})]
										})]
									})
								]
							})]
						}, p.id)), products.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground col-span-full py-10 text-center text-sm",
							children: "Chưa có sản phẩm nào"
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "categories",
					className: "mt-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: "Danh mục món",
						desc: "Danh mục tự kích hoạt khi thêm — chỉ sửa tên hoặc xóa",
						actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategoryForm, {
							onSaved: () => setReloadKey((k) => k + 1),
							category: editCategory,
							onClearEdit: () => setEditCategory(null)
						}),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-2",
							children: categories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center gap-3 rounded-xl border p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "min-w-0 flex-1",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-sm font-semibold",
											children: [
												c.name,
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-muted-foreground font-normal",
													children: [
														"· ",
														c.items,
														" món"
													]
												})
											]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										size: "icon",
										"aria-label": `Sửa danh mục ${c.name}`,
										onClick: () => setEditCategory(c),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										size: "icon",
										"aria-label": `Xóa danh mục ${c.name}`,
										className: "text-muted-foreground hover:text-destructive",
										onClick: () => setDeleteCategory(c),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
									})
								]
							}, c.id))
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "options",
					className: "mt-5",
					children: options && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 md:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
								title: "Size",
								desc: `${options.sizes.length} lựa chọn`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap gap-2",
									children: options.sizes.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
										variant: "secondary",
										className: "rounded-full px-3 py-1",
										children: [
											s.name,
											" ",
											s.price_extra > 0 ? `(+${vnd(s.price_extra)})` : ""
										]
									}, s.id))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
								title: "Cốt trà nền",
								desc: `${options.bases.length} lựa chọn`,
								actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "soft",
									size: "sm",
									onClick: () => openBase(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm cốt trà"]
								}),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-2",
									children: [options.bases.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 rounded-lg border px-3 py-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "min-w-0 flex-1 text-sm",
												children: b.name
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												size: "icon",
												"aria-label": `Sửa cốt trà ${b.name}`,
												onClick: () => openBase(b),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												size: "icon",
												"aria-label": `Xóa cốt trà ${b.name}`,
												className: "text-muted-foreground hover:text-destructive",
												onClick: () => setDeleteBase(b),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
											})
										]
									}, b.id)), options.bases.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground py-4 text-center text-sm",
										children: "Chưa có cốt trà nào"
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
								title: "Mức đường",
								desc: `${options.sugars.length} lựa chọn`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap gap-2",
									children: options.sugars.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: "secondary",
										className: "rounded-full px-3 py-1",
										children: s.label
									}, s.id))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
								title: "Mức đá",
								desc: `${options.ices.length} lựa chọn`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap gap-2",
									children: options.ices.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: "secondary",
										className: "rounded-full px-3 py-1",
										children: s.label
									}, s.id))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
								title: "Topping",
								desc: `${options.toppings.length} lựa chọn`,
								actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "soft",
									size: "sm",
									onClick: () => openTopping(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm topping"]
								}),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-2",
									children: [options.toppings.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 rounded-lg border px-3 py-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
												checked: t.is_available,
												onCheckedChange: () => toggleTopping(t)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "min-w-0 flex-1 text-sm",
												children: [
													t.name,
													" ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-muted-foreground",
														children: ["+", vnd(t.price)]
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												size: "icon",
												"aria-label": `Sửa topping ${t.name}`,
												onClick: () => openTopping(t),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												size: "icon",
												"aria-label": `Xóa topping ${t.name}`,
												className: "text-muted-foreground hover:text-destructive",
												onClick: () => setDeleteTopping(t),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
											})
										]
									}, t.id)), options.toppings.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground py-4 text-center text-sm",
										children: "Chưa có topping nào"
									})]
								})
							})
						]
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
			open: !!deleteProduct,
			onOpenChange: (o) => !o && setDeleteProduct(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
				"Xóa món \"",
				deleteProduct?.name,
				"\"?"
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "Món sẽ bị xóa vĩnh viễn khỏi thực đơn. Không thể xóa nếu đã có trong đơn hàng." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Hủy" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
				className: "bg-berry text-berry-foreground hover:bg-berry/90",
				onClick: confirmDeleteProduct,
				children: "Xóa món"
			})] })] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
			open: !!deleteCategory,
			onOpenChange: (o) => !o && setDeleteCategory(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
				"Xóa danh mục \"",
				deleteCategory?.name,
				"\"?"
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "Danh mục sẽ bị xóa vĩnh viễn. Không thể xóa nếu còn món trong đó." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Hủy" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
				className: "bg-berry text-berry-foreground hover:bg-berry/90",
				onClick: confirmDeleteCategory,
				children: "Xóa danh mục"
			})] })] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: toppingDialog,
			onOpenChange: setToppingDialog,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: editTopping ? `Sửa topping: ${editTopping.name}` : "Thêm topping mới" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "t-name",
							children: "Tên topping"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "t-name",
							value: toppingName,
							onChange: (e) => setToppingName(e.target.value),
							className: "mt-1.5",
							placeholder: "Trân châu trắng"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "t-price",
							children: "Giá (₫)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "t-price",
							type: "number",
							value: toppingPrice,
							onChange: (e) => setToppingPrice(e.target.value),
							className: "mt-1.5"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "hero",
							className: "w-full",
							onClick: saveTopping,
							disabled: savingTopping,
							children: savingTopping ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : editTopping ? "Lưu thay đổi" : "Thêm topping"
						})
					]
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
			open: !!deleteTopping,
			onOpenChange: (o) => !o && setDeleteTopping(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
				"Xóa topping \"",
				deleteTopping?.name,
				"\"?"
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "Topping sẽ bị xóa khỏi menu. Hành động không thể hoàn tác." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Hủy" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
				className: "bg-berry text-berry-foreground hover:bg-berry/90",
				onClick: confirmDeleteTopping,
				children: "Xóa topping"
			})] })] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: baseDialog,
			onOpenChange: setBaseDialog,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: editBase ? `Sửa cốt trà: ${editBase.name}` : "Thêm cốt trà nền mới" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "b-name",
						children: "Tên cốt trà"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "b-name",
						value: baseName,
						onChange: (e) => setBaseName(e.target.value),
						className: "mt-1.5",
						placeholder: "Lục Trà Lài"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "hero",
						className: "w-full",
						onClick: saveBase,
						disabled: savingBase,
						children: savingBase ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : editBase ? "Lưu thay đổi" : "Thêm cốt trà"
					})]
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
			open: !!deleteBase,
			onOpenChange: (o) => !o && setDeleteBase(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
				"Xóa cốt trà \"",
				deleteBase?.name,
				"\"?"
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "Cốt trà sẽ bị xóa khỏi danh sách lựa chọn. Hành động không thể hoàn tác." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Hủy" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
				className: "bg-berry text-berry-foreground hover:bg-berry/90",
				onClick: confirmDeleteBase,
				children: "Xóa cốt trà"
			})] })] })
		})
	] });
}
function ProductForm({ categories, bases, onSaved, product, onClearEdit }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [price, setPrice] = (0, import_react.useState)("49000");
	const [categoryId, setCategoryId] = (0, import_react.useState)("");
	const [baseTea, setBaseTea] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [image, setImage] = (0, import_react.useState)(null);
	const [saving, setSaving] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!open || !product) return;
		setName(product.name);
		setPrice(String(product.price));
		setCategoryId(String(product.category_id));
		setBaseTea(product.base_tea);
		setDescription(product.description || "");
		setImage(product.image_url);
	}, [open, product]);
	(0, import_react.useEffect)(() => {
		if (!product) {
			setName("");
			setPrice("49000");
			setCategoryId(String(categories[0]?.id ?? ""));
			setBaseTea("");
			setDescription("");
			setImage(null);
		}
	}, [product, categories]);
	function handleFile(e) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (!file.type.startsWith("image/")) return toast.error("Vui lòng chọn file ảnh");
		if (file.size > 2 * 1024 * 1024) return toast.error("Ảnh tối đa 2MB");
		const reader = new FileReader();
		reader.onload = () => setImage(String(reader.result));
		reader.readAsDataURL(file);
	}
	async function save() {
		if (!name.trim() || !price.trim()) return toast.error("Vui lòng nhập tên và giá");
		const slug = slugify(name.trim());
		setSaving(true);
		try {
			const payload = {
				category_id: Number(categoryId),
				name: name.trim(),
				slug,
				base_tea: baseTea.trim() || "Lục Trà",
				description: description.trim() || null,
				price: Number(price),
				image_url: image,
				calories: 0
			};
			if (product) {
				await apiPut(`/admin/menu/products/${product.id}`, payload);
				toast.success("Đã cập nhật món");
				onClearEdit();
			} else {
				await apiPost("/admin/menu/products", payload);
				toast.success("Đã thêm món mới");
			}
			setOpen(false);
			onSaved();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lưu thất bại");
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open: open || !!product,
		onOpenChange: (o) => {
			setOpen(o);
			if (!o) onClearEdit();
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: !product && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "hero",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm sản phẩm"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-h-[85vh] max-w-lg overflow-y-auto",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: product ? `Sửa món: ${product.name}` : "Thêm sản phẩm mới" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Ảnh sản phẩm" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1.5 flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bg-muted flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border",
							children: image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: image,
								alt: "Ảnh sản phẩm",
								className: "h-full w-full object-cover"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, { className: "text-muted-foreground size-8" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "bg-berry text-berry-foreground hover:bg-berry/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }),
											" ",
											image ? "Đổi ảnh" : "Chọn ảnh"
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "file",
										accept: "image/*",
										className: "hidden",
										onChange: handleFile
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground text-xs",
									children: "Ảnh lưu trực tiếp vào DB, tối đa 2MB"
								}),
								image && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "ghost",
									size: "sm",
									className: "w-fit",
									onClick: () => setImage(null),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "mr-1 size-4" }), " Gỡ ảnh"]
								})
							]
						})]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "p-name",
						children: "Tên sản phẩm"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "p-name",
						value: name,
						onChange: (e) => setName(e.target.value),
						className: "mt-1.5"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "p-price",
							children: "Giá bán (₫)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "p-price",
							type: "number",
							value: price,
							onChange: (e) => setPrice(e.target.value),
							className: "mt-1.5"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Danh mục" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: categoryId,
							onValueChange: setCategoryId,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
								className: "mt-1.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Chọn danh mục" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: categories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: String(c.id),
								children: c.name
							}, c.id)) })]
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "p-base",
						children: "Cốt trà nền"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: baseTea,
						onValueChange: setBaseTea,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							id: "p-base",
							className: "mt-1.5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Chọn cốt trà nền" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: bases.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: b.name,
							children: b.name
						}, b.id)) })]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "p-desc",
						children: "Mô tả"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "p-desc",
						rows: 3,
						value: description,
						onChange: (e) => setDescription(e.target.value),
						className: "mt-1.5"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "hero",
						className: "w-full",
						onClick: save,
						disabled: saving,
						children: saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : product ? "Lưu thay đổi" : "Lưu sản phẩm"
					})
				]
			})]
		})]
	});
}
function CategoryForm({ onSaved, category, onClearEdit }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!category) return;
		setName(category.name);
	}, [category]);
	(0, import_react.useEffect)(() => {
		if (!category) setName("");
	}, [category]);
	async function save() {
		if (!name.trim()) return toast.error("Vui lòng nhập tên danh mục");
		const slug = slugify(name.trim());
		setSaving(true);
		try {
			if (category) {
				await apiPut(`/admin/menu/categories/${category.id}`, {
					name: name.trim(),
					slug,
					sort_order: category.sort_order,
					is_visible: category.is_visible ? 1 : 0
				});
				toast.success("Đã cập nhật danh mục");
				onClearEdit();
			} else {
				await apiPost("/admin/menu/categories", {
					name: name.trim(),
					slug,
					sort_order: 0,
					is_visible: 1
				});
				toast.success("Đã tạo danh mục");
			}
			setOpen(false);
			setName("");
			onSaved();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lưu danh mục thất bại");
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open: open || !!category,
		onOpenChange: (o) => {
			setOpen(o);
			if (!o) onClearEdit();
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: !category && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "soft",
				size: "sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm danh mục"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: category ? `Sửa danh mục: ${category.name}` : "Thêm danh mục mới" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "c-name",
					children: "Tên danh mục"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "c-name",
					value: name,
					onChange: (e) => setName(e.target.value),
					className: "mt-1.5",
					placeholder: "Trà Sen"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "hero",
					className: "w-full",
					onClick: save,
					disabled: saving,
					children: saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : category ? "Lưu thay đổi" : "Lưu danh mục"
				})]
			})]
		})]
	});
}
//#endregion
export { MenuAdminPage as component };
