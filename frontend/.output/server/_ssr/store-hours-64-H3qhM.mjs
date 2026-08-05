//#region node_modules/.nitro/vite/services/ssr/assets/store-hours-64-H3qhM.js
function parseHours(h) {
	const m = h.match(/\d{1,2}:\d{2}/g);
	return {
		open: m?.[0] ?? "07:00",
		close: m?.[1] ?? "22:00"
	};
}
function toMinutes(t) {
	const [h, min] = t.split(":").map(Number);
	return Number.isFinite(h) && Number.isFinite(min) ? h * 60 + min : 0;
}
function isStoreOpen(hours, now = /* @__PURE__ */ new Date()) {
	const { open, close } = parseHours(hours);
	const nowMin = now.getHours() * 60 + now.getMinutes();
	const openMin = toMinutes(open);
	const closeMin = toMinutes(close);
	return nowMin >= openMin && nowMin <= closeMin;
}
//#endregion
export { parseHours as n, isStoreOpen as t };
