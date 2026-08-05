import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { J as FileSpreadsheet, R as LoaderCircle, Z as Download, q as FileText } from "../_libs/lucide-react.mjs";
import { _ as vnd } from "./data-Z_klJ5jj.mjs";
import { n as apiGet } from "./api-Cnar3gwH.mjs";
import { t as Card } from "./card-N78Fb1PV.mjs";
import { n as SectionCard, r as StatCard, t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { a as TableHeader, i as TableHead, n as TableBody, o as TableRow, r as TableCell, t as Table } from "./table-B4dSFUe4.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as writeFileSync, t as utils } from "../_libs/xlsx.mjs";
import { t as E } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { a as XAxis, c as Bar, d as ResponsiveContainer, f as Tooltip, i as YAxis, l as Pie, n as PieChart, r as BarChart, s as CartesianGrid, u as Cell } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.bao-cao-CjlQ67x_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var pieColors = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)"
];
function today() {
	return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function ReportsPage() {
	const [from, setFrom] = (0, import_react.useState)(today());
	const [to, setTo] = (0, import_react.useState)(today());
	const [kpi, setKpi] = (0, import_react.useState)(null);
	const [byHour, setByHour] = (0, import_react.useState)([]);
	const [byCategory, setByCategory] = (0, import_react.useState)([]);
	const [byBranch, setByBranch] = (0, import_react.useState)([]);
	const [topProducts, setTopProducts] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const load = (0, import_react.useCallback)(async () => {
		setLoading(true);
		try {
			const qs = `?from=${from}&to=${to}`;
			const [k, hour, cat, branch, top] = await Promise.all([
				apiGet(`/admin/reports/kpi-summary${qs}`),
				apiGet(`/admin/dashboard/revenue-by-hour`),
				apiGet(`/admin/dashboard/revenue-by-category`),
				apiGet(`/admin/dashboard/revenue-by-branch`),
				apiGet(`/admin/dashboard/top-products`)
			]);
			setKpi(k);
			setByHour(Array.from({ length: 24 }, (_, h) => {
				return {
					hour: h,
					value: hour.find((x) => Number(x.hour) === h)?.value ?? 0
				};
			}).filter((x) => x.value > 0));
			setByCategory(cat);
			setByBranch(branch);
			setTopProducts(top);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, [from, to]);
	(0, import_react.useEffect)(() => {
		load();
	}, [load]);
	function exportCsv() {
		const csv = [
			[
				"Báo cáo từ",
				from,
				"đến",
				to,
				""
			],
			[
				"Chỉ số",
				"Giá trị",
				"",
				"",
				""
			],
			[
				"Doanh thu",
				kpi?.revenue ?? 0,
				"",
				"",
				""
			],
			[
				"Tổng đơn",
				kpi?.total_orders ?? 0,
				"",
				"",
				""
			],
			[
				"AOV",
				kpi?.avg_order ?? 0,
				"",
				"",
				""
			],
			[
				"Tỷ lệ hủy (%)",
				kpi?.cancel_rate ?? 0,
				"",
				"",
				""
			],
			[
				"",
				"",
				"",
				"",
				""
			],
			[
				"Top món",
				"Số ly",
				"Doanh thu",
				"",
				""
			],
			...topProducts.map((p) => [
				p.name,
				p.qty,
				p.revenue,
				"",
				""
			]),
			[
				"",
				"",
				"",
				"",
				""
			],
			[
				"Doanh thu theo chi nhánh",
				"Giá trị",
				"",
				"",
				""
			],
			...byBranch.map((b) => [
				b.name,
				b.value,
				"",
				"",
				""
			])
		].map((r) => r.join(",")).join("\n");
		const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `bao-cao-${from}-${to}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	}
	function exportExcel() {
		const wb = utils.book_new();
		utils.book_append_sheet(wb, utils.aoa_to_sheet([
			["Chỉ số", "Giá trị"],
			["Doanh thu", kpi?.revenue ?? 0],
			["Tổng đơn hoàn thành", kpi?.total_orders ?? 0],
			["Giá trị đơn trung bình (AOV)", kpi?.avg_order ?? 0],
			["Số đơn hủy", kpi?.cancelled ?? 0],
			["Tỷ lệ hủy đơn (%)", kpi?.cancel_rate ?? 0]
		]), "Tổng quan");
		utils.book_append_sheet(wb, utils.json_to_sheet(topProducts.map((p) => ({
			"Món": p.name,
			"Số ly": p.qty,
			"Doanh thu": p.revenue
		}))), "Top món bán chạy");
		utils.book_append_sheet(wb, utils.json_to_sheet(byBranch.map((b) => ({
			"Chi nhánh": b.name,
			"Doanh thu": b.value
		}))), "Doanh thu chi nhánh");
		utils.book_append_sheet(wb, utils.json_to_sheet(byCategory.map((c) => ({
			"Danh mục": c.name,
			"Doanh thu": c.value
		}))), "Doanh thu danh mục");
		writeFileSync(wb, `bao-cao-${from}-${to}.xlsx`);
		toast.success("Đã xuất file Excel");
	}
	function exportPdf() {
		const doc = new E();
		const lastY = () => doc.lastAutoTable.finalY;
		doc.setFontSize(16);
		doc.text("Báo cáo doanh thu", 14, 18);
		doc.setFontSize(10);
		doc.text(`Kỳ báo cáo: ${from} → ${to} · Trà Trái Cây Tô`, 14, 26);
		autoTable(doc, {
			startY: 32,
			head: [["Chỉ số", "Giá trị"]],
			body: [
				["Doanh thu", vnd(kpi?.revenue ?? 0)],
				["Tổng đơn hoàn thành", String(kpi?.total_orders ?? 0)],
				["Giá trị đơn trung bình (AOV)", vnd(kpi?.avg_order ?? 0)],
				["Số đơn hủy", String(kpi?.cancelled ?? 0)],
				["Tỷ lệ hủy đơn (%)", `${kpi?.cancel_rate ?? 0}%`]
			]
		});
		autoTable(doc, {
			startY: lastY() + 10,
			head: [[
				"Top món bán chạy",
				"Số ly",
				"Doanh thu"
			]],
			body: topProducts.map((p) => [
				p.name,
				String(p.qty),
				vnd(p.revenue)
			])
		});
		autoTable(doc, {
			startY: lastY() + 10,
			head: [["Chi nhánh", "Doanh thu"]],
			body: byBranch.map((b) => [b.name, vnd(b.value)])
		});
		autoTable(doc, {
			startY: lastY() + 10,
			head: [["Danh mục", "Doanh thu"]],
			body: byCategory.map((c) => [c.name, vnd(c.value)])
		});
		doc.save(`bao-cao-${from}-${to}.pdf`);
		toast.success("Đã xuất file PDF");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
		title: "Báo cáo & Thống kê",
		desc: kpi ? `Kỳ báo cáo: ${kpi.period.from} → ${kpi.period.to}` : "Doanh thu, đơn hàng, AOV, top món bán chạy",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-end gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "rep-from",
						className: "text-xs",
						children: "Từ ngày"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "rep-from",
						type: "date",
						value: from,
						onChange: (e) => setFrom(e.target.value),
						className: "h-9"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "rep-to",
						className: "text-xs",
						children: "Đến ngày"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "rep-to",
						type: "date",
						value: to,
						onChange: (e) => setTo(e.target.value),
						className: "h-9"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "hero",
					size: "sm",
					onClick: load,
					disabled: loading,
					children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : "Xem"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					size: "sm",
					onClick: exportCsv,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), " CSV"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					size: "sm",
					onClick: exportExcel,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSpreadsheet, { className: "size-4" }), " Excel"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					size: "sm",
					onClick: exportPdf,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-4" }), " PDF"]
				})
			]
		})
	}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-center py-20 text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" }), " Đang tải…"]
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Doanh thu",
					value: vnd(kpi?.revenue ?? 0),
					tone: "primary"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Tổng đơn hoàn thành",
					value: kpi?.total_orders ?? 0,
					tone: "leaf"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Giá trị đơn trung bình (AOV)",
					value: vnd(kpi?.avg_order ?? 0),
					tone: "primary"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Tỷ lệ hủy đơn",
					value: `${kpi?.cancel_rate ?? 0}%`,
					delta: `${kpi?.cancelled ?? 0} đơn hủy`,
					tone: "berry"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-4 lg:grid-cols-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
				className: "lg:col-span-2",
				title: "Doanh thu theo giờ",
				desc: "Trong ngày (VNĐ)",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-64",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
							data: byHour,
							margin: {
								left: 8,
								right: 8,
								top: 8
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									strokeDasharray: "4 4",
									stroke: "var(--border)",
									vertical: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									dataKey: "hour",
									tickFormatter: (h) => `${h}h`,
									tickLine: false,
									axisLine: false,
									fontSize: 12
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									tickLine: false,
									axisLine: false,
									fontSize: 12
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
									formatter: (v) => vnd(Number(v)),
									contentStyle: {
										borderRadius: 12,
										border: "1px solid var(--border)",
										background: "var(--popover)",
										fontSize: 12
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "value",
									fill: "var(--chart-1)",
									radius: [
										8,
										8,
										0,
										0
									]
								})
							]
						})
					})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
				title: "Cơ cấu theo danh mục",
				desc: "Tỷ trọng doanh thu",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-64",
					children: byCategory.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground py-20 text-center text-sm",
						children: "Chưa có dữ liệu"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PieChart, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pie, {
							data: byCategory,
							dataKey: "value",
							nameKey: "name",
							innerRadius: 48,
							outerRadius: 84,
							paddingAngle: 3,
							children: byCategory.map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, { fill: pieColors[i % pieColors.length] }, i))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
							formatter: (v) => vnd(Number(v)),
							contentStyle: {
								borderRadius: 12,
								border: "1px solid var(--border)",
								background: "var(--popover)",
								fontSize: 12
							}
						})] })
					})
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
				title: "Doanh thu theo chi nhánh",
				desc: "VNĐ",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-64",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
							data: byBranch,
							layout: "vertical",
							margin: {
								left: 24,
								right: 8
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									strokeDasharray: "4 4",
									stroke: "var(--border)",
									horizontal: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									type: "number",
									tickLine: false,
									axisLine: false,
									fontSize: 12,
									tickFormatter: (v) => `${Math.round(v / 1e3)}k`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									type: "category",
									dataKey: "name",
									tickLine: false,
									axisLine: false,
									fontSize: 12,
									width: 110
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
									formatter: (v) => vnd(Number(v)),
									contentStyle: {
										borderRadius: 12,
										border: "1px solid var(--border)",
										background: "var(--popover)",
										fontSize: 12
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "value",
									fill: "var(--chart-2)",
									radius: [
										0,
										8,
										8,
										0
									]
								})
							]
						})
					})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
				title: "Top 10 món bán chạy",
				desc: "Theo số ly đã bán",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "shadow-none",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Table, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
							className: "w-8",
							children: "#"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Món" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
							className: "text-right",
							children: "Số ly"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {
							className: "text-right",
							children: "Doanh thu"
						})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableBody, { children: [topProducts.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							className: "text-muted-foreground text-xs",
							children: i + 1
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							className: "font-medium",
							children: p.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							className: "text-right",
							children: p.qty
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
							className: "text-right font-semibold",
							children: vnd(p.revenue)
						})
					] }, p.name)), topProducts.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableRow, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						colSpan: 4,
						className: "text-muted-foreground py-8 text-center",
						children: "Chưa có dữ liệu"
					}) })] })] })
				})
			})]
		})
	] })] });
}
//#endregion
export { ReportsPage as component };
