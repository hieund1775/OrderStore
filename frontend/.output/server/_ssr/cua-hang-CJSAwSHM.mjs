import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { A as Navigation, L as LocateFixed, P as MapPin, R as LoaderCircle, h as ShoppingBag, nt as Clock, w as Phone } from "../_libs/lucide-react.mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as apiGet } from "./api-Cnar3gwH.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DXom7Yjz.mjs";
import { t as PageHeader } from "./PageHeader-4GMedA0k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cua-hang-CJSAwSHM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CITY_CENTERS = {
	"TP. Hồ Chí Minh": {
		lat: 10.776,
		lng: 106.695,
		name: "Trung tâm TP. Hồ Chí Minh"
	},
	"Hà Nội": {
		lat: 21.0285,
		lng: 105.854,
		name: "Trung tâm Thủ đô Hà Nội"
	},
	"Đà Nẵng": {
		lat: 16.067,
		lng: 108.221,
		name: "Trung tâm Thành phố Đà Nẵng"
	},
	"Cần Thơ": {
		lat: 10.037,
		lng: 105.783,
		name: "Trung tâm TP. Cần Thơ"
	},
	"Hải Phòng": {
		lat: 20.845,
		lng: 106.688,
		name: "Trung tâm TP. Hải Phòng"
	},
	"Huế": {
		lat: 16.4637,
		lng: 107.5909,
		name: "Trung tâm TP. Huế"
	},
	"Nha Trang": {
		lat: 12.2388,
		lng: 109.1967,
		name: "Trung tâm TP. Nha Trang"
	},
	"Bình Dương": {
		lat: 10.9804,
		lng: 106.6519,
		name: "Trung tâm Bình Dương"
	},
	"Đồng Nai": {
		lat: 10.9574,
		lng: 106.8426,
		name: "Trung tâm Đồng Nai"
	},
	"Vũng Tàu": {
		lat: 10.3461,
		lng: 107.0843,
		name: "Trung tâm TP. Vũng Tàu"
	},
	"Đà Lạt": {
		lat: 11.9465,
		lng: 108.4419,
		name: "Trung tâm TP. Đà Lạt"
	},
	"Quảng Ninh": {
		lat: 20.9101,
		lng: 107.1839,
		name: "Trung tâm Quảng Ninh"
	}
};
function parseAmenities(s) {
	if (!s) return [];
	try {
		const arr = JSON.parse(s);
		return Array.isArray(arr) ? arr.map(String) : [];
	} catch {
		return [];
	}
}
function haversineKm(lat1, lon1, lat2, lon2) {
	const R = 6371;
	const toRad = (d) => d * Math.PI / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
}
function mapQuery(s) {
	return s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : encodeURIComponent(s.address);
}
function StoresPage() {
	const navigate = useNavigate();
	const [stores, setStores] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [city, setCity] = (0, import_react.useState)("all");
	const [district, setDistrict] = (0, import_react.useState)("all");
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [mapCoords, setMapCoords] = (0, import_react.useState)({
		lat: 10.776,
		lng: 106.695,
		title: "TP. Hồ Chí Minh"
	});
	const [locating, setLocating] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		apiGet("/api/stores").then((rows) => {
			if (cancelled) return;
			setStores(rows);
			if (rows[0]) {
				setSelectedId(rows[0].id);
				if (rows[0].lat != null && rows[0].lng != null) setMapCoords({
					lat: rows[0].lat,
					lng: rows[0].lng,
					title: rows[0].name
				});
			}
		}).catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được cửa hàng")).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	const cities = Array.from(new Set(stores.map((s) => s.city)));
	const districts = Array.from(new Set(stores.filter((s) => city === "all" || s.city === city).map((s) => s.district)));
	const handleCityChange = (newCity) => {
		setCity(newCity);
		setDistrict("all");
		if (newCity !== "all" && CITY_CENTERS[newCity]) {
			const center = CITY_CENTERS[newCity];
			setMapCoords({
				lat: center.lat,
				lng: center.lng,
				title: center.name
			});
			const storeInCity = stores.find((s) => s.city === newCity);
			if (storeInCity) setSelectedId(storeInCity.id);
		} else if (stores[0]) {
			setSelectedId(stores[0].id);
			if (stores[0].lat != null && stores[0].lng != null) setMapCoords({
				lat: stores[0].lat,
				lng: stores[0].lng,
				title: stores[0].name
			});
		}
	};
	const handleDistrictChange = (newDistrict) => {
		setDistrict(newDistrict);
		if (newDistrict !== "all") {
			const storeInDistrict = stores.find((s) => (city === "all" || s.city === city) && s.district === newDistrict);
			if (storeInDistrict) {
				setSelectedId(storeInDistrict.id);
				if (storeInDistrict.lat != null && storeInDistrict.lng != null) setMapCoords({
					lat: storeInDistrict.lat,
					lng: storeInDistrict.lng,
					title: storeInDistrict.name
				});
			}
		}
	};
	const handleSelectStore = (s) => {
		setSelectedId(s.id);
		if (s.lat != null && s.lng != null) setMapCoords({
			lat: s.lat,
			lng: s.lng,
			title: s.name
		});
	};
	const list = (0, import_react.useMemo)(() => stores.filter((s) => (city === "all" || s.city === city) && (district === "all" || s.district === district)), [
		stores,
		city,
		district
	]);
	const selected = stores.find((s) => s.id === selectedId) ?? list[0] ?? null;
	function findNearest() {
		if (!("geolocation" in navigator)) return toast.error("Trình duyệt của bạn không hỗ trợ định vị");
		setLocating(true);
		navigator.geolocation.getCurrentPosition((pos) => {
			const { latitude, longitude } = pos.coords;
			const nearest = stores.filter((s) => s.lat != null && s.lng != null).sort((a, b) => haversineKm(latitude, longitude, Number(a.lat), Number(a.lng)) - haversineKm(latitude, longitude, Number(b.lat), Number(b.lng)))[0];
			setLocating(false);
			if (!nearest) return toast.error("Chưa có chi nhánh nào có tọa độ để tính khoảng cách");
			handleSelectStore(nearest);
			const km = haversineKm(latitude, longitude, Number(nearest.lat), Number(nearest.lng));
			toast.success(`Chi nhánh gần bạn nhất: ${nearest.name} (${km.toFixed(1)} km)`);
		}, () => {
			setLocating(false);
			toast.error("Không xác định được vị trí — hãy cho phép quyền truy cập vị trí");
		}, {
			enableHighAccuracy: true,
			timeout: 1e4
		});
	}
	function orderFrom(s) {
		if (!s.is_active) return toast.error(`${s.name} đang tạm đóng cửa — hãy chọn chi nhánh khác`);
		sessionStorage.setItem("teaplus_store_id", String(s.id));
		toast.success(`Đã chọn chi nhánh ${s.name} — thêm món và thanh toán nhé!`);
		navigate({ to: "/menu" });
	}
	const mapIframeUrl = (0, import_react.useMemo)(() => {
		if (mapCoords.lat != null && mapCoords.lng != null) return `https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
		if (selected) return `https://maps.google.com/maps?q=${mapQuery(selected)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
		return `https://maps.google.com/maps?q=TP.+H%E1%BB%93+Ch%C3%AD+Minh&t=&z=12&ie=UTF8&iwloc=&output=embed`;
	}, [mapCoords, selected]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Cửa hàng & Google Maps",
		title: "Hệ thống chi nhánh",
		desc: "Chọn khu vực hoặc bật định vị để tìm tiệm trà gần bạn nhất trên bản đồ Google Maps."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "container-page grid gap-6 py-10 lg:grid-cols-[380px_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card space-y-3 rounded-2xl border p-4 shadow-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: city,
						onValueChange: handleCityChange,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							className: "w-full",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Tỉnh / Thành phố" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "all",
							children: "Tất cả tỉnh / thành"
						}), cities.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: c,
							children: c
						}, c))] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: district,
						onValueChange: handleDistrictChange,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							className: "w-full",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Quận / Huyện" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "all",
							children: "Tất cả quận / huyện"
						}), districts.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: d,
							children: d
						}, d))] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "leaf",
						className: "w-full font-semibold",
						onClick: findNearest,
						disabled: locating,
						children: [locating ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocateFixed, { className: "size-4" }), "Tìm chi nhánh gần tôi nhất (GPS)"]
					})
				]
			}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-center justify-center py-16 text-muted-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-h-[580px] space-y-3 overflow-y-auto pr-1",
				children: [list.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					onClick: () => handleSelectStore(s),
					className: `bg-card cursor-pointer rounded-2xl border p-4 transition-all ${selectedId === s.id ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border hover:border-primary/50"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display font-bold",
							children: s.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground mt-1 flex items-start gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "text-primary mt-0.5 size-4 shrink-0" }),
								" ",
								s.address
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground mt-1 flex items-center gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "text-primary size-4 shrink-0" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "min-w-0 flex-1",
									children: s.hours
								}),
								s.is_active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: "outline",
									className: "border-emerald-200 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium",
									children: "🟢 Đang mở cửa"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: "destructive",
									className: "rounded-full text-[11px] font-medium",
									children: "🔴 Đã đóng cửa"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground mt-1 flex items-center gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "text-primary size-4 shrink-0" }),
								" ",
								s.phone
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex flex-wrap gap-1.5",
							children: parseAmenities(s.amenities).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								className: "rounded-full text-[11px] font-normal",
								children: a
							}, a))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "outline",
								size: "sm",
								className: "flex-1",
								onClick: (e) => {
									e.stopPropagation();
									window.open(`https://www.google.com/maps/dir/?api=1&destination=${mapQuery(s)}`, "_blank", "noopener");
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "size-4" }), " Google Maps"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "hero",
								size: "sm",
								className: "flex-1",
								disabled: !s.is_active,
								onClick: (e) => {
									e.stopPropagation();
									orderFrom(s);
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShoppingBag, { className: "size-4" }),
									" ",
									s.is_active ? "Đặt món" : "Tạm đóng cửa"
								]
							})]
						})
					]
				}, s.id)), list.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground py-10 text-center text-sm",
					children: "Không có chi nhánh nào trong khu vực này"
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3",
			children: [selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "text-primary size-5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display font-bold text-sm truncate",
							children: mapCoords.title || selected.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-xs truncate",
							children: selected.address
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: `https://www.google.com/maps/dir/?api=1&destination=${mapQuery(selected)}`,
					target: "_blank",
					rel: "noopener noreferrer",
					className: "shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "hero",
						size: "sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "size-4" }), " Mở Google Maps"]
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative min-h-[480px] flex-1 overflow-hidden rounded-2xl border shadow-md",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
					title: `Bản đồ ${mapCoords.title}`,
					src: mapIframeUrl,
					className: "h-full min-h-[480px] w-full border-0",
					loading: "lazy",
					allowFullScreen: true,
					referrerPolicy: "no-referrer-when-downgrade"
				})
			})]
		})]
	})] });
}
//#endregion
export { StoresPage as component };
