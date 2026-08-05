import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { b as vnd, d as products, t as Button } from "./data-BKElHwIS.mjs";
import { t as Input } from "./input-DvwfGdEz.mjs";
import { t as Badge } from "./badge-CmDb9cdk.mjs";
import { C as Plus, T as Pencil, W as GripVertical, c as Trash2 } from "../_libs/lucide-react.mjs";
import { l as menuCategories, u as optionGroups } from "./admin-data-D7T31PXz.mjs";
import { n as CardContent, t as Card } from "./card-DaABMcTj.mjs";
import { n as SectionCard, t as AdminPageHeader } from "./AdminUI-DohLx8kD.mjs";
import { t as Label } from "./label-xBCHZgmT.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, o as DialogTrigger, t as Dialog } from "./dialog-Bztdc_I8.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Switch } from "./switch-DyBOu_FE.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-B1T5rWcC.mjs";
import { t as Textarea } from "./textarea-BfM7_jpA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.thuc-don-BkYvnuaM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MenuAdminPage() {
	const [visible, setVisible] = (0, import_react.useState)(Object.fromEntries(products.map((p) => [p.id, true])));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
		title: "Quản lý thực đơn",
		desc: "Danh mục, sản phẩm và nhóm tùy chọn hiển thị trên website khách hàng",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductForm, {})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
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
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
					children: products.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "shadow-soft overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: p.image,
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
										children: ["/", p.id]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: "secondary",
										children: p.line
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
											checked: visible[p.id],
											onCheckedChange: (v) => {
												setVisible((s) => ({
													...s,
													[p.id]: v
												}));
												toast.success(v ? `Đã mở bán ${p.name}` : `Đã tạm ngưng ${p.name}`);
											}
										}), visible[p.id] ? "Đang bán" : "Tạm ngưng"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											size: "icon",
											"aria-label": "Sửa",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											size: "icon",
											"aria-label": "Xóa",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "text-berry size-4" })
										})]
									})]
								})
							]
						})]
					}, p.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "categories",
				className: "mt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
					title: "Danh mục món",
					desc: "Kéo thả để đổi thứ tự hiển thị trên menu khách hàng",
					actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "soft",
						size: "sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm danh mục"]
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-2",
						children: menuCategories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-3 rounded-xl border p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GripVertical, { className: "text-muted-foreground size-4 cursor-grab" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-semibold",
										children: c.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-muted-foreground text-xs",
										children: [c.items, " món"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, { defaultChecked: c.visible }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "icon",
									"aria-label": "Sửa danh mục",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" })
								})
							]
						}, c.id))
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "options",
				className: "mt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: optionGroups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SectionCard, {
						title: g.name,
						desc: `${g.values.length} lựa chọn`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: g.values.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								className: "rounded-full px-3 py-1",
								children: v
							}, v))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							className: "mt-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm giá trị"]
						})]
					}, g.id))
				})
			})
		]
	})] });
}
function ProductForm() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "hero",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm sản phẩm"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: "max-h-[85vh] max-w-lg overflow-y-auto",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Thêm sản phẩm mới" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "p-name",
					children: "Tên sản phẩm"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "p-name",
					placeholder: "Trà Ổi Hồng Đào",
					className: "mt-1.5"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "p-slug",
					children: "SEO Slug (tự sinh)"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "p-slug",
					placeholder: "tra-oi-hong-dao",
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
						placeholder: "49000",
						className: "mt-1.5"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "p-cat",
						children: "Danh mục"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "p-cat",
						placeholder: "Trà Trái Cây Tươi",
						className: "mt-1.5"
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "p-desc",
					children: "Mô tả"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					id: "p-desc",
					rows: 3,
					placeholder: "Mô tả hương vị, nguyên liệu…",
					className: "mt-1.5"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-dashed p-6 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-sm",
						children: "Kéo thả ảnh hoặc bấm để tải lên gallery"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						className: "mt-2",
						children: "Chọn ảnh"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "hero",
					className: "w-full",
					onClick: () => toast.success("Đã lưu sản phẩm (demo)"),
					children: "Lưu sản phẩm"
				})
			]
		})]
	})] });
}
//#endregion
export { MenuAdminPage as component };
