import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PageHeader-4GMedA0k.js
var import_jsx_runtime = require_jsx_runtime();
function PageHeader({ eyebrow, title, desc }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "gradient-fresh border-b",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "container-page py-12 text-center md:py-16",
			children: [
				eyebrow && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-primary mb-2 text-xs font-bold tracking-[0.2em] uppercase",
					children: eyebrow
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl font-extrabold md:text-4xl",
					children: title
				}),
				desc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground mx-auto mt-3 max-w-2xl text-sm md:text-base",
					children: desc
				})
			]
		})
	});
}
//#endregion
export { PageHeader as t };
