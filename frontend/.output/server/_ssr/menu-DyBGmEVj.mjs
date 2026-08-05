import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { P as MapPin, ct as ChevronRight, m as SlidersHorizontal } from "../_libs/lucide-react.mjs";
import { _ as vnd, c as products, h as teaLines, r as fruitGroups } from "./data-Z_klJ5jj.mjs";
import { g as Link, v as useSearch } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as apiGet } from "./api-Cnar3gwH.mjs";
import { n as useCart } from "./cart-BwPSPLo8.mjs";
import { t as PageHeader } from "./PageHeader-4GMedA0k.mjs";
import { t as ProductCard } from "./ProductCard-DebwLGTj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/menu-DyBGmEVj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MenuPage() {
	const [line, setLine] = (0, import_react.useState)("Tất cả");
	const [fruit, setFruit] = (0, import_react.useState)("Tất cả");
	const { items, subtotal, count } = useCart();
	const { table_id } = useSearch({ from: "/menu" });
	const [tableInfo, setTableInfo] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (table_id) sessionStorage.setItem("teaplus_table_id", table_id);
	}, [table_id]);
	(0, import_react.useEffect)(() => {
		if (!table_id) {
			setTableInfo(null);
			return;
		}
		let cancelled = false;
		apiGet(`/api/table/resolve?table_id=${encodeURIComponent(table_id)}`).then((res) => {
			if (!cancelled) setTableInfo(res);
		}).catch(() => {
			if (!cancelled) setTableInfo(null);
		});
		return () => {
			cancelled = true;
		};
	}, [table_id]);
	const filtered = (0, import_react.useMemo)(() => products.filter((p) => (line === "Tất cả" || p.line === line) && (fruit === "Tất cả" || p.fruit === fruit)), [line, fruit]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Menu",
			title: "Thực đơn trà trái cây tươi",
			desc: "Chọn dòng trà yêu thích, tùy chỉnh mức đường – đá – topping theo đúng khẩu vị của bạn."
		}),
		tableInfo && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "container-page mt-6",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "gradient-warm text-primary-foreground flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 px-5 py-4 shadow-glow",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "bg-white/20 flex size-11 shrink-0 items-center justify-center rounded-xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-6" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-base font-bold",
						children: ["Bạn đang ngồi tại: ", tableInfo.table.name]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm opacity-90",
						children: [
							tableInfo.table.store_name,
							" · ",
							tableInfo.table.store_address
						]
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: "secondary",
					className: "bg-white/95",
					children: "Đặt món tại bàn"
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card top-32 z-20 mb-6 space-y-3 rounded-2xl border p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-muted-foreground flex items-center gap-2 text-xs font-bold tracking-wide uppercase",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-3.5" }), " Dòng trà"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: ["Tất cả", ...teaLines].map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
								active: line === l,
								onClick: () => setLine(l),
								label: l
							}, l))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-muted-foreground flex items-center gap-2 pt-1 text-xs font-bold tracking-wide uppercase",
							children: "Vị trái cây"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: ["Tất cả", ...fruitGroups].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
								active: fruit === f,
								onClick: () => setFruit(f),
								label: f
							}, f))
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-muted-foreground mb-4 text-sm",
					children: [filtered.length, " món phù hợp"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-2 gap-4 md:grid-cols-3",
					children: filtered.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductCard, { product: p }, p.id))
				}),
				filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground py-16 text-center text-sm",
					children: "Chưa có món nào khớp bộ lọc. Thử bỏ bớt một tiêu chí nhé."
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				className: "hidden lg:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card sticky top-32 rounded-2xl border p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-lg font-bold",
							children: "Giỏ hàng của bạn"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground text-xs",
							children: [count, " món đã chọn"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 max-h-80 space-y-3 overflow-y-auto",
							children: [items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground text-sm",
								children: "Chọn món để bắt đầu đơn hàng."
							}), items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-3 border-b pb-3 last:border-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: i.image,
										alt: i.name,
										loading: "lazy",
										className: "size-12 rounded-lg object-cover"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "truncate text-sm font-semibold",
											children: [
												i.qty,
												"× ",
												i.name
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-muted-foreground truncate text-xs",
											children: [
												i.size,
												" · ",
												i.sugar,
												" đường · ",
												i.ice,
												" đá",
												i.toppings.length ? ` · ${i.toppings.join(", ")}` : ""
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm font-bold",
										children: vnd(i.unitPrice * i.qty)
									})
								]
							}, i.key))]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex items-center justify-between border-t pt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground text-sm",
								children: "Tạm tính"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-primary text-lg font-extrabold",
								children: vnd(subtotal)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							variant: "hero",
							className: "mt-4 w-full",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/thanh-toan",
								children: ["Thanh toán ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
							})
						})
					]
				})
			})]
		})
	] });
}
function FilterChip({ label, active, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		onClick,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
			variant: active ? "default" : "secondary",
			className: `cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ${active ? "" : "hover:bg-accent"}`,
			children: label
		})
	});
}
//#endregion
export { MenuPage as component };
