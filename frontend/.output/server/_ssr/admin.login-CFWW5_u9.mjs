import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { B as Leaf, I as Lock, vt as ArrowRight, w as Phone } from "../_libs/lucide-react.mjs";
import { n as brand } from "./data-Z_klJ5jj.mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as apiPost, s as setToken } from "./api-Cnar3gwH.mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.login-CFWW5_u9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdminLogin() {
	const navigate = useNavigate();
	const [phone, setPhone] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	async function onSubmit(e) {
		e.preventDefault();
		if (!phone || !password) {
			toast.error("Vui lòng nhập số điện thoại và mật khẩu");
			return;
		}
		setLoading(true);
		try {
			const res = await apiPost("/admin/login", {
				phone,
				password
			});
			setToken(res.token);
			toast.success(`Xin chào ${res.user.fullname}`);
			navigate({ to: "/admin" });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Đăng nhập thất bại");
		} finally {
			setLoading(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_right,rgba(255,159,67,0.14),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(74,176,86,0.12),transparent_60%)] px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "bg-card w-full max-w-md rounded-3xl border p-8 shadow-card-soft",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-8 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "gradient-warm mx-auto flex size-14 items-center justify-center rounded-2xl text-2xl shadow-glow",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Leaf, { className: "text-primary-foreground size-7" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
							className: "font-display mt-4 text-2xl font-extrabold",
							children: [
								"Trà Trái Cây ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-primary",
									children: "Tô"
								}),
								" Admin"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground mt-1 text-sm",
							children: "Đăng nhập để quản lý hệ thống"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit,
					className: "space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "phone",
								children: "Số điện thoại"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "phone",
									placeholder: "0900 000 001",
									value: phone,
									onChange: (e) => setPhone(e.target.value),
									className: "h-11 rounded-xl pl-9",
									autoComplete: "username",
									inputMode: "tel"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "password",
								children: "Mật khẩu"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "password",
									type: "password",
									placeholder: "••••••••",
									value: password,
									onChange: (e) => setPassword(e.target.value),
									className: "h-11 rounded-xl pl-9",
									autoComplete: "current-password"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "submit",
							size: "lg",
							className: "w-full rounded-xl",
							disabled: loading,
							children: [loading ? "Đang đăng nhập…" : "Đăng nhập", !loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-muted-foreground mt-6 text-center text-xs",
					children: [
						brand.name,
						" · ",
						brand.hotline
					]
				})
			]
		})
	});
}
//#endregion
export { AdminLogin as component };
