import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { F as Mail, M as Menu, P as MapPin, W as Heart, Y as Facebook, _t as ArrowUp, c as Trash2, ct as ChevronRight, h as ShoppingBag, ht as Bell, i as User, j as MessageCircle, w as Phone, x as QrCode, y as Search } from "../_libs/lucide-react.mjs";
import { a as DropdownMenuSeparator, c as PopoverContent, d as SheetContent, f as SheetHeader, i as DropdownMenuLabel, l as PopoverTrigger, m as SheetTrigger, n as DropdownMenuContent, o as DropdownMenuTrigger, p as SheetTitle, r as DropdownMenuItem, s as Popover, t as DropdownMenu, u as Sheet } from "./dropdown-menu-CTFAty1b.mjs";
import { _ as vnd, c as products, f as stores, n as brand, o as notifications, u as searchSuggestions } from "./data-Z_klJ5jj.mjs";
import { c as HeadContent, d as createRouter, f as Outlet, g as Link, h as createRootRouteWithContext, j as redirect, l as useRouterState, m as createFileRoute, p as lazyRouteComponent, s as Scripts, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as getToken } from "./api-Cnar3gwH.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, o as DialogTrigger, t as Dialog } from "./dialog-Di5jevJl.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DXom7Yjz.mjs";
import { n as useCart, t as CartProvider } from "./cart-BwPSPLo8.mjs";
import { t as Separator } from "./separator-B_-_Z5Eo.mjs";
import { t as Route$20 } from "./theo-doi-don-DjCbFQlj.mjs";
import { t as Route$21 } from "./admin.vi-tri-OANAIol3.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-2bIFOxJd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-CNFvzRbY.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
	const message = error instanceof Response ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}` : error instanceof Error ? error.message : String(error);
	window.__lovableReportRuntimeError?.({
		message,
		stack: error instanceof Error ? error.stack : void 0,
		filename: window.location.pathname
	});
}
var navItems = [
	{
		to: "/",
		label: "Trang chủ"
	},
	{
		to: "/gioi-thieu",
		label: "Giới thiệu"
	},
	{
		to: "/menu",
		label: "Menu"
	},
	{
		to: "/cua-hang",
		label: "Cửa hàng"
	},
	{
		to: "/tuyen-dung",
		label: "Tuyển dụng"
	}
];
function Logo() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/",
		className: "flex shrink-0 items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "gradient-warm flex size-9 items-center justify-center rounded-full text-lg shadow-glow",
			children: "🍹"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "font-display text-lg leading-tight font-bold sm:text-xl",
			children: ["Trà Trái Cây ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-primary",
				children: "Tô"
			})]
		})]
	});
}
function SearchBar({ className }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
			open,
			onOpenChange: setOpen,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						onFocus: () => setOpen(true),
						placeholder: "Tìm món, trà nền, trái cây hoặc topping…",
						className: "bg-secondary/60 h-10 rounded-full border-transparent pl-9"
					})]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
				align: "start",
				className: "w-[--radix-popover-trigger-width] min-w-72 p-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase",
						children: "Từ khóa hot"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1.5 px-2 pb-2",
						children: searchSuggestions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "secondary",
							className: "cursor-pointer rounded-full font-normal",
							children: s
						}, s))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase",
						children: "Bán chạy"
					}),
					products.slice(0, 3).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/menu",
						onClick: () => setOpen(false),
						className: "hover:bg-accent flex items-center gap-3 rounded-lg p-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: p.image,
								alt: p.name,
								loading: "lazy",
								className: "size-9 rounded-md object-cover"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex-1 text-sm",
								children: p.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-primary text-sm font-semibold",
								children: vnd(p.price)
							})
						]
					}, p.id))
				]
			})]
		})
	});
}
function BranchSelector() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
		defaultValue: stores[0].id,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectTrigger, {
			className: "h-9 w-full max-w-56 rounded-full border-dashed text-xs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "text-primary size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Chọn chi nhánh" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: stores.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
			value: s.id,
			children: s.name
		}, s.id)) })]
	});
}
function QuickCart() {
	const { items, count, subtotal, setQty, removeItem } = useCart();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			size: "icon",
			className: "relative rounded-full",
			"aria-label": "Giỏ hàng",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShoppingBag, { className: "size-5" }), count > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
				children: count
			})]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
		className: "flex w-full flex-col gap-0 sm:max-w-md",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetTitle, {
				className: "font-display",
				children: [
					"Giỏ hàng (",
					count,
					" món)"
				]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 space-y-3 overflow-y-auto px-4",
				children: [items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground py-12 text-center text-sm",
					children: "Giỏ hàng đang trống. Ghé Menu chọn ly trà bạn thích nhé!"
				}), items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card flex gap-3 rounded-xl border p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: i.image,
						alt: i.name,
						loading: "lazy",
						className: "size-16 rounded-lg object-cover"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-semibold",
								children: i.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground text-xs",
								children: [
									i.size,
									" · ",
									i.sugar,
									" đường · ",
									i.ice,
									" đá"
								]
							}),
							i.toppings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground truncate text-xs",
								children: ["+ ", i.toppings.join(", ")]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1 rounded-full border px-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												className: "px-1.5 text-sm",
												onClick: () => setQty(i.key, i.qty - 1),
												children: "−"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "w-5 text-center text-xs font-semibold",
												children: i.qty
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												className: "px-1.5 text-sm",
												onClick: () => setQty(i.key, i.qty + 1),
												children: "+"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-primary ml-auto text-sm font-bold",
										children: vnd(i.unitPrice * i.qty)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => removeItem(i.key),
										"aria-label": "Xóa món",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "text-muted-foreground size-4" })
									})
								]
							})
						]
					})]
				}, i.key))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 border-t p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Tạm tính"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-bold",
						children: vnd(subtotal)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "hero",
					className: "w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/thanh-toan",
						children: ["Thanh toán ngay ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
					})
				})]
			})
		]
	})] });
}
function WishlistButton() {
	const { wishlist } = useCart();
	const saved = products.filter((p) => wishlist.includes(p.id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "ghost",
			size: "icon",
			className: "hidden rounded-full sm:inline-flex",
			"aria-label": "Yêu thích",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-5" })
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
		className: "w-full sm:max-w-md",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
			className: "font-display",
			children: "Món yêu thích"
		}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3 px-4",
			children: [saved.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground text-sm",
				children: "Chưa có món nào được thả tim."
			}), saved.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 rounded-xl border p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: p.image,
						alt: p.name,
						loading: "lazy",
						className: "size-14 rounded-lg object-cover"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-semibold",
							children: p.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-primary text-sm",
							children: vnd(p.price)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "fill-berry text-berry size-4" })
				]
			}, p.id))]
		})]
	})] });
}
function NotificationButton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			size: "icon",
			className: "relative hidden rounded-full sm:inline-flex",
			"aria-label": "Thông báo",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-berry absolute top-1.5 right-2 size-2 rounded-full" })]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
		align: "end",
		className: "w-80 p-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-2 py-1 text-sm font-semibold",
			children: "Thông báo"
		}), notifications.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "hover:bg-accent rounded-lg px-2 py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm",
				children: n.title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground text-xs",
				children: n.time
			})]
		}, n.id))]
	})] });
}
function ProfileButton() {
	const [loggedIn, setLoggedIn] = (0, import_react.useState)(false);
	if (!loggedIn) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "ghost",
			size: "icon",
			className: "rounded-full",
			"aria-label": "Tài khoản",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-5" })
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: "sm:max-w-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
			className: "font-display text-center",
			children: "Đăng nhập / Đăng ký"
		}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					placeholder: "Số điện thoại",
					inputMode: "tel"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "hero",
					className: "w-full",
					onClick: () => setLoggedIn(true),
					children: "Nhận mã OTP"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-muted-foreground flex items-center gap-3 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, { className: "flex-1" }),
						" hoặc ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, { className: "flex-1" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					className: "w-full",
					onClick: () => setLoggedIn(true),
					children: "Tiếp tục với Google"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground text-center text-xs",
					children: "Tích điểm tự động cho mọi đơn hàng khi đăng nhập."
				})
			]
		})]
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "ghost",
			size: "icon",
			className: "rounded-full",
			"aria-label": "Tài khoản",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "gradient-warm text-primary-foreground flex size-7 items-center justify-center rounded-full text-xs font-bold",
				children: "MT"
			})
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
		align: "end",
		className: "w-52",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, { children: "Minh Trang · Hạng Vàng" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/ho-so",
					children: "Hồ sơ cá nhân"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/ho-so",
					children: "QR tích điểm"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/theo-doi-don",
					children: "Theo dõi đơn hàng"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
				onClick: () => setLoggedIn(false),
				children: "Đăng xuất"
			})
		]
	})] });
}
function Header() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "bg-background/85 sticky top-0 z-50 border-b backdrop-blur-md",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-primary text-primary-foreground py-1.5 text-center text-xs",
				children: ["🍓 Freeship 0đ cho đơn từ 99.000₫ · Hotline ", brand.hotline]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "container-page flex h-16 items-center gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTrigger, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							className: "rounded-full lg:hidden",
							"aria-label": "Menu",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
						side: "left",
						className: "w-72",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Logo, {}) }) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
								className: "flex flex-col px-4",
								children: [navItems.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: n.to,
									className: "hover:text-primary border-b py-3 text-sm font-medium",
									activeProps: { className: "text-primary" },
									children: n.label
								}, n.to)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/ho-so",
									className: "hover:text-primary border-b py-3 text-sm font-medium",
									children: "Hồ sơ cá nhân"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "px-4",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BranchSelector, {})
							})
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Logo, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "ml-4 hidden items-center gap-1 lg:flex",
						children: navItems.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: n.to,
							className: "hover:bg-accent rounded-full px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors",
							activeProps: { className: "bg-accent text-accent-foreground" },
							activeOptions: { exact: n.to === "/" },
							children: n.label
						}, n.to))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchBar, { className: "hidden w-64 xl:block" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "hidden md:block",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BranchSelector, {})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NotificationButton, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WishlistButton, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuickCart, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileButton, {})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "container-page pb-3 xl:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchBar, {})
			})
		]
	});
}
function Footer() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
		className: "bg-secondary/60 mt-20 border-t",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-xl font-bold",
						children: ["Tiệm Trà ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-primary",
							children: "Trái Cây Tô"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground mt-3 text-sm leading-relaxed",
						children: "Trà ủ mới mỗi ngày từ vùng nguyên liệu Thái Nguyên & Bảo Lộc, kết hợp 100% trái cây tươi nhập trong ngày."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground mt-3 text-xs",
						children: "GPKD số 0312xxxxxx – Sở KHĐT TP.HCM"
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-sm font-semibold",
					children: "Khám phá"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "text-muted-foreground space-y-2 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/menu",
							className: "hover:text-primary",
							children: "Thực đơn"
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/cua-hang",
							className: "hover:text-primary",
							children: "Hệ thống cửa hàng"
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/tuyen-dung",
							className: "hover:text-primary",
							children: "Tuyển dụng"
						}) })
					]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-sm font-semibold",
					children: "Chính sách"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "text-muted-foreground space-y-2 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Chính sách bảo mật" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Điều khoản dịch vụ" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Chính sách giao hàng" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Chính sách đổi trả" })
					]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-sm font-semibold",
						children: "Liên hệ & Kết nối"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "text-muted-foreground space-y-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "text-primary size-4" }),
									" Hotline ",
									brand.hotline
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "text-primary size-4" }),
									" ",
									brand.email
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Facebook, { className: "text-primary size-4" }), " Fanpage Trà Trái Cây Tô"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "text-primary size-4" }), " Zalo OA"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card mt-4 flex items-center gap-3 rounded-xl border p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-10" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground text-xs",
							children: [
								"Quét mã tải Zalo Mini App",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								"& nhận 50 điểm chào mừng"
							]
						})]
					})
				] })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-t py-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground container-page text-center text-xs",
				children: [
					"© 2026 ",
					brand.name,
					". ",
					brand.tagline,
					"."
				]
			})
		})]
	});
}
function FloatingWidgets() {
	const [show, setShow] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const onScroll = () => setShow(window.scrollY > 400);
		window.addEventListener("scroll", onScroll);
		return () => window.removeEventListener("scroll", onScroll);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed right-4 bottom-24 z-40 flex flex-col gap-2 md:bottom-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "tel:19008386",
				"aria-label": "Gọi hotline",
				className: "bg-leaf text-leaf-foreground flex size-11 items-center justify-center rounded-full shadow-glow transition-transform hover:scale-105",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "size-5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				"aria-label": "Chat với chúng tôi",
				className: "bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-full shadow-glow transition-transform hover:scale-105",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "size-5" })
			}),
			show && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				"aria-label": "Lên đầu trang",
				onClick: () => window.scrollTo({
					top: 0,
					behavior: "smooth"
				}),
				className: "bg-card text-foreground flex size-11 items-center justify-center rounded-full border shadow-card-soft",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-5" })
			})
		]
	});
}
function MobileCartBar() {
	const { count, subtotal } = useCart();
	if (count === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "bg-card/95 fixed inset-x-0 bottom-0 z-50 border-t p-3 backdrop-blur md:hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShoppingBag, { className: "text-primary size-6" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
						children: count
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-xs",
						children: "Tạm tính"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-bold",
						children: vnd(subtotal)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "hero",
					size: "sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/thanh-toan",
						children: "Thanh toán"
					})
				})
			]
		})
	});
}
var Toaster$1 = ({ ...props }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Page not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The page you're looking for doesn't exist or has been moved."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Go home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong on our end. You can try refreshing or head back home."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$19 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{
				name: "author",
				content: "Trà Trái Cây Tô"
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@300;400;500;600;700&display=swap"
			},
			{
				rel: "icon",
				href: "/favicon.ico",
				type: "image/x-icon"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "vi",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$19.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CartProvider, { children: [useRouterState({ select: (s) => s.location.pathname }).startsWith("/admin") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-screen flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: "flex-1 pb-20 md:pb-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Footer, {})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingWidgets, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileCartBar, {})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {
			position: "top-center",
			richColors: true
		})] })
	});
}
var $$splitComponentImporter$17 = () => import("./routes-DYuQzBAe.mjs");
var Route$18 = createFileRoute("/")({
	head: () => ({ meta: [
		{ title: "Trà Trái Cây Tô — Đặt trà trái cây tươi & tích điểm" },
		{
			name: "description",
			content: "Đặt trà trái cây tươi online: tùy chỉnh trà nền, đường, đá, topping. Giao nhanh, tích điểm đổi quà mỗi ly."
		},
		{
			property: "og:title",
			content: "Trà Trái Cây Tô — Trà trái cây tươi mỗi ngày"
		},
		{
			property: "og:description",
			content: "Trà ủ mới trong ngày, 100% trái cây tươi. Đặt online, tích điểm, đổi quà."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$17, "component")
});
var $$splitComponentImporter$16 = () => import("./admin-p-ju2IYg.mjs");
var Route$17 = createFileRoute("/admin")({
	beforeLoad: ({ location }) => {
		if (typeof window === "undefined") return;
		if (!getToken() && location.pathname !== "/admin/login") throw redirect({ to: "/admin/login" });
	},
	head: () => ({ meta: [
		{ title: "Bảng điều khiển quản trị | Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Hệ thống quản trị chuỗi trà trái cây: đơn hàng, KDS, vị trí & QR bàn, khuyến mãi và báo cáo."
		},
		{
			name: "robots",
			content: "noindex"
		},
		{
			property: "og:title",
			content: "Bảng điều khiển quản trị | Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Quản lý đơn hàng, vị trí bàn, khuyến mãi và báo cáo cho toàn chuỗi."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$16, "component")
});
var $$splitComponentImporter$15 = () => import("./cua-hang-CJSAwSHM.mjs");
var Route$16 = createFileRoute("/cua-hang")({
	head: () => ({ meta: [
		{ title: "Hệ thống cửa hàng & Google Maps — Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Tìm chi nhánh Trà Trái Cây Tô gần bạn với bản đồ Google Maps tương tác, địa chỉ, giờ mở cửa và chỉ đường nhanh."
		},
		{
			property: "og:title",
			content: "Hệ thống cửa hàng — Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Tìm chi nhánh gần nhất trên bản đồ Google Maps tương tác."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$15, "component")
});
var $$splitComponentImporter$14 = () => import("./gioi-thieu-COWq-iXX.mjs");
var Route$15 = createFileRoute("/gioi-thieu")({
	head: () => ({ meta: [
		{ title: "Câu chuyện Trà & Trái cây tươi — Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Hành trình của Trà Trái Cây Tô: trà ủ mới mỗi ngày, trái cây tuyển chọn tại vườn và cam kết không chất bảo quản."
		},
		{
			property: "og:title",
			content: "Câu chuyện Trà & Trái cây tươi — Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Trà đậm vị pha trong ngày, 100% trái cây tươi."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./ho-so-DOtPABGn.mjs");
var Route$14 = createFileRoute("/ho-so")({
	head: () => ({ meta: [
		{ title: "Hồ sơ cá nhân & lịch sử đơn hàng — Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Quản lý thông tin cá nhân, thẻ hội viên điện tử, mã QR tích điểm, lịch sử đơn hàng và danh sách yêu thích."
		},
		{
			property: "og:title",
			content: "Hồ sơ cá nhân — Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Đặt lại đơn cũ chỉ với 1 chạm."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var $$splitComponentImporter$12 = () => import("./menu-DyBGmEVj.mjs");
var Route$13 = createFileRoute("/menu")({
	validateSearch: (search) => ({ table_id: typeof search.table_id === "string" ? search.table_id : typeof search.table_id === "number" ? String(search.table_id) : void 0 }),
	head: () => ({ meta: [
		{ title: "Thực đơn trà trái cây — Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Menu trà trái cây tươi, trà đậm vị, trà tuyết và Hi-Tea detox. Lọc theo dòng trà, vị trái cây và đặt hàng ngay."
		},
		{
			property: "og:title",
			content: "Thực đơn trà trái cây — Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Lọc theo dòng trà và vị trái cây, tùy chỉnh từng ly."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
var BASE_URL = "";
var Route$12 = createFileRoute("/sitemap.xml")({ server: { handlers: { GET: async () => {
	const xml = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
		...[
			{
				path: "/",
				changefreq: "weekly",
				priority: "1.0"
			},
			{
				path: "/menu",
				changefreq: "daily",
				priority: "0.9"
			},
			{
				path: "/gioi-thieu",
				changefreq: "monthly",
				priority: "0.6"
			},
			{
				path: "/cua-hang",
				changefreq: "weekly",
				priority: "0.8"
			},
			{
				path: "/tuyen-dung",
				changefreq: "weekly",
				priority: "0.6"
			},
			{
				path: "/thanh-toan",
				changefreq: "monthly",
				priority: "0.4"
			},
			{
				path: "/theo-doi-don",
				changefreq: "monthly",
				priority: "0.3"
			},
			{
				path: "/ho-so",
				changefreq: "monthly",
				priority: "0.3"
			}
		].map((e) => [
			`  <url>`,
			`    <loc>${BASE_URL}${e.path}</loc>`,
			e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
			e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
			e.priority ? `    <priority>${e.priority}</priority>` : null,
			`  </url>`
		].filter(Boolean).join("\n")),
		`</urlset>`
	].join("\n");
	return new Response(xml, { headers: {
		"Content-Type": "application/xml",
		"Cache-Control": "public, max-age=3600"
	} });
} } } });
var $$splitComponentImporter$11 = () => import("./thanh-toan-BWMaT8QY.mjs");
var Route$11 = createFileRoute("/thanh-toan")({
	validateSearch: (search) => ({ table_id: typeof search.table_id === "string" ? search.table_id : typeof search.table_id === "number" ? String(search.table_id) : void 0 }),
	head: () => ({ meta: [
		{ title: "Giỏ hàng & Thanh toán — Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Xác nhận đơn trà trái cây: chọn giao tận nơi hoặc lấy tại cửa hàng, áp mã ưu đãi và thanh toán COD, VietQR, MoMo, ZaloPay."
		},
		{
			property: "og:title",
			content: "Thanh toán đơn trà — Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Đặt nhanh, thanh toán linh hoạt."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
var $$splitComponentImporter$10 = () => import("./tuyen-dung-D2CGqB0J.mjs");
var Route$10 = createFileRoute("/tuyen-dung")({
	head: () => ({ meta: [
		{ title: "Tuyển dụng nhân sự — Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Cơ hội việc làm tại Trà Trái Cây Tô: barista trà trái cây, thu ngân, quản lý cửa hàng và part-time. Nộp CV online."
		},
		{
			property: "og:title",
			content: "Tuyển dụng — Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Gia nhập đội ngũ 48 chi nhánh trên toàn quốc."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("./admin.index-B_bl1Ric.mjs");
var Route$9 = createFileRoute("/admin/")({
	head: () => ({ meta: [
		{ title: "Tổng quan vận hành | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "KPI doanh thu, đơn hàng, cảnh báo tồn kho và biểu đồ doanh thu theo giờ."
		},
		{
			name: "robots",
			content: "noindex"
		},
		{
			property: "og:title",
			content: "Tổng quan vận hành | Admin Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Theo dõi doanh thu, đơn hàng và cảnh báo vận hành real-time."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./admin.bao-cao-CjlQ67x_.mjs");
var Route$8 = createFileRoute("/admin/bao-cao")({
	head: () => ({ meta: [
		{ title: "Báo cáo & Thống kê | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Doanh thu, đơn hàng, AOV, top món bán chạy — tinh gọn theo vận hành."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./admin.bep-_u2OXJJ7.mjs");
var Route$7 = createFileRoute("/admin/bep")({
	head: () => ({ meta: [
		{ title: "Màn hình bếp KDS | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Kitchen Display System với thẻ đơn lớn, màu trạng thái trực quan và cảnh báo quá 15 phút."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./admin.cai-dat-R18W3VZB.mjs");
var Route$6 = createFileRoute("/admin/cai-dat")({
	head: () => ({ meta: [
		{ title: "Cài đặt hệ thống | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Phân quyền tài khoản, thương hiệu, VAT, khu vực giao hàng, audit log và backup."
		},
		{
			name: "robots",
			content: "noindex"
		},
		{
			property: "og:title",
			content: "Cài đặt hệ thống | Admin Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Quản trị tài khoản nội bộ, cấu hình thanh toán và sao lưu dữ liệu."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./admin.chi-nhanh-B7jJCZ3r.mjs");
var Route$5 = createFileRoute("/admin/chi-nhanh")({
	head: () => ({ meta: [
		{ title: "Hệ thống cửa hàng | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Danh sách chi nhánh, giờ mở cửa và bật/tắt hoạt động từng cơ sở."
		},
		{
			name: "robots",
			content: "noindex"
		},
		{
			property: "og:title",
			content: "Hệ thống cửa hàng | Admin Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Quản lý chi nhánh, giờ hoạt động và trạng thái nhận đơn."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./admin.don-hang-DMrScoxU.mjs");
var Route$4 = createFileRoute("/admin/don-hang")({
	head: () => ({ meta: [
		{ title: "Quản lý đơn hàng | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Danh sách đơn hàng dạng list và Kanban với bộ lọc chi nhánh, trạng thái, loại đơn."
		},
		{
			name: "robots",
			content: "noindex"
		},
		{
			property: "og:title",
			content: "Quản lý đơn hàng | Admin Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Lọc, theo dõi và xử lý đơn hàng đa chi nhánh."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./admin.khuyen-mai-CEiVluwk.mjs");
var Route$3 = createFileRoute("/admin/khuyen-mai")({
	head: () => ({ meta: [
		{ title: "Khuyến mãi & Voucher | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Cấu hình voucher giảm giá %: mã dùng 1 lần hoặc mã theo thời hạn giới hạn lượt dùng."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./admin.login-CFWW5_u9.mjs");
var Route$2 = createFileRoute("/admin/login")({
	head: () => ({ meta: [{ title: "Đăng nhập quản trị | Trà Trái Cây Tô" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./admin.thong-bao-4A-5WSWh.mjs");
var Route$1 = createFileRoute("/admin/thong-bao")({
	head: () => ({ meta: [
		{ title: "Trung tâm thông báo | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Đơn mới, cảnh báo tồn kho, voucher sắp hết hạn, duyệt nhân viên và lỗi thanh toán."
		},
		{
			name: "robots",
			content: "noindex"
		},
		{
			property: "og:title",
			content: "Trung tâm thông báo | Admin Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Tổng hợp cảnh báo vận hành real-time cho toàn chuỗi."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./admin.thuc-don-a4RDJwh3.mjs");
var Route = createFileRoute("/admin/thuc-don")({
	head: () => ({ meta: [
		{ title: "Quản lý thực đơn | Admin Trà Trái Cây Tô" },
		{
			name: "description",
			content: "CRUD danh mục, sản phẩm, SEO slug, sắp xếp hiển thị và cấu hình nhóm tùy chọn."
		},
		{
			name: "robots",
			content: "noindex"
		},
		{
			property: "og:title",
			content: "Quản lý thực đơn | Admin Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Thêm, sửa, ẩn/hiện món và cấu hình tùy chọn size, đường, đá, topping."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var IndexRoute = Route$18.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$19
});
var AdminRoute = Route$17.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$19
});
var CuaHangRoute = Route$16.update({
	id: "/cua-hang",
	path: "/cua-hang",
	getParentRoute: () => Route$19
});
var GioiThieuRoute = Route$15.update({
	id: "/gioi-thieu",
	path: "/gioi-thieu",
	getParentRoute: () => Route$19
});
var HoSoRoute = Route$14.update({
	id: "/ho-so",
	path: "/ho-so",
	getParentRoute: () => Route$19
});
var MenuRoute = Route$13.update({
	id: "/menu",
	path: "/menu",
	getParentRoute: () => Route$19
});
var SitemapDotxmlRoute = Route$12.update({
	id: "/sitemap.xml",
	path: "/sitemap.xml",
	getParentRoute: () => Route$19
});
var ThanhToanRoute = Route$11.update({
	id: "/thanh-toan",
	path: "/thanh-toan",
	getParentRoute: () => Route$19
});
var TheoDoiDonRoute = Route$20.update({
	id: "/theo-doi-don",
	path: "/theo-doi-don",
	getParentRoute: () => Route$19
});
var TuyenDungRoute = Route$10.update({
	id: "/tuyen-dung",
	path: "/tuyen-dung",
	getParentRoute: () => Route$19
});
var AdminIndexRoute = Route$9.update({
	id: "/",
	path: "/",
	getParentRoute: () => AdminRoute
});
var AdminRouteChildren = {
	AdminBaoCaoRoute: Route$8.update({
		id: "/bao-cao",
		path: "/bao-cao",
		getParentRoute: () => AdminRoute
	}),
	AdminBepRoute: Route$7.update({
		id: "/bep",
		path: "/bep",
		getParentRoute: () => AdminRoute
	}),
	AdminCaiDatRoute: Route$6.update({
		id: "/cai-dat",
		path: "/cai-dat",
		getParentRoute: () => AdminRoute
	}),
	AdminChiNhanhRoute: Route$5.update({
		id: "/chi-nhanh",
		path: "/chi-nhanh",
		getParentRoute: () => AdminRoute
	}),
	AdminDonHangRoute: Route$4.update({
		id: "/don-hang",
		path: "/don-hang",
		getParentRoute: () => AdminRoute
	}),
	AdminKhuyenMaiRoute: Route$3.update({
		id: "/khuyen-mai",
		path: "/khuyen-mai",
		getParentRoute: () => AdminRoute
	}),
	AdminLoginRoute: Route$2.update({
		id: "/login",
		path: "/login",
		getParentRoute: () => AdminRoute
	}),
	AdminThongBaoRoute: Route$1.update({
		id: "/thong-bao",
		path: "/thong-bao",
		getParentRoute: () => AdminRoute
	}),
	AdminThucDonRoute: Route.update({
		id: "/thuc-don",
		path: "/thuc-don",
		getParentRoute: () => AdminRoute
	}),
	AdminViTriRoute: Route$21.update({
		id: "/vi-tri",
		path: "/vi-tri",
		getParentRoute: () => AdminRoute
	}),
	AdminIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	AdminRoute: AdminRoute._addFileChildren(AdminRouteChildren),
	CuaHangRoute,
	GioiThieuRoute,
	HoSoRoute,
	MenuRoute,
	SitemapDotxmlRoute,
	ThanhToanRoute,
	TheoDoiDonRoute,
	TuyenDungRoute
};
var routeTree = Route$19._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient() },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
