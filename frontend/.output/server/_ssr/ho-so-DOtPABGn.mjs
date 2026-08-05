import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { r as cn, t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { U as Heart, b as RotateCcw, f as Star, x as QrCode } from "../_libs/lucide-react.mjs";
import { _ as vnd, c as products, o as notifications, s as orderHistory } from "./data-Z_klJ5jj.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-BtxHXOBC.mjs";
import { n as useCart } from "./cart-BwPSPLo8.mjs";
import { t as Textarea } from "./textarea-DS1fyxUj.mjs";
import { t as PageHeader } from "./PageHeader-4GMedA0k.mjs";
import { n as Root, t as Indicator } from "../_libs/radix-ui__react-progress.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ho-so-DOtPABGn.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Progress = import_react.forwardRef(({ className, value, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
	ref,
	className: cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Indicator, {
		className: "h-full w-full flex-1 bg-primary transition-all",
		style: { transform: `translateX(-${100 - (value || 0)}%)` }
	})
}));
Progress.displayName = Root.displayName;
function Profile() {
	const { wishlist, toggleWishlist } = useCart();
	const saved = products.filter((p) => wishlist.includes(p.id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Tài khoản",
		title: "Hồ sơ cá nhân",
		desc: "Minh Trang · Hội viên hạng Vàng"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "container-page grid gap-6 py-10 lg:grid-cols-[340px_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "space-y-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "gradient-warm text-primary-foreground rounded-2xl p-5 shadow-glow",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-widest uppercase opacity-80",
						children: "Thẻ hội viên điện tử"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display mt-1 text-2xl font-extrabold",
						children: "Minh Trang"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm opacity-90",
						children: "Hạng Vàng · 1.820 điểm"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-1 flex justify-between text-xs opacity-90",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Còn 1.180 điểm lên Kim Cương" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "61%" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Progress, {
							value: 61,
							className: "h-2"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card mt-5 flex items-center gap-3 rounded-xl p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "text-foreground size-14" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold",
								children: "Mã QR tích điểm"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground text-xs",
								children: "Đưa mã này cho thu ngân tại quầy"
							})]
						})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card rounded-2xl border p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-sm font-semibold",
					children: "Thông báo"
				}), notifications.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-b py-2 last:border-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: n.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-xs",
						children: n.time
					})]
				}, n.id))]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
			defaultValue: "orders",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
					className: "mb-4 flex-wrap",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
							value: "orders",
							children: "Lịch sử đơn hàng"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
							value: "wishlist",
							children: "Yêu thích"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
							value: "review",
							children: "Đánh giá"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
							value: "info",
							children: "Thông tin"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "orders",
					className: "space-y-4",
					children: orderHistory.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "bg-card rounded-2xl border p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-display font-bold",
										children: o.id
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										className: `rounded-full ${o.status === "Hoàn tất" ? "bg-leaf text-leaf-foreground" : "bg-muted text-muted-foreground"}`,
										children: o.status
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground text-xs",
										children: o.date
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-primary ml-auto font-bold",
										children: vnd(o.total)
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "text-muted-foreground mt-3 space-y-1 text-sm",
								children: o.items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["• ", i] }, i))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "hero",
									size: "sm",
									onClick: () => toast.success("Đã thêm toàn bộ món vào giỏ", { description: o.id }),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" }), " Đặt lại đơn này"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									variant: "outline",
									size: "sm",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/theo-doi-don",
										children: "Xem chi tiết"
									})
								})]
							})
						]
					}, o.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "wishlist",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 sm:grid-cols-2",
						children: [saved.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-sm",
							children: "Chưa có món yêu thích nào."
						}), saved.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card flex items-center gap-3 rounded-2xl border p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: p.image,
									alt: p.name,
									loading: "lazy",
									className: "size-16 rounded-xl object-cover"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-semibold",
											children: p.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted-foreground text-xs",
											children: p.base
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-primary font-bold",
											children: vnd(p.price)
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => toggleWishlist(p.id),
									"aria-label": "Bỏ yêu thích",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "fill-berry text-berry size-5" })
								})
							]
						}, p.id))]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "review",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card space-y-4 rounded-2xl border p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-lg font-bold",
								children: "Đánh giá đơn VX240712"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex gap-1",
								children: [
									1,
									2,
									3,
									4,
									5
								].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "fill-primary text-primary size-6" }, i))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								rows: 3,
								placeholder: "Chia sẻ cảm nhận của bạn về ly trà…"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "hover:border-primary text-muted-foreground flex cursor-pointer items-center justify-center rounded-xl border border-dashed p-4 text-sm",
								children: "Tải ảnh ly trà thực tế"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "hero",
								onClick: () => toast.success("Cảm ơn bạn đã đánh giá!"),
								children: "Gửi đánh giá"
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "info",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "p-name",
									children: "Họ tên"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "p-name",
									defaultValue: "Nguyễn Minh Trang"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "p-phone",
									children: "Số điện thoại"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "p-phone",
									defaultValue: "0901 234 567"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5 sm:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "p-email",
									children: "Email"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "p-email",
									defaultValue: "minhtrang@email.com"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5 sm:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Địa chỉ đã lưu" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-muted-foreground space-y-2 text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "rounded-xl border p-3",
										children: "🏠 Nhà · 125 Nguyễn Huệ, Quận 1"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "rounded-xl border p-3",
										children: "🏢 Công ty · 88 Võ Văn Tần, Quận 3"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "hero",
								className: "sm:col-span-2",
								onClick: () => toast.success("Đã lưu thay đổi"),
								children: "Lưu thay đổi"
							})
						]
					})
				})
			]
		})]
	})] });
}
//#endregion
export { Profile as component };
