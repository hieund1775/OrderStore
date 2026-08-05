import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { _ as tagLabel, a as cn, b as vnd, g as sugarOptions, m as sizeOptions, n as baseOptions, s as iceOptions, t as Button, y as toppingOptions } from "./data-BKElHwIS.mjs";
import { t as Badge } from "./badge-CmDb9cdk.mjs";
import { C as Plus, U as Heart, ct as Check, f as Star, v as Settings2 } from "../_libs/lucide-react.mjs";
import { n as CheckboxIndicator, t as Checkbox$1 } from "../_libs/@radix-ui/react-checkbox+[...].mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, t as Dialog } from "./dialog-Bztdc_I8.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Textarea } from "./textarea-BfM7_jpA.mjs";
import { n as useCart } from "./cart-BwPSPLo8.mjs";
import { n as RadioGroupItem, t as RadioGroup } from "./radio-group-Bz7B5qc7.mjs";
import { a as Viewport, i as ScrollAreaThumb, n as Root, r as ScrollAreaScrollbar, t as Corner } from "../_libs/radix-ui__react-scroll-area.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ProductCard-D4jBfID0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Checkbox = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox$1, {
	ref,
	className: cn("grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckboxIndicator, {
		className: cn("grid place-content-center text-current"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4" })
	})
}));
Checkbox.displayName = Checkbox$1.displayName;
var ScrollArea = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Root, {
	ref,
	className: cn("relative overflow-hidden", className),
	...props,
	children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Viewport, {
			className: "h-full w-full rounded-[inherit]",
			children
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollBar, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Corner, {})
	]
}));
ScrollArea.displayName = Root.displayName;
var ScrollBar = import_react.forwardRef(({ className, orientation = "vertical", ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollAreaScrollbar, {
	ref,
	orientation,
	className: cn("flex touch-none select-none transition-colors", orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]", orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollAreaThumb, { className: "relative flex-1 rounded-full bg-border" })
}));
ScrollBar.displayName = ScrollAreaScrollbar.displayName;
function ProductCard({ product }) {
	const { addItem, wishlist, toggleWishlist } = useCart();
	const [open, setOpen] = (0, import_react.useState)(false);
	const liked = wishlist.includes(product.id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "group bg-card flex flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-card-soft",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative aspect-square overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: product.image,
					alt: product.name,
					loading: "lazy",
					width: 640,
					height: 640,
					className: "size-full object-cover transition-transform duration-500 group-hover:scale-105"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute top-2.5 left-2.5 flex flex-col items-start gap-1",
					children: product.tags.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						className: "bg-card text-foreground rounded-full text-[10px] shadow-sm",
						children: tagLabel[t]
					}, t))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => toggleWishlist(product.id),
					"aria-label": "Yêu thích",
					className: "bg-card/90 absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full shadow-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: `size-4 ${liked ? "fill-berry text-berry" : "text-muted-foreground"}` })
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-1 flex-col gap-1.5 p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-display line-clamp-1 text-base font-bold",
					children: product.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground text-xs",
					children: product.base
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-muted-foreground flex items-center gap-1 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "fill-primary text-primary size-3.5" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-foreground font-semibold",
							children: product.rating
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							"· ",
							product.reviews.toLocaleString("vi-VN"),
							" đánh giá"
						] })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-primary mt-1 text-lg font-bold",
					children: vnd(product.price)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "soft",
						size: "sm",
						className: "flex-1",
						onClick: () => {
							addItem({
								productId: product.id,
								name: product.name,
								image: product.image,
								size: "M",
								base: product.base,
								sugar: "100%",
								ice: "100%",
								toppings: [],
								unitPrice: product.price,
								qty: 1
							});
							toast.success("Đã thêm vào giỏ", { description: product.name });
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Thêm nhanh"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "hero",
						size: "sm",
						className: "flex-1",
						onClick: () => setOpen(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, { className: "size-4" }), " Tùy chọn"]
					})]
				})
			]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomizeDialog, {
		product,
		open,
		onOpenChange: setOpen
	})] });
}
function CustomizeDialog({ product, open, onOpenChange }) {
	const { addItem } = useCart();
	const [size, setSize] = (0, import_react.useState)("M");
	const [base, setBase] = (0, import_react.useState)(baseOptions[0]);
	const [sugar, setSugar] = (0, import_react.useState)(sugarOptions[4]);
	const [ice, setIce] = (0, import_react.useState)(iceOptions[4]);
	const [toppings, setToppings] = (0, import_react.useState)([]);
	const [note, setNote] = (0, import_react.useState)("");
	const [qty, setQty] = (0, import_react.useState)(1);
	const unitPrice = (0, import_react.useMemo)(() => {
		const sizeExtra = sizeOptions.find((s) => s.id === size)?.extra ?? 0;
		const topExtra = toppingOptions.filter((t) => toppings.includes(t.id)).reduce((s, t) => s + t.price, 0);
		return product.price + sizeExtra + topExtra;
	}, [
		size,
		toppings,
		product.price
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-3xl",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, {
				className: "sr-only",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: product.name })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid md:grid-cols-[minmax(0,320px)_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-accent/50 relative hidden md:block",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: product.image,
						alt: product.name,
						loading: "lazy",
						className: "size-full object-cover"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex max-h-[92vh] flex-col",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollArea, {
						className: "flex-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-5 p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-display text-xl font-bold",
										children: product.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground text-sm",
										children: product.base
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm leading-relaxed",
										children: product.desc
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-muted-foreground mt-2 text-xs",
										children: [
											"≈ ",
											product.calories,
											" kcal / ly size M"
										]
									})
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionBlock, {
									title: "Chọn size",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, {
										value: size,
										onValueChange: setSize,
										className: "grid grid-cols-2 gap-2",
										children: sizeOptions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionRow, {
											value: s.id,
											id: `size-${s.id}`,
											label: s.label,
											children: s.extra > 0 ? `+${vnd(s.extra)}` : "Giá gốc"
										}, s.id))
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionBlock, {
									title: "Cốt trà nền",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, {
										value: base,
										onValueChange: setBase,
										className: "grid gap-2 sm:grid-cols-3",
										children: baseOptions.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionRow, {
											value: b,
											id: `base-${b}`,
											label: b
										}, b))
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionBlock, {
									title: "Mức ngọt",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, {
										value: sugar,
										onValueChange: setSugar,
										className: "grid gap-2 sm:grid-cols-2",
										children: sugarOptions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionRow, {
											value: s,
											id: `sugar-${s}`,
											label: s
										}, s))
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionBlock, {
									title: "Mức đá",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, {
										value: ice,
										onValueChange: setIce,
										className: "grid gap-2 sm:grid-cols-2",
										children: iceOptions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionRow, {
											value: s,
											id: `ice-${s}`,
											label: s
										}, s))
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionBlock, {
									title: "Topping trái cây & thạch",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid gap-2 sm:grid-cols-2",
										children: toppingOptions.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											htmlFor: `top-${t.id}`,
											className: "hover:border-primary flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox, {
													id: `top-${t.id}`,
													checked: toppings.includes(t.id),
													onCheckedChange: (c) => setToppings((prev) => c ? [...prev, t.id] : prev.filter((x) => x !== t.id))
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "flex-1",
													children: t.label
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-muted-foreground text-xs",
													children: ["+", vnd(t.price)]
												})
											]
										}, t.id))
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionBlock, {
									title: "Ghi chú cho barista",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
										value: note,
										onChange: (e) => setNote(e.target.value),
										placeholder: "VD: Cho nhiều đá hơn một chút, nhiều tép cam…",
										rows: 2
									})
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 border-t p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1 rounded-full border px-2 py-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "px-2",
									onClick: () => setQty((q) => Math.max(1, q - 1)),
									children: "−"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "w-6 text-center text-sm font-bold",
									children: qty
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "px-2",
									onClick: () => setQty((q) => q + 1),
									children: "+"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "hero",
							className: "flex-1",
							onClick: () => {
								addItem({
									productId: product.id,
									name: product.name,
									image: product.image,
									size,
									base,
									sugar,
									ice,
									toppings: toppingOptions.filter((t) => toppings.includes(t.id)).map((t) => t.label),
									note,
									unitPrice,
									qty
								});
								toast.success("Đã thêm vào giỏ", { description: `${product.name} · ${size}` });
								onOpenChange(false);
							},
							children: ["Thêm vào giỏ · ", vnd(unitPrice * qty)]
						})]
					})]
				})]
			})]
		})
	});
}
function OptionBlock({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
			className: "text-sm font-bold",
			children: title
		}), children]
	});
}
function OptionRow({ value, id, label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		htmlFor: id,
		className: "hover:border-primary flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroupItem, {
				value,
				id
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex-1",
				children: label
			}),
			children && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground text-xs",
				children
			})
		]
	});
}
//#endregion
export { ProductCard as t };
