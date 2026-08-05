import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.vi-tri-OANAIol3.js
var $$splitComponentImporter = () => import("./admin.vi-tri-B9G_XUQx.mjs");
var Route = createFileRoute("/admin/vi-tri")({
	validateSearch: (search) => ({ store_id: typeof search.store_id === "string" ? search.store_id : typeof search.store_id === "number" ? String(search.store_id) : void 0 }),
	head: () => ({ meta: [{ title: "Vị trí & Mã QR bàn | Admin" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
