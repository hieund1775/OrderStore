import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime, a as Overlay2, c as Title2, i as Description2, n as Cancel, o as Portal2, r as Content2, s as Root2, t as Action } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as cn, i as buttonVariants, t as Button } from "./data-BKElHwIS.mjs";
import { t as Input } from "./input-DvwfGdEz.mjs";
import { t as Badge } from "./badge-CmDb9cdk.mjs";
import { C as Plus, P as MapPin, R as LoaderCircle, S as Printer, T as Pencil, Y as Download, c as Trash2, x as QrCode } from "../_libs/lucide-react.mjs";
import { n as adminBranches } from "./admin-data-D7T31PXz.mjs";
import { a as apiPut, i as apiPost, n as apiGet, t as apiDelete } from "./api-CyIKtyVS.mjs";
import { n as CardContent, t as Card } from "./card-DaABMcTj.mjs";
import { t as Label } from "./label-xBCHZgmT.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, r as DialogFooter, t as Dialog } from "./dialog-Bztdc_I8.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as require_lib } from "../_libs/qrcode.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-HGKjV_Eq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.vi-tri-D8vTfoSa.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_lib = /* @__PURE__ */ __toESM(require_lib());
var AlertDialog = Root2;
var AlertDialogPortal = Portal2;
var AlertDialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay2, {
	className: cn("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props,
	ref
}));
AlertDialogOverlay.displayName = Overlay2.displayName;
var AlertDialogContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg", className),
	...props
})] }));
AlertDialogContent.displayName = Content2.displayName;
var AlertDialogHeader = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col space-y-2 text-center sm:text-left", className),
	...props
});
AlertDialogHeader.displayName = "AlertDialogHeader";
var AlertDialogFooter = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
	...props
});
AlertDialogFooter.displayName = "AlertDialogFooter";
var AlertDialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title2, {
	ref,
	className: cn("text-lg font-semibold", className),
	...props
}));
AlertDialogTitle.displayName = Title2.displayName;
var AlertDialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Description2, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
AlertDialogDescription.displayName = Description2.displayName;
var AlertDialogAction = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Action, {
	ref,
	className: cn(buttonVariants(), className),
	...props
}));
AlertDialogAction.displayName = Action.displayName;
var AlertDialogCancel = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cancel, {
	ref,
	className: cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className),
	...props
}));
AlertDialogCancel.displayName = Cancel.displayName;
function qrUrl(table) {
	return `${window.location.origin}/menu?table_id=${table.id}`;
}
function TablesPage() {
	const [tables, setTables] = (0, import_react.useState)([]);
	const [branchFilter, setBranchFilter] = (0, import_react.useState)("all");
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [qrMap, setQrMap] = (0, import_react.useState)({});
	const [dialogOpen, setDialogOpen] = (0, import_react.useState)(false);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [deleting, setDeleting] = (0, import_react.useState)(null);
	const [formName, setFormName] = (0, import_react.useState)("");
	const [formStore, setFormStore] = (0, import_react.useState)("1");
	const [saving, setSaving] = (0, import_react.useState)(false);
	const load = (0, import_react.useCallback)(async () => {
		setLoading(true);
		try {
			const rows = await apiGet("/admin/tables");
			setTables(rows);
			const map = {};
			await Promise.all(rows.map(async (t) => {
				map[t.id] = await import_lib.toDataURL(qrUrl(t), {
					width: 200,
					margin: 1
				});
			}));
			setQrMap(map);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Không tải được danh sách bàn");
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		load();
	}, [load]);
	const filtered = branchFilter === "all" ? tables : tables.filter((t) => t.store_id === Number(branchFilter));
	function openCreate() {
		setEditing(null);
		setFormName("");
		setFormStore(branchFilter === "all" ? "1" : branchFilter);
		setDialogOpen(true);
	}
	function openEdit(t) {
		setEditing(t);
		setFormName(t.name);
		setFormStore(String(t.store_id));
		setDialogOpen(true);
	}
	async function save() {
		if (!formName.trim()) return toast.error("Vui lòng nhập tên bàn/vị trí");
		setSaving(true);
		try {
			if (editing) {
				await apiPut(`/admin/tables/${editing.id}`, { name: formName.trim() });
				toast.success("Đã cập nhật bàn");
			} else {
				await apiPost("/admin/tables", {
					store_id: Number(formStore),
					name: formName.trim()
				});
				toast.success("Đã tạo bàn mới");
			}
			setDialogOpen(false);
			load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lưu thất bại");
		} finally {
			setSaving(false);
		}
	}
	async function confirmDelete() {
		if (!deleting) return;
		try {
			await apiDelete(`/admin/tables/${deleting.id}`);
			toast.success("Đã xóa bàn");
			setDeleting(null);
			load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Xóa thất bại");
		}
	}
	function downloadQr(t) {
		const dataUrl = qrMap[t.id];
		if (!dataUrl) return;
		const a = document.createElement("a");
		a.href = dataUrl;
		a.download = `qr-${t.name.replace(/\s+/g, "-").toLowerCase()}.png`;
		a.click();
	}
	function printQr(t) {
		const w = window.open("", "_blank", "width=380,height=480");
		if (!w) return toast.error("Trình duyệt chặn cửa sổ in — hãy cho phép popup");
		const img = qrMap[t.id];
		w.document.write(`
      <html><head><title>QR ${t.name}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
        h3 { margin: 8px 0 2px; } p { margin: 2px 0; color: #666; font-size: 13px; }
        img { width: 220px; height: 220px; }
        @media print { .no-print { display: none; } }
      </style></head>
      <body>
        <img src="${img}" alt="QR ${t.name}" />
        <h3>${t.name}</h3>
        <p>${t.store_name}</p>
        <p>Quét mã để đặt món tại bàn</p>
        <button class="no-print" onclick="window.print()" style="margin-top:16px;padding:8px 20px">In mã QR</button>
        <script>setTimeout(() => window.print(), 300)<\/script>
      </body></html>
    `);
		w.document.close();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-6 flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl font-extrabold",
				children: "Vị trí & Mã QR bàn"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground text-sm",
				children: "Tạo vị trí, sinh mã QR riêng cho từng bàn — khách quét để đặt món trực tiếp tại bàn."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: branchFilter,
					onValueChange: setBranchFilter,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
						className: "w-44",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: adminBranches.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: String(b.id),
						children: b.name
					}, b.id)) })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: openCreate,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Thêm bàn"]
				})]
			})]
		}),
		loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-center py-20 text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" }), " Đang tải…"]
		}) : filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "flex flex-col items-center gap-2 py-16 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "text-muted-foreground size-8" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-semibold",
					children: "Chưa có bàn nào"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground text-sm",
					children: "Bấm \"Thêm bàn\" để tạo vị trí đầu tiên và sinh mã QR dán bàn."
				})
			]
		}) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4",
			children: filtered.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "overflow-hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
					className: "flex flex-col items-center gap-3 p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bg-white rounded-xl border p-2",
							children: qrMap[t.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: qrMap[t.id],
								alt: `QR ${t.name}`,
								className: "size-32"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-muted size-32" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display font-bold",
								children: t.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground flex items-center justify-center gap-1 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-3" }),
									" ",
									t.store_name
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									size: "sm",
									onClick: () => downloadQr(t),
									"aria-label": `Tải mã QR ${t.name}`,
									title: "Tải PNG",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									size: "sm",
									onClick: () => printQr(t),
									"aria-label": `In mã QR ${t.name}`,
									title: "In QR",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									size: "sm",
									onClick: () => openEdit(t),
									"aria-label": `Sửa ${t.name}`,
									title: "Sửa",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									size: "sm",
									className: "text-berry hover:text-berry",
									onClick: () => setDeleting(t),
									"aria-label": `Xóa ${t.name}`,
									title: "Xóa",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
								})
							]
						}),
						t.is_active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "secondary",
							className: "bg-leaf/10 text-leaf",
							children: "Đang hoạt động"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "outline",
							children: "Đã tắt"
						})
					]
				})
			}, t.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: dialogOpen,
			onOpenChange: setDialogOpen,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "sm:max-w-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: editing ? "Sửa bàn/vị trí" : "Thêm bàn/vị trí mới" }) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "table-name",
									children: "Tên bàn / vị trí"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "table-name",
									placeholder: "VD: Bàn 06 - Tầng 1",
									value: formName,
									onChange: (e) => setFormName(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Chi nhánh" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
									value: formStore,
									onValueChange: setFormStore,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
										className: "w-full",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: adminBranches.filter((b) => b.id !== "all").map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
										value: String(b.id),
										children: b.name
									}, b.id)) })]
								})]
							}),
							!editing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "bg-accent/40 text-accent-foreground rounded-lg p-2.5 text-xs",
								children: ["Mã QR bảo mật tự động sinh — URL: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "font-mono",
									children: "/menu?table_id=…"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => setDialogOpen(false),
						children: "Hủy"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: save,
						disabled: saving,
						children: saving ? "Đang lưu…" : editing ? "Cập nhật" : "Tạo bàn"
					})] })
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
			open: !!deleting,
			onOpenChange: (open) => !open && setDeleting(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
				"Xóa bàn \"",
				deleting?.name,
				"\"?"
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "Mã QR của bàn này sẽ không còn hoạt động. Hành động không thể hoàn tác." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Hủy" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
				className: "bg-berry text-berry-foreground hover:bg-berry/90",
				onClick: confirmDelete,
				children: "Xóa bàn"
			})] })] })
		})
	] });
}
//#endregion
export { TablesPage as component };
