import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/theo-doi-don-DjCbFQlj.js
var $$splitComponentImporter = () => import("./theo-doi-don-Cr8UCzrD.mjs");
var Route = createFileRoute("/theo-doi-don")({
	validateSearch: (search) => ({ code: typeof search.code === "string" ? search.code : void 0 }),
	head: () => ({ meta: [
		{ title: "Theo dõi đơn hàng real-time — Trà Trái Cây Tô" },
		{
			name: "description",
			content: "Xem trạng thái đơn trà theo thời gian thực: chờ xác nhận, đang pha chế, đang giao và hoàn tất."
		},
		{
			property: "og:title",
			content: "Theo dõi đơn hàng — Trà Trái Cây Tô"
		},
		{
			property: "og:description",
			content: "Biết chính xác ly trà của bạn đang ở đâu."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
