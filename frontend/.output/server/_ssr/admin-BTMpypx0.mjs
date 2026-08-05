import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as cn, t as Button } from "./data-BKElHwIS.mjs";
import { t as Input } from "./input-DvwfGdEz.mjs";
import { t as Badge } from "./badge-CmDb9cdk.mjs";
import { B as Leaf, D as PanelLeftOpen, H as LayoutDashboard, M as Menu, N as Megaphone, O as PanelLeftClose, _ as Settings, d as Store, ft as Bell, g as ShieldCheck, lt as ChartColumn, ot as ChevronDown, r as UtensilsCrossed, st as ChefHat, tt as ClipboardList, x as QrCode, y as Search } from "../_libs/lucide-react.mjs";
import { a as DropdownMenuSeparator, c as PopoverContent, d as SheetContent, i as DropdownMenuLabel, l as PopoverTrigger, n as DropdownMenuContent, o as DropdownMenuTrigger, r as DropdownMenuItem, s as Popover, t as DropdownMenu, u as Sheet } from "./dropdown-menu-d265-J2M.mjs";
import { a as adminRoles, n as adminBranches, r as adminNotifications } from "./admin-data-D7T31PXz.mjs";
import { f as Outlet, g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-BTMpypx0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var adminNav = [
	{
		to: "/admin",
		label: "Tổng quan",
		icon: LayoutDashboard,
		exact: true
	},
	{
		to: "/admin/don-hang",
		label: "Đơn hàng",
		icon: ClipboardList
	},
	{
		to: "/admin/bep",
		label: "Màn hình bếp (KDS)",
		icon: ChefHat
	},
	{
		to: "/admin/vi-tri",
		label: "Vị trí & Mã QR bàn",
		icon: QrCode
	},
	{
		to: "/admin/thuc-don",
		label: "Thực đơn",
		icon: UtensilsCrossed
	},
	{
		to: "/admin/chi-nhanh",
		label: "Hệ thống cửa hàng",
		icon: Store
	},
	{
		to: "/admin/khuyen-mai",
		label: "Khuyến mãi & Voucher",
		icon: Megaphone
	},
	{
		to: "/admin/bao-cao",
		label: "Báo cáo & Thống kê",
		icon: ChartColumn
	},
	{
		to: "/admin/thong-bao",
		label: "Trung tâm thông báo",
		icon: Bell
	},
	{
		to: "/admin/cai-dat",
		label: "Cài đặt hệ thống",
		icon: Settings
	}
];
function AdminSidebar({ collapsed, onToggle, onNavigate }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: cn("bg-sidebar text-sidebar-foreground flex h-full flex-col border-r transition-[width] duration-200", collapsed ? "w-[76px]" : "w-[264px]"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-16 items-center gap-2 border-b px-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Leaf, { className: "size-5" })
					}),
					!collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display truncate text-sm font-bold",
							children: "Trà Trái Cây Tô Admin"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground truncate text-[11px]",
							children: "Bảng điều khiển v4.0"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onToggle,
						"aria-label": collapsed ? "Mở rộng menu" : "Thu gọn menu",
						className: "hover:bg-sidebar-accent ml-auto hidden rounded-lg p-1.5 lg:block",
						children: collapsed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeftOpen, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeftClose, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "flex-1 space-y-1 overflow-y-auto p-3",
				children: adminNav.map((item) => {
					const active = "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						onClick: onNavigate,
						title: collapsed ? item.label : void 0,
						className: cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground shadow-glow" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-0"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-[18px] shrink-0" }), !collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate",
							children: item.label
						})]
					}, item.to);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-t p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "text-muted-foreground hover:text-primary flex items-center gap-3 rounded-xl px-3 py-2 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Store, { className: "size-4 shrink-0" }), !collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Về website khách hàng" })]
				})
			})
		]
	});
}
function AdminTopbar({ branch, onBranchChange, role, onRoleChange, onOpenMobileNav }) {
	const currentBranch = adminBranches.find((b) => b.id === branch) ?? adminBranches[0];
	const currentRole = adminRoles.find((r) => r.id === role) ?? adminRoles[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "bg-background/90 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 backdrop-blur md:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "ghost",
				size: "icon",
				className: "lg:hidden",
				onClick: onOpenMobileNav,
				"aria-label": "Mở menu",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					className: "max-w-[210px] justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate text-xs md:text-sm",
						children: currentBranch.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 shrink-0" })]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
				align: "start",
				className: "w-64",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, { children: "Chi nhánh hoạt động" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
					adminBranches.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
						onSelect: () => onBranchChange(b.id),
						children: b.name
					}, b.id))
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative ml-auto hidden max-w-xs flex-1 md:block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					placeholder: "Tìm đơn hàng, khách hàng, món…",
					className: "pl-9"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					size: "icon",
					className: "relative ml-auto md:ml-0",
					"aria-label": "Thông báo",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "bg-berry text-berry-foreground absolute top-1 right-1 grid size-4 place-items-center rounded-full text-[10px] font-bold",
						children: adminNotifications.length
					})]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
				align: "end",
				className: "w-80 p-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "border-b px-4 py-3 text-sm font-semibold",
					children: "Trung tâm thông báo"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "max-h-72 overflow-y-auto",
					children: adminNotifications.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "hover:bg-muted/60 border-b px-4 py-3 last:border-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm",
							children: n.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground mt-1 text-xs",
							children: n.time
						})]
					}, n.id))
				})]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					className: "gap-2 px-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground grid size-8 place-items-center rounded-full text-xs font-bold",
						children: "NQ"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "hidden text-left leading-tight sm:block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-xs font-semibold",
							children: "Hoàng Quân"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground block text-[11px]",
							children: currentRole.label
						})]
					})]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
				align: "end",
				className: "w-72",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuLabel, {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "text-leaf size-4" }), " Vai trò đang xem (RBAC)"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
					adminRoles.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
						onSelect: () => onRoleChange(r.id),
						className: "flex-col items-start gap-0.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex w-full items-center justify-between text-sm font-medium",
							children: [r.label, r.id === role && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								children: "Đang chọn"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground text-xs",
							children: r.desc
						})]
					}, r.id)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, { children: "Đăng xuất" })
				]
			})] })
		]
	});
}
function AdminLayout() {
	const [collapsed, setCollapsed] = (0, import_react.useState)(false);
	const [mobileOpen, setMobileOpen] = (0, import_react.useState)(false);
	const [branch, setBranch] = (0, import_react.useState)("all");
	const [role, setRole] = (0, import_react.useState)("super");
	if (useRouterState({ select: (s) => s.location.pathname }) === "/admin/login") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-muted/30 flex min-h-screen",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sticky top-0 hidden h-screen lg:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminSidebar, {
					collapsed,
					onToggle: () => setCollapsed((v) => !v)
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open: mobileOpen,
				onOpenChange: setMobileOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, {
					side: "left",
					className: "w-[264px] p-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminSidebar, {
						collapsed: false,
						onToggle: () => {},
						onNavigate: () => setMobileOpen(false)
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminTopbar, {
					branch,
					onBranchChange: setBranch,
					role,
					onRoleChange: setRole,
					onOpenMobileNav: () => setMobileOpen(true)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
				})]
			})
		]
	});
}
//#endregion
export { AdminLayout as component };
