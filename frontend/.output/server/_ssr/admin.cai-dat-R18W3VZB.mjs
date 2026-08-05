import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { Q as DatabaseBackup, R as LoaderCircle, Z as Download, o as Upload } from "../_libs/lucide-react.mjs";
import { n as brand } from "./data-Z_klJ5jj.mjs";
import { n as apiGet } from "./api-Cnar3gwH.mjs";
import { t as Card } from "./card-N78Fb1PV.mjs";
import { n as SectionCard, t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { a as TableHeader, i as TableHead, n as TableBody, o as TableRow, r as TableCell, t as Table } from "./table-B4dSFUe4.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Switch } from "./switch-BCfmMxEa.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-BtxHXOBC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.cai-dat-R18W3VZB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var roleLabels = {
	super: "Super Admin",
	manager: "Store Manager",
	kitchen: "Kitchen Staff",
	cashier: "Cashier Staff"
};
function SettingsPage() {
	const [accounts, setAccounts] = (0, import_react.useState)([]);
	const [logs, setLogs] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		Promise.all([apiGet("/admin/settings/accounts"), apiGet("/admin/settings/audit-logs")]).then(([accs, als]) => {
			if (cancelled) return;
			setAccounts(accs);
			setLogs(als);
		}).catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được cài đặt")).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
		title: "Cài đặt hệ thống",
		desc: "Chỉ Super Admin có toàn quyền chỉnh sửa các mục dưới đây"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		defaultValue: "accounts",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
				className: "flex-wrap",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "accounts",
						children: "Tài khoản & Phân quyền"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "brand",
						children: "Thương hiệu & VAT"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "logs",
						children: "Nhật ký hoạt động"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "backup",
						children: "Sao lưu & Khôi phục"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "accounts",
				className: "mt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "shadow-soft overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center justify-between border-b p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display font-bold",
							children: "Tài khoản nội bộ"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Table, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Nhân sự" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Vai trò" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
								className: "hidden md:table-cell",
								children: "Phạm vi"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
								className: "text-right",
								children: "Kích hoạt"
							})
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableBody, { children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableRow, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							colSpan: 4,
							className: "text-muted-foreground py-10 text-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mx-auto size-5 animate-spin" })
						}) }) : accounts.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: u.fullname
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground text-xs",
								children: u.email || "—"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								children: roleLabels[u.role] ?? u.role
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
								className: "hidden text-sm md:table-cell",
								children: u.branch
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
								className: "text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: u.active,
									disabled: true
								})
							})
						] }, u.id)) })] })
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "brand",
				className: "mt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 lg:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
							title: "Thông tin thương hiệu",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-name",
										label: "Tên thương hiệu",
										value: brand.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-hotline",
										label: "Hotline",
										value: brand.hotline
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-email",
										label: "Email CSKH",
										value: brand.email
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-vat",
										label: "Thuế VAT (%)",
										value: "8"
									})
								]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
							title: "Khu vực giao hàng & phí ship",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-radius",
										label: "Bán kính giao hàng (km)",
										value: "6"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-fee1",
										label: "Phí ship 0 – 3km (₫)",
										value: "15000"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-fee2",
										label: "Phí ship 3 – 6km (₫)",
										value: "25000"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-free",
										label: "Miễn phí ship cho đơn từ (₫)",
										value: "150000"
									})
								]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SectionCard, {
							title: "Cổng thanh toán",
							className: "lg:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 md:grid-cols-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-vietqr",
										label: "VietQR API Key",
										value: "••••••••••••"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-momo",
										label: "MoMo Partner Code",
										value: "••••••••••••"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "s-zalo",
										label: "ZaloPay App ID",
										value: "••••••••••••"
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "hero",
								className: "mt-4",
								onClick: () => toast.success("Đã lưu cấu hình (demo)"),
								children: "Lưu cấu hình"
							})]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "logs",
				className: "mt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "shadow-soft overflow-hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Table, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Người thực hiện" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Thao tác" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
								className: "hidden md:table-cell",
								children: "Nội dung thay đổi"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
								className: "hidden lg:table-cell",
								children: "IP / Thiết bị"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
								className: "text-right",
								children: "Thời gian"
							})
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableBody, { children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableRow, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							colSpan: 5,
							className: "text-muted-foreground py-10 text-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mx-auto size-5 animate-spin" })
						}) }) : logs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableRow, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							colSpan: 5,
							className: "text-muted-foreground py-10 text-center",
							children: "Chưa có nhật ký hoạt động"
						}) }) : logs.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
								className: "text-sm",
								children: l.user_name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
								className: "text-sm font-medium",
								children: l.action
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
								className: "text-muted-foreground hidden text-sm md:table-cell",
								children: l.detail || "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, {
								className: "text-muted-foreground hidden text-xs lg:table-cell",
								children: [
									l.ip_address || "—",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									l.user_agent?.split(" ").slice(0, 2).join(" ") || "—"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
								className: "text-right text-sm whitespace-nowrap",
								children: new Date(l.created_at).toLocaleString("vi-VN")
							})
						] }, l.id)) })] })
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "backup",
				className: "mt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 lg:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: "Lịch sao lưu tự động",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center justify-between rounded-xl border p-3 text-sm",
									children: ["Sao lưu hằng ngày (02:00) ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, { defaultChecked: true })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center justify-between rounded-xl border p-3 text-sm",
									children: ["Sao lưu hằng tuần (Chủ nhật) ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, { defaultChecked: true })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground text-xs",
									children: "Bản sao lưu gần nhất: 27/07/2026 02:00 · 148 MB"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: "Export / Import dữ liệu",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "outline",
									onClick: () => toast.success("Đang xuất JSON (demo)"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1 size-4" }), " Export JSON"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "outline",
									onClick: () => toast.success("Đang xuất SQL (demo)"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DatabaseBackup, { className: "mr-1 size-4" }), " Export SQL"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "soft",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "mr-1 size-4" }), " Import dữ liệu"]
								})
							]
						})
					})]
				})
			})
		]
	})] });
}
function Field({ id, label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
		htmlFor: id,
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
		id,
		defaultValue: value,
		className: "mt-1.5"
	})] });
}
//#endregion
export { SettingsPage as component };
