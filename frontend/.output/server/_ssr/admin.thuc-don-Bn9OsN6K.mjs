import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { C as Plus, R as LoaderCircle, T as Pencil } from "../_libs/lucide-react.mjs";
import { _ as vnd } from "./data-Z_klJ5jj.mjs";
import { a as apiPut, i as apiPost, n as apiGet } from "./api-CyIKtyVS.mjs";
import { n as CardContent, t as Card } from "./card-N78Fb1PV.mjs";
import { n as SectionCard, t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, o as DialogTrigger, t as Dialog } from "./dialog-Di5jevJl.mjs";
import { t as Switch } from "./switch-BCfmMxEa.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-BtxHXOBC.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DXom7Yjz.mjs";
import { t as Textarea } from "./textarea-DS1fyxUj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.thuc-don-Bn9OsN6K.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MenuAdminPage() {
	const [categories, setCategories] = (0, import_react.useState)([]);
	const [products, setProducts] = (0, import_react.useState)([]);
	const [options, setOptions] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [editProduct, setEditProduct] = (0, import_react.useState)(null);
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
	async function toggleCategory(c) {
		try {
			await apiPut(`/admin/menu/categories/${c.id}`, {
				name: c.name,
				slug: c.slug,
				sort_order: c.sort_order,
				is_visible: c.is_visible ? 0 : 1
			});
			toast.success(c.is_visible ? "Đã ẩn danh mục" : "Đã hiện danh mục");
			setCategories((prev) => prev.map((x) => x.id === c.id ? {
				...x,
				is_visible: !x.is_visible
			} : x));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
		title: "Quản lý thực đơn",
		desc: "Danh mục, sản phẩm và nhóm tùy chọn hiển thị trên website khách hàng",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductForm, {
			categories,
			onSaved: () => setReloadKey((k) => k + 1),
			product: editProduct,
			onClearEdit: () => setEditProduct(null)
		})
	}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex items-center justify-center py-20 text-muted-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
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
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex gap-1",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											size: "icon",
											"aria-label": "Sửa",
											onClick: () => setEditProduct(p),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" })
										})
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
					desc: "Bật/tắt hiển thị trên menu khách hàng",
					actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategoryForm, { onSaved: () => setReloadKey((k) => k + 1) }),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-2",
						children: categories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-3 rounded-xl border p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-semibold",
									children: c.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-muted-foreground text-xs",
									children: [
										"/",
										c.slug,
										" · ",
										c.items,
										" món"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: c.is_visible,
								onCheckedChange: () => toggleCategory(c)
							})]
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
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-2",
								children: options.bases.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: "secondary",
									className: "rounded-full px-3 py-1",
									children: b.name
								}, b.id))
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
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-2",
								children: options.toppings.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
									variant: t.is_available ? "secondary" : "outline",
									className: "rounded-full px-3 py-1",
									children: [
										t.name,
										" (+",
										vnd(t.price),
										")",
										!t.is_available ? " · hết" : ""
									]
								}, t.id))
							})
						})
					]
				})
			})
		]
	})] });
}
function ProductForm({ categories, onSaved, product, onClearEdit }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [slug, setSlug] = (0, import_react.useState)("");
	const [price, setPrice] = (0, import_react.useState)("49000");
	const [categoryId, setCategoryId] = (0, import_react.useState)("");
	const [baseTea, setBaseTea] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!open || !product) return;
		setName(product.name);
		setSlug(product.slug);
		setPrice(String(product.price));
		setCategoryId(String(product.category_id));
		setBaseTea(product.base_tea);
		setDescription(product.description || "");
	}, [open, product]);
	(0, import_react.useEffect)(() => {
		if (!product) {
			setName("");
			setSlug("");
			setPrice("49000");
			setCategoryId(String(categories[0]?.id ?? ""));
			setBaseTea("");
			setDescription("");
		}
	}, [product, categories]);
	async function save() {
		if (!name.trim() || !slug.trim() || !price.trim()) return toast.error("Vui lòng nhập tên, slug và giá");
		setSaving(true);
		try {
			const payload = {
				category_id: Number(categoryId),
				name: name.trim(),
				slug: slug.trim(),
				base_tea: baseTea.trim() || "Lục Trà",
				description: description.trim() || null,
				price: Number(price),
				image_url: null,
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "p-name",
						children: "Tên sản phẩm"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "p-name",
						value: name,
						onChange: (e) => setName(e.target.value),
						className: "mt-1.5"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "p-slug",
						children: "SEO Slug"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "p-slug",
						value: slug,
						onChange: (e) => setSlug(e.target.value),
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
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "p-base",
						value: baseTea,
						onChange: (e) => setBaseTea(e.target.value),
						className: "mt-1.5"
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
function CategoryForm({ onSaved }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [slug, setSlug] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	async function save() {
		if (!name.trim() || !slug.trim()) return toast.error("Vui lòng nhập tên và slug");
		setSaving(true);
		try {
			await apiPost("/admin/menu/categories", {
				name: name.trim(),
				slug: slug.trim(),
				sort_order: 0,
				is_visible: 1
			});
			toast.success("Đã tạo danh mục");
			setOpen(false);
			setName("");
			setSlug("");
			onSaved();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Tạo danh mục thất bại");
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open,
		onOpenChange: setOpen,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "soft",
				size: "sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm danh mục"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Thêm danh mục mới" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "c-name",
						children: "Tên danh mục"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "c-name",
						value: name,
						onChange: (e) => setName(e.target.value),
						className: "mt-1.5"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "c-slug",
						children: "Slug"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "c-slug",
						value: slug,
						onChange: (e) => setSlug(e.target.value),
						placeholder: "tra-trai-cay-moi",
						className: "mt-1.5"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "hero",
						className: "w-full",
						onClick: save,
						disabled: saving,
						children: saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : "Lưu danh mục"
					})
				]
			})]
		})]
	});
}
//#endregion
export { MenuAdminPage as component };
