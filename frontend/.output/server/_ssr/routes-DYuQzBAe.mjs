import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { B as Leaf, f as Star, g as ShieldCheck, p as Sparkles, vt as ArrowRight } from "../_libs/lucide-react.mjs";
import { c as products, f as stores, l as promotions } from "./data-Z_klJ5jj.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as story_default } from "./story-CfETKZ6E.mjs";
import { t as ProductCard } from "./ProductCard-DebwLGTj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DYuQzBAe.js
var import_jsx_runtime = require_jsx_runtime();
var hero_tea_default = "/assets/hero-tea-CnZJmeVT.jpg";
var commitments = [
	{
		icon: Leaf,
		title: "100% Trái cây tươi",
		desc: "Nhập mới mỗi sáng, sơ chế tại quầy."
	},
	{
		icon: Sparkles,
		title: "Không chất bảo quản",
		desc: "Trà ủ trong ngày, hết ngày là bỏ."
	},
	{
		icon: ShieldCheck,
		title: "Đạt chuẩn ATVSTP",
		desc: "Quy trình kiểm định định kỳ toàn hệ thống."
	}
];
function Home() {
	const bestSellers = products.filter((p) => p.tags.includes("best-seller") || p.tags.includes("new"));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "relative",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: hero_tea_default,
					alt: "Ly trà trái cây tươi cùng dâu, xoài và cam",
					width: 1920,
					height: 1088,
					className: "h-[62vh] max-h-[560px] min-h-80 w-full object-cover"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 flex items-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "container-page",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-primary-foreground max-w-xl",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									className: "bg-card text-foreground mb-4 rounded-full",
									children: "🍑 Seasonal Menu 2026"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
									className: "font-display text-3xl leading-tight font-extrabold drop-shadow md:text-5xl",
									children: [
										"Trà đậm vị, trái cây tươi",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"pha mới từng ly"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-4 max-w-md text-sm drop-shadow md:text-base",
									children: "Chọn cốt trà, mức đường, mức đá và topping theo đúng khẩu vị của bạn — giao đến trong 25 phút."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-7 flex flex-wrap gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										asChild: true,
										variant: "hero",
										size: "lg",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
											to: "/menu",
											children: ["Đặt món ngay ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										asChild: true,
										variant: "secondary",
										size: "lg",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/cua-hang",
											children: "Ghé cửa hàng"
										})
									})]
								})
							]
						})
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "container-page -mt-10 relative z-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "bg-card grid gap-4 rounded-2xl border p-5 shadow-card-soft sm:grid-cols-3",
				children: commitments.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(c.icon, { className: "size-5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-bold",
						children: c.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-xs",
						children: c.desc
					})] })]
				}, c.title))
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "container-page grid items-center gap-8 py-16 md:grid-cols-2 md:py-20",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-hidden rounded-3xl",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: story_default,
					alt: "Sơ chế trái cây tươi và trà lá rời tại quầy",
					loading: "lazy",
					width: 1024,
					height: 768,
					className: "w-full object-cover"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-primary text-xs font-bold tracking-[0.2em] uppercase",
					children: "Câu chuyện thương hiệu"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display mt-2 text-2xl font-extrabold md:text-3xl",
					children: "Mỗi ly trà bắt đầu từ 5 giờ sáng"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground mt-4 text-sm leading-relaxed",
					children: "Trà được ủ mới mỗi 4 tiếng từ lá trà Thái Nguyên và Bảo Lộc. Trái cây được chọn tại vườn, giao đến cửa hàng trước giờ mở cửa và cắt gọt thủ công ngay tại quầy — không siro cô đặc, không chất bảo quản."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6 grid grid-cols-3 gap-4",
					children: [
						{
							n: "48",
							l: "Chi nhánh"
						},
						{
							n: "1.2M",
							l: "Ly trà mỗi năm"
						},
						{
							n: "4.8★",
							l: "Điểm hài lòng"
						}
					].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-secondary/60 rounded-2xl p-4 text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-primary text-2xl font-extrabold",
							children: s.n
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-xs",
							children: s.l
						})]
					}, s.l))
				})
			] })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "container-page pb-16",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6 flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-primary text-xs font-bold tracking-[0.2em] uppercase",
					children: "Hot trong ngày"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl font-extrabold md:text-3xl",
					children: "Best Seller"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "soft",
					size: "sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/menu",
						children: ["Xem toàn bộ menu ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-4 lg:grid-cols-4",
				children: bestSellers.slice(0, 4).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductCard, { product: p }, p.id))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "bg-secondary/50 border-y py-16",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "container-page",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display mb-6 text-2xl font-extrabold md:text-3xl",
					children: "Ưu đãi đang diễn ra"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 md:grid-cols-3",
					children: [promotions.filter((p) => p.status === "Đang diễn ra").map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card rounded-2xl border p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-3xl",
								children: p.emoji
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display mt-3 text-lg font-bold",
								children: p.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground text-xs",
								children: p.period
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground mt-2 text-sm",
								children: p.rule
							})
						]
					}, p.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "gradient-warm text-primary-foreground flex flex-col justify-center rounded-2xl p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "mb-2 size-6" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-lg font-bold",
								children: "Voucher giảm giá %"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm opacity-90",
								children: "Nhập mã giảm giá tại thanh toán — mã dùng 1 lần hoặc mã theo thời hạn, giới hạn lượt dùng."
							})
						]
					})]
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "container-page py-16",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6 flex items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl font-extrabold md:text-3xl",
					children: "Ghé tiệm gần bạn"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "soft",
					size: "sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/cua-hang",
						children: "Tất cả chi nhánh"
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
				children: stores.slice(0, 3).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card rounded-2xl border p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold",
							children: s.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground mt-1 text-sm",
							children: s.address
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground mt-2 text-xs",
							children: ["Mở cửa ", s.hours]
						})
					]
				}, s.id))
			})]
		})
	] });
}
//#endregion
export { Home as component };
