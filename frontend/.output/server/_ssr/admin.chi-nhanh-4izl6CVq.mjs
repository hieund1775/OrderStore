import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-CZwUJQdE.mjs";
import { t as Input } from "./input-Cs1vpLuO.mjs";
import { t as Badge } from "./badge-Csfx8X-2.mjs";
import { C as Plus, P as MapPin, R as LoaderCircle, T as Pencil, tt as Clock, w as Phone, y as Search } from "../_libs/lucide-react.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as apiPut, i as apiPost, n as apiGet } from "./api-CyIKtyVS.mjs";
import { n as CardContent, t as Card } from "./card-N78Fb1PV.mjs";
import { t as AdminPageHeader } from "./AdminUI-Dt3QtPdd.mjs";
import { t as Label } from "./label-Cn9N_lgh.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogTitle, i as DialogHeader, n as DialogContent, t as Dialog } from "./dialog-Di5jevJl.mjs";
import { t as Switch } from "./switch-BCfmMxEa.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DXom7Yjz.mjs";
import "./router-DxADvtwA.mjs";
import { n as parseHours, t as isStoreOpen } from "./store-hours-64-H3qhM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.chi-nhanh-4izl6CVq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ISO_CITY = {
	"VN-SG": "TP. Hồ Chí Minh",
	"VN-HN": "Hà Nội",
	"VN-DN": "Đà Nẵng",
	"VN-CT": "Cần Thơ",
	"VN-HP": "Hải Phòng",
	"VN-26": "Huế",
	"VN-34": "Nha Trang",
	"VN-58": "Bình Dương",
	"VN-39": "Đồng Nai",
	"VN-43": "Vũng Tàu",
	"VN-35": "Đà Lạt",
	"VN-13": "Quảng Ninh"
};
var CITY_DISTRICTS = {
	"TP. Hồ Chí Minh": [
		"Quận 1",
		"Quận 3",
		"Quận 7",
		"Quận Bình Thạnh",
		"TP. Thủ Đức",
		"Quận Tân Bình",
		"Quận Phú Nhuận",
		"Quận 10"
	],
	"Hà Nội": [
		"Hoàn Kiếm",
		"Ba Đình",
		"Đống Đa",
		"Cầu Giấy",
		"Hai Bà Trưng",
		"Thanh Xuân",
		"Tây Hồ"
	],
	"Đà Nẵng": [
		"Hải Châu",
		"Thanh Khê",
		"Sơn Trà",
		"Ngũ Hành Sơn",
		"Liên Chiểu"
	],
	"Huế": [
		"Thuận Hóa",
		"Phú Xuân",
		"Hương Thủy",
		"Hương Trà",
		"Phong Điền",
		"Quảng Điền",
		"A Lưới"
	],
	"Nha Trang": [
		"Vĩnh Hòa",
		"Lộc Thọ",
		"Phước Hải",
		"Ngọc Hiệp",
		"Phước Long",
		"Vĩnh Thọ",
		"Xương Huân"
	],
	"Đà Lạt": [
		"Phường 1",
		"Phường 2",
		"Phường 3",
		"Phường 4",
		"Phường 5",
		"Phường 6",
		"Phường 7"
	]
};
var DEFAULT_DISTRICTS = ["Quận Trung Tâm", "Quận 1"];
var CANONICAL_CITIES = Object.keys(ISO_CITY).map((k) => ISO_CITY[k]);
function parseAmenities(s) {
	if (!s) return [];
	try {
		const arr = JSON.parse(s);
		return Array.isArray(arr) ? arr.map(String) : [];
	} catch {
		return [];
	}
}
function vnd(n) {
	return n.toLocaleString("vi-VN") + "₫";
}
function storeMapUrl(s) {
	return s.lat != null && s.lng != null ? `https://maps.google.com/maps?q=${s.lat},${s.lng}&z=16&output=embed` : `https://maps.google.com/maps?q=${encodeURIComponent(`${s.address}, ${s.district}, ${s.city}`)}&z=16&output=embed`;
}
function fillFromPlace(place) {
	const a = place.address ?? {};
	const iso = a["ISO3166-2-lvl4"];
	const cleanLevel = (s) => s.replace(/^(Phường|Xã|Thị trấn)\s+/i, "");
	const city = (iso && ISO_CITY[iso] || a.state_district || a.state || a.city || "").replace(/^(Tỉnh|Thành phố|TP)\s+/i, "");
	const district = a.county || a.district || a.city_district || a.town || (a.suburb ? cleanLevel(a.suburb) : "") || "";
	return {
		city,
		district,
		address: [
			a.house_number,
			a.road,
			a.suburb || a.quarter,
			district,
			city
		].filter(Boolean).join(", ") || place.display_name || ""
	};
}
var PIN_HTML = "<div style=\"width:30px;height:30px;display:grid;place-items:center;font-size:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))\">📍</div>";
var MapPicker = (0, import_react.forwardRef)(function MapPicker({ lat, lng, onPicked }, ref) {
	const containerRef = (0, import_react.useRef)(null);
	const markerRef = (0, import_react.useRef)(null);
	const mapRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		let disposed = false;
		let cleanup;
		import("../_libs/leaflet.mjs").then((n) => /* @__PURE__ */ __toESM(n.t())).then(({ default: L }) => {
			if (disposed) return;
			const el = containerRef.current;
			if (!el) return;
			const map = L.map(el, {
				scrollWheelZoom: true,
				dragging: true,
				attributionControl: false,
				zoomControl: false
			});
			mapRef.current = map;
			L.control.zoom({ position: "bottomright" }).addTo(map);
			L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
			const icon = L.divIcon({
				className: "",
				html: PIN_HTML,
				iconSize: [30, 30],
				iconAnchor: [15, 30]
			});
			const place = (la, lo) => {
				if (markerRef.current) markerRef.current.setLatLng([la, lo]);
				else markerRef.current = L.marker([la, lo], { icon }).addTo(map);
				onPicked(la, lo);
			};
			if (lat != null && lng != null) {
				place(lat, lng);
				map.setView([lat, lng], 16);
			} else map.setView([10.776, 106.695], 12);
			const handleClick = (e) => place(e.latlng.lat, e.latlng.lng);
			map.on("click", handleClick);
			cleanup = () => {
				map.off("click", handleClick);
				map.remove();
				mapRef.current = null;
				markerRef.current = null;
			};
		});
		return () => {
			disposed = true;
			cleanup?.();
		};
	}, []);
	(0, import_react.useImperativeHandle)(ref, () => ({ setMarker(la, lo) {
		const map = mapRef.current;
		if (!map) return;
		if (markerRef.current) {
			markerRef.current.setLatLng([la, lo]);
			map.setView([la, lo], 16);
			return;
		}
		import("../_libs/leaflet.mjs").then((n) => /* @__PURE__ */ __toESM(n.t())).then(({ default: L }) => {
			if (mapRef.current !== map) return;
			markerRef.current = L.marker([la, lo], { icon: L.divIcon({
				className: "",
				html: PIN_HTML,
				iconSize: [30, 30],
				iconAnchor: [15, 30]
			}) }).addTo(map);
			map.setView([la, lo], 16);
		});
	} }), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative overflow-hidden rounded-xl border",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: containerRef,
			className: "z-0 h-72 w-full"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "bg-card/90 absolute top-2 left-2 rounded-lg px-2 py-1 text-[11px] text-muted-foreground shadow-card-soft",
			children: "Bấm vào bản đồ để chọn vị trí chi nhánh"
		})]
	});
});
function StoresAdminPage() {
	const [stores, setStores] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [adding, setAdding] = (0, import_react.useState)(false);
	const [now, setNow] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
	const [search, setSearch] = (0, import_react.useState)("");
	const [cityFilter, setCityFilter] = (0, import_react.useState)("all");
	const [mapStore, setMapStore] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const t = setInterval(() => setNow(/* @__PURE__ */ new Date()), 6e4);
		return () => clearInterval(t);
	}, []);
	const cities = Array.from(new Set(stores.map((s) => s.city)));
	const filteredStores = stores.filter((s) => {
		if (cityFilter !== "all" && s.city !== cityFilter) return false;
		const q = search.trim().toLowerCase();
		if (!q) return true;
		return `${s.name} ${s.address} ${s.district} ${s.city} ${s.phone}`.toLowerCase().includes(q);
	});
	const load = (0, import_react.useCallback)(async () => {
		setLoading(true);
		try {
			setStores(await apiGet("/admin/branches"));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Không tải được chi nhánh");
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		load();
	}, [load]);
	async function saveStore(payload, id) {
		try {
			if (id) {
				await apiPut(`/admin/branches/${id}`, payload);
				toast.success("Đã cập nhật chi nhánh");
			} else {
				await apiPost("/admin/branches", payload);
				toast.success("Đã tạo chi nhánh mới");
			}
			setEditing(null);
			setAdding(false);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lưu thất bại");
		}
	}
	async function toggleActive(s) {
		try {
			await apiPut(`/admin/branches/${s.id}`, {
				name: s.name,
				city: s.city,
				district: s.district,
				address: s.address,
				lat: s.lat,
				lng: s.lng,
				hours: s.hours,
				phone: s.phone,
				amenities: parseAmenities(s.amenities),
				is_active: s.is_active ? 0 : 1
			});
			toast.success(s.is_active ? "Đã đóng cửa chi nhánh" : "Đã mở cửa chi nhánh");
			setStores((prev) => prev.map((x) => x.id === s.id ? {
				...x,
				is_active: !x.is_active
			} : x));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPageHeader, {
			title: "Hệ thống cửa hàng",
			desc: `${stores.length} chi nhánh đang vận hành`,
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "hero",
				onClick: () => setAdding(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 size-4" }), " Thêm chi nhánh"]
			})
		}),
		loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex items-center justify-center py-20 text-muted-foreground",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex flex-col gap-3 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: search,
						onChange: (e) => setSearch(e.target.value),
						placeholder: "Tìm theo tên, địa chỉ, quận/huyện, SĐT...",
						className: "pl-9"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: cityFilter,
					onValueChange: setCityFilter,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
						className: "sm:w-56",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Lọc theo thành phố" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: "all",
						children: "Tất cả thành phố"
					}), cities.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: c,
						children: c
					}, c))] })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
				children: filteredStores.map((s) => {
					const open = s.is_active && isStoreOpen(s.hours, now);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "shadow-soft",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
							className: "p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-display font-bold",
										children: s.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-muted-foreground text-xs",
										children: [
											s.district,
											" · ",
											s.city
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										checked: s.is_active,
										onCheckedChange: () => toggleActive(s)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "text-muted-foreground mt-4 space-y-2 text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "text-primary mt-0.5 size-4 shrink-0" }),
												" ",
												s.address
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex items-center gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "text-primary mt-0.5 size-4 shrink-0" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "min-w-0 flex-1",
													children: s.hours
												}),
												open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
													variant: "outline",
													className: "border-emerald-200 bg-emerald-50 text-emerald-700",
													children: "🟢 Đang mở cửa"
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
													variant: "destructive",
													children: "🔴 Đã đóng cửa"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "text-primary mt-0.5 size-4 shrink-0" }),
												" ",
												s.phone
											]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-muted/50 mt-4 grid grid-cols-3 gap-2 rounded-xl p-3 text-center text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted-foreground",
											children: "Bàn"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-display mt-0.5 font-bold",
											children: s.table_count
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted-foreground",
											children: "Đơn hôm nay"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-display mt-0.5 font-bold",
											children: s.today_orders
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted-foreground",
											children: "Doanh thu hôm nay"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-display text-primary mt-0.5 font-bold",
											children: vnd(s.today_revenue)
										})] })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-4 flex flex-wrap gap-2",
									children: parseAmenities(s.amenities).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: "secondary",
										children: a
									}, a))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 grid grid-cols-2 gap-2 border-t pt-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "soft",
											size: "sm",
											onClick: () => setEditing(s),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "mr-1 size-4" }), " Chỉnh sửa"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											asChild: true,
											variant: "outline",
											size: "sm",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
												to: "/admin/vi-tri",
												search: { store_id: String(s.id) },
												children: "🪑 Quản lý bàn"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "outline",
											size: "sm",
											onClick: () => setMapStore(s),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "mr-1 size-4" }), " Xem bản đồ"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											asChild: true,
											variant: "outline",
											size: "sm",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
												to: "/admin/bao-cao",
												children: "Xem doanh thu"
											})
										})
									]
								})
							]
						})
					}, s.id);
				})
			}),
			filteredStores.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground py-10 text-center text-sm",
				children: "Không tìm thấy chi nhánh phù hợp"
			})
		] }),
		(adding || editing) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StoreFormDialog, {
			store: editing,
			onSave: (payload) => saveStore(payload, editing?.id),
			onClose: () => {
				setEditing(null);
				setAdding(false);
			}
		}, editing?.id ?? "new"),
		mapStore && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: true,
			onOpenChange: (o) => !o && setMapStore(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-3xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: ["Bản đồ: ", mapStore.name] }) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-hidden rounded-xl border",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
							title: `Bản đồ ${mapStore.name}`,
							src: storeMapUrl(mapStore),
							className: "h-[420px] w-full border-0",
							loading: "lazy",
							allowFullScreen: true,
							referrerPolicy: "no-referrer-when-downgrade"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-muted-foreground text-sm",
						children: [
							mapStore.address,
							", ",
							mapStore.district,
							", ",
							mapStore.city,
							" · ",
							mapStore.hours
						]
					})
				]
			})
		})
	] });
}
function StoreFormDialog({ store, onSave, onClose }) {
	const initialHours = store ? parseHours(store.hours) : {
		open: "07:00",
		close: "22:00"
	};
	const [name, setName] = (0, import_react.useState)(store?.name ?? "");
	const [phone, setPhone] = (0, import_react.useState)(store?.phone ?? "");
	const [openTime, setOpenTime] = (0, import_react.useState)(initialHours.open);
	const [closeTime, setCloseTime] = (0, import_react.useState)(initialHours.close);
	const [city, setCity] = (0, import_react.useState)(store?.city ?? "");
	const [district, setDistrict] = (0, import_react.useState)(store?.district ?? "");
	const [address, setAddress] = (0, import_react.useState)(store?.address ?? "");
	const [lat, setLat] = (0, import_react.useState)(store?.lat ?? null);
	const [lng, setLng] = (0, import_react.useState)(store?.lng ?? null);
	const [amenities, setAmenities] = (0, import_react.useState)(parseAmenities(store?.amenities ?? null).join(", "));
	const [isActive, setIsActive] = (0, import_react.useState)(store?.is_active ?? true);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const mapHandle = (0, import_react.useRef)(null);
	const [query, setQuery] = (0, import_react.useState)(store?.address ?? "");
	const [results, setResults] = (0, import_react.useState)([]);
	const [searching, setSearching] = (0, import_react.useState)(false);
	const [showResults, setShowResults] = (0, import_react.useState)(false);
	const searchTimer = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => () => {
		if (searchTimer.current) clearTimeout(searchTimer.current);
	}, []);
	async function searchAddress(q) {
		if (q.trim().length < 3) {
			setResults([]);
			setSearching(false);
			return;
		}
		setSearching(true);
		try {
			const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=vn&q=${encodeURIComponent(q)}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error("Không tra cứu được bản đồ");
			const list = await res.json();
			const arr = Array.isArray(list) ? list : [];
			setResults(arr);
			setShowResults(true);
			const first = arr[0];
			if (first) {
				const la = Number(first.lat ?? NaN);
				const lo = Number(first.lon ?? NaN);
				if (Number.isFinite(la) && Number.isFinite(lo)) mapHandle.current?.setMarker(la, lo);
			}
		} catch {
			setResults([]);
		} finally {
			setSearching(false);
		}
	}
	function handleQueryChange(v) {
		setQuery(v);
		if (searchTimer.current) clearTimeout(searchTimer.current);
		searchTimer.current = setTimeout(() => searchAddress(v), 400);
	}
	function handlePickResult(r) {
		const la = Number(r.lat ?? NaN);
		const lo = Number(r.lon ?? NaN);
		if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
		setLat(la);
		setLng(lo);
		const filled = fillFromPlace(r);
		setCity(filled.city);
		setDistrict(filled.district);
		setAddress(filled.address);
		setQuery(r.display_name ?? filled.address);
		setShowResults(false);
		mapHandle.current?.setMarker(la, lo);
	}
	async function handleMapPick(la, lo) {
		setLat(la);
		setLng(lo);
		try {
			const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}`);
			if (!res.ok) return;
			const filled = fillFromPlace(await res.json());
			setCity(filled.city);
			setDistrict(filled.district);
			setAddress(filled.address);
			setQuery(filled.address);
		} catch {}
	}
	async function handleSave() {
		if (!name.trim() || !phone.trim() || !city.trim() || !district.trim() || !address.trim()) return toast.error("Vui lòng nhập đầy đủ tên, SĐT, thành phố, quận/huyện và địa chỉ");
		if (!openTime || !closeTime) return toast.error("Vui lòng chọn giờ mở cửa và giờ đóng cửa");
		setSaving(true);
		try {
			onSave({
				name: name.trim(),
				city: city.trim(),
				district: district.trim(),
				address: address.trim(),
				lat,
				lng,
				hours: `${openTime} – ${closeTime}`,
				phone: phone.trim(),
				amenities: amenities.split(",").map((a) => a.trim()).filter(Boolean),
				is_active: isActive ? 1 : 0
			});
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open: true,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-h-[90vh] max-w-2xl overflow-y-auto",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: store ? `Chỉnh sửa chi nhánh: ${store.name}` : "Thêm chi nhánh mới" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: query,
								onChange: (e) => handleQueryChange(e.target.value),
								onFocus: () => results.length > 0 && setShowResults(true),
								onBlur: () => setTimeout(() => setShowResults(false), 150),
								placeholder: "Tìm địa chỉ, đường, quận/huyện... (VD: 123 Nguyễn Trãi, Quận 1)",
								className: "pl-9"
							}),
							searching && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" }),
							showResults && results.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "bg-background absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border shadow-lg",
								children: results.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onMouseDown: (e) => {
										e.preventDefault();
										handlePickResult(r);
									},
									className: "text-muted-foreground hover:bg-muted flex w-full items-start gap-2 px-3 py-2 text-left text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "mt-0.5 size-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r.display_name })]
								}) }, i))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPicker, {
						ref: mapHandle,
						lat,
						lng,
						onPicked: handleMapPick
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Tên chi nhánh",
							value: name,
							onChange: setName
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Hotline",
							value: phone,
							onChange: setPhone
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Thành phố" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: city,
							onValueChange: async (val) => {
								setCity(val);
								setDistrict("");
								try {
									const data = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(val)}`)).json();
									if (data[0]) {
										const la = Number(data[0].lat);
										const lo = Number(data[0].lon);
										setLat(la);
										setLng(lo);
										mapHandle.current?.setMarker(la, lo);
									}
								} catch {}
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
								className: "mt-1.5 w-full",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Chọn Thành phố" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [CANONICAL_CITIES.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: c,
								children: c
							}, c)), city && !CANONICAL_CITIES.includes(city) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: city,
								children: city
							})] })]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Quận / Huyện" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: district,
							onValueChange: async (val) => {
								setDistrict(val);
								try {
									const queryStr = `${val}, ${city || "Việt Nam"}`;
									const data = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(queryStr)}`)).json();
									if (data[0]) {
										const la = Number(data[0].lat);
										const lo = Number(data[0].lon);
										setLat(la);
										setLng(lo);
										mapHandle.current?.setMarker(la, lo);
									}
								} catch {}
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
								className: "mt-1.5 w-full",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Chọn Quận / Huyện" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [(CITY_DISTRICTS[city] ?? DEFAULT_DISTRICTS).map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: d,
								children: d
							}, d)), district && !(CITY_DISTRICTS[city] ?? DEFAULT_DISTRICTS).includes(district) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: district,
								children: district
							})] })]
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Địa chỉ" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: address,
						onChange: (e) => setAddress(e.target.value),
						className: "mt-1.5"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Giờ mở cửa" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1.5 flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "time",
									value: openTime,
									onChange: (e) => setOpenTime(e.target.value)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: "→"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "time",
									value: closeTime,
									onChange: (e) => setCloseTime(e.target.value)
								})
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tiện ích (phân cách bằng dấu phẩy)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: amenities,
							onChange: (e) => setAmenities(e.target.value),
							placeholder: "Máy lạnh, Mua mang đi, Chỗ đỗ ô tô",
							className: "mt-1.5"
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center justify-between rounded-xl border p-3 text-sm",
						children: ["Đang hoạt động", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: isActive,
							onCheckedChange: setIsActive
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "hero",
						className: "w-full",
						onClick: handleSave,
						disabled: saving,
						children: saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : store ? "Lưu thay đổi" : "Tạo chi nhánh"
					})
				]
			})]
		})
	});
}
function Field({ label, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
		value,
		onChange: (e) => onChange(e.target.value),
		className: "mt-1.5"
	})] });
}
//#endregion
export { StoresAdminPage as component };
