import { createFileRoute, Link } from "@tanstack/react-router";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Clock, Loader2, MapPin, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { formatFullAddress } from "@/lib/data";
import { parseHours } from "@/lib/store-hours";

export const Route = createFileRoute("/admin/chi-nhanh")({
  head: () => ({
    meta: [
      { title: "Hệ thống cửa hàng | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Danh sách chi nhánh, giờ mở cửa và bật/tắt hoạt động từng cơ sở.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Hệ thống cửa hàng | Admin Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Quản lý chi nhánh, giờ hoạt động và trạng thái nhận đơn.",
      },
    ],
  }),
  component: StoresAdminPage,
});

type Store = {
  id: number;
  name: string;
  city: string;
  district: string;
  address: string;
  lat: number | null;
  lng: number | null;
  hours: string;
  phone: string;
  amenities: string | null;
  is_active: boolean;
  table_count: number;
  today_orders: number;
  today_revenue: number;
};

type StorePayload = {
  name: string;
  city: string;
  district: string;
  address: string;
  lat: number | null;
  lng: number | null;
  hours: string;
  phone: string;
  amenities: string[];
  is_active: number;
};

type NominatimPlace = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    quarter?: string;
    suburb?: string;
    town?: string;
    city?: string;
    county?: string;
    state?: string;
    state_district?: string;
    district?: string;
    city_district?: string;
    "ISO3166-2-lvl4"?: string;
  };
};

const ISO_CITY: Record<string, string> = {
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
  "VN-13": "Quảng Ninh",
};

const CITY_DISTRICTS: Record<string, string[]> = {
  "TP. Hồ Chí Minh": ["Quận 1", "Quận 3", "Quận 7", "Quận Bình Thạnh", "TP. Thủ Đức", "Quận Tân Bình", "Quận Phú Nhuận", "Quận 10"],
  "Hà Nội": ["Hoàn Kiếm", "Ba Đình", "Đống Đa", "Cầu Giấy", "Hai Bà Trưng", "Thanh Xuân", "Tây Hồ"],
  "Đà Nẵng": ["Hải Châu", "Thanh Khê", "Sơn Trà", "Ngũ Hành Sơn", "Liên Chiểu"],
  "Huế": ["Thuận Hóa", "Phú Xuân", "Hương Thủy", "Hương Trà", "Phong Điền", "Quảng Điền", "A Lưới"],
  "Nha Trang": ["Vĩnh Hòa", "Lộc Thọ", "Phước Hải", "Ngọc Hiệp", "Phước Long", "Vĩnh Thọ", "Xương Huân"],
  "Đà Lạt": ["Phường 1", "Phường 2", "Phường 3", "Phường 4", "Phường 5", "Phường 6", "Phường 7"],
};
const DEFAULT_DISTRICTS = ["Quận Trung Tâm", "Quận 1"];

const CANONICAL_CITIES = Object.keys(ISO_CITY).map((k) => ISO_CITY[k]);

function parseAmenities(s: string | null): string[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function vnd(n: number) {
  return n.toLocaleString("vi-VN") + "₫";
}

function storeMapUrl(s: Store) {
  return s.lat != null && s.lng != null
    ? `https://maps.google.com/maps?q=${s.lat},${s.lng}&z=16&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(formatFullAddress(s.address, s.district, s.city))}&z=16&output=embed`;
}

function fillFromPlace(place: NominatimPlace) {
  const a = place.address ?? {};
  const iso = a["ISO3166-2-lvl4"];
  const cleanLevel = (s: string) => s.replace(/^(Phường|Xã|Thị trấn)\s+/i, "");
  const rawCity = (iso && ISO_CITY[iso]) || a.state_district || a.state || a.city || "";
  // Nominatim VN trả "Tỉnh/Thành phố" prefix → bỏ để tên gọn, khớp dropdown
  const city = rawCity.replace(/^(Tỉnh|Thành phố|TP)\s+/i, "");
  // Nominatim VN thường không trả county/district mà trả suburb (Phường/Xã) hoặc town (huyện)
  const district =
    a.county ||
    a.district ||
    a.city_district ||
    a.town ||
    (a.suburb ? cleanLevel(a.suburb) : "") ||
    "";
  const address =
    [a.house_number, a.road, a.suburb || a.quarter, district, city].filter(Boolean).join(", ") ||
    place.display_name ||
    "";
  return { city, district, address };
}

const PIN_HTML =
  '<div style="width:30px;height:30px;display:grid;place-items:center;font-size:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">📍</div>';

type MapHandle = {
  setMarker: (lat: number, lng: number) => void;
};

const MapPicker = forwardRef<MapHandle, MapPickerProps>(function MapPicker(
  { lat, lng, onPicked },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("leaflet").then(({ default: L }) => {
      if (disposed) return;
      const el = containerRef.current;
      if (!el) return;

      const map = L.map(el, {
        scrollWheelZoom: true,
        dragging: true,
        attributionControl: false,
        zoomControl: false,
      });
      mapRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

      const icon = L.divIcon({
        className: "",
        html: PIN_HTML,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      const place = (la: number, lo: number) => {
        if (markerRef.current) markerRef.current.setLatLng([la, lo]);
        else markerRef.current = L.marker([la, lo], { icon }).addTo(map);
        onPicked(la, lo);
      };

      if (lat != null && lng != null) {
        place(lat, lng);
        map.setView([lat, lng], 16);
      } else {
        map.setView([10.776, 106.695], 12);
      }

      const handleClick = (e: L.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setMarker(la: number, lo: number) {
        const map = mapRef.current;
        if (!map) return;
        if (markerRef.current) {
          markerRef.current.setLatLng([la, lo]);
          map.setView([la, lo], 16);
          return;
        }
        void import("leaflet").then(({ default: L }) => {
          if (mapRef.current !== map) return;
          markerRef.current = L.marker([la, lo], {
            icon: L.divIcon({
              className: "",
              html: PIN_HTML,
              iconSize: [30, 30],
              iconAnchor: [15, 30],
            }),
          }).addTo(map);
          map.setView([la, lo], 16);
        });
      },
    }),
    [],
  );

  return (
    <div className="relative overflow-hidden rounded-xl border">
      <div ref={containerRef} className="z-0 h-72 w-full" />
      <p className="bg-card/90 absolute top-2 left-2 rounded-lg px-2 py-1 text-[11px] text-muted-foreground shadow-card-soft">
        Bấm vào bản đồ để chọn vị trí chi nhánh
      </p>
    </div>
  );
});

type MapPickerProps = {
  lat: number | null;
  lng: number | null;
  onPicked: (lat: number, lng: number) => void;
};

function StoresAdminPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Store | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [mapStore, setMapStore] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState<Store | null>(null);

  const cities = Array.from(new Set(stores.map((s) => s.city)));

  const filteredStores = stores.filter((s) => {
    if (cityFilter !== "all" && s.city !== cityFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${s.name} ${s.address} ${s.district} ${s.city} ${s.phone}`.toLowerCase().includes(q);
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<Store[]>("/admin/branches");
      setStores(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được chi nhánh");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveStore(payload: StorePayload, id?: number) {
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

  async function toggleActive(s: Store) {
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
        is_active: s.is_active ? 0 : 1,
      });
      toast.success(s.is_active ? "Đã đóng cửa chi nhánh" : "Đã mở cửa chi nhánh");
      setStores((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiDelete(`/admin/branches/${deleting.id}`);
      toast.success(`Đã xóa chi nhánh ${deleting.name}`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa chi nhánh thất bại");
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Hệ thống cửa hàng"
        desc={`${stores.length} chi nhánh đang vận hành`}
        actions={
          <Button variant="hero" onClick={() => setAdding(true)}>
            <Plus className="mr-1 size-4" /> Thêm chi nhánh
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên, địa chỉ, quận/huyện, SĐT..."
                className="pl-9"
              />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Lọc theo thành phố" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả thành phố</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredStores.map((s) => {
            return (
              <Card key={s.id} className="shadow-soft">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-bold">{s.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {s.district} · {s.city}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                    <Switch checked={Boolean(s.is_active)} onCheckedChange={() => toggleActive(s)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={() => setDeleting(s)}
                      aria-label={`Xóa chi nhánh ${s.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  </div>
                  <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
                    <li className="flex gap-2">
                      <MapPin className="text-primary mt-0.5 size-4 shrink-0" /> {formatFullAddress(s.address, s.district, s.city)}
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="text-primary mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1">{s.hours}</span>
                      {s.is_active ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          🟢 Đang mở cửa
                        </Badge>
                      ) : (
                        <Badge variant="destructive">🔴 Đã đóng cửa</Badge>
                      )}
                    </li>
                    <li className="flex gap-2">
                      <Phone className="text-primary mt-0.5 size-4 shrink-0" /> {s.phone}
                    </li>
                  </ul>
                  <div className="bg-muted/50 mt-4 grid grid-cols-3 gap-2 rounded-xl p-3 text-center text-xs">
                    <div>
                      <p className="text-muted-foreground">Bàn</p>
                      <p className="font-display mt-0.5 font-bold">{s.table_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Đơn hôm nay</p>
                      <p className="font-display mt-0.5 font-bold">{s.today_orders}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Doanh thu hôm nay</p>
                      <p className="font-display text-primary mt-0.5 font-bold">{vnd(s.today_revenue)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {parseAmenities(s.amenities).map((a) => (
                      <Badge key={a} variant="secondary">
                        {a}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                    <Button variant="soft" size="sm" onClick={() => setEditing(s)}>
                      <Pencil className="mr-1 size-4" /> Chỉnh sửa
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/admin/vi-tri" search={{ store_id: String(s.id) }}>
                        🪑 Quản lý bàn
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setMapStore(s)}>
                      <MapPin className="mr-1 size-4" /> Xem bản đồ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
          {filteredStores.length === 0 && (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Không tìm thấy chi nhánh phù hợp
            </p>
          )}
        </>
      )}

      {(adding || editing) && (
        <StoreFormDialog
          key={editing?.id ?? "new"}
          store={editing}
          onSave={(payload) => saveStore(payload, editing?.id)}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
        />
      )}

      {mapStore && (
        <Dialog open onOpenChange={(o) => !o && setMapStore(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Bản đồ: {mapStore.name}</DialogTitle>
            </DialogHeader>
            <div className="overflow-hidden rounded-xl border">
              <iframe
                title={`Bản đồ ${mapStore.name}`}
                src={storeMapUrl(mapStore)}
                className="h-[420px] w-full border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <p className="text-muted-foreground text-sm">
              {formatFullAddress(mapStore.address, mapStore.district, mapStore.city)} · {mapStore.hours}
            </p>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa chi nhánh "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Các bàn của chi nhánh này sẽ bị xóa theo. Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-berry text-berry-foreground hover:bg-berry/90"
              onClick={confirmDelete}
            >
              Xóa chi nhánh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StoreFormDialog({
  store,
  onSave,
  onClose,
}: {
  store: Store | null;
  onSave: (payload: StorePayload) => void;
  onClose: () => void;
}) {
  const initialHours = store ? parseHours(store.hours) : { open: "07:00", close: "22:00" };
  const [name, setName] = useState(store?.name ?? "");
  const [phone, setPhone] = useState(store?.phone ?? "");
  const [openTime, setOpenTime] = useState(initialHours.open);
  const [closeTime, setCloseTime] = useState(initialHours.close);
  const [city, setCity] = useState(store?.city ?? "");
  const [district, setDistrict] = useState(store?.district ?? "");
  const [address, setAddress] = useState(store?.address ?? "");
  const [lat, setLat] = useState<number | null>(store?.lat ?? null);
  const [lng, setLng] = useState<number | null>(store?.lng ?? null);
  const [amenities, setAmenities] = useState(parseAmenities(store?.amenities ?? null).join(", "));
  const [isActive, setIsActive] = useState(store ? Boolean(store.is_active) : true);
  const [saving, setSaving] = useState(false);

  const mapHandle = useRef<MapHandle>(null);
  const [query, setQuery] = useState(store?.address ?? "");
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  async function searchAddress(q: string) {
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
      const list = (await res.json()) as NominatimPlace[];
      const arr = Array.isArray(list) ? list : [];
      setResults(arr);
      setShowResults(true);
      // Dù không chọn gì trong list, vẫn cho marker nhảy tới kết quả gần đúng nhất
      const first = arr[0];
      if (first) {
        const la = Number(first.lat ?? NaN);
        const lo = Number(first.lon ?? NaN);
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          mapHandle.current?.setMarker(la, lo);
        }
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchAddress(v), 400);
  }

  function handlePickResult(r: NominatimPlace) {
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

  async function handleMapPick(la: number, lo: number) {
    setLat(la);
    setLng(lo);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}`,
      );
      if (!res.ok) return;
      const place = (await res.json()) as NominatimPlace;
      const filled = fillFromPlace(place);
      setCity(filled.city);
      setDistrict(filled.district);
      setAddress(filled.address);
      setQuery(filled.address);
    } catch {
      /* không reverse được — người dùng tự nhập */
    }
  }

  async function handleSave() {
    if (!name.trim() || !phone.trim() || !city.trim() || !district.trim() || !address.trim()) {
      return toast.error("Vui lòng nhập đầy đủ tên, SĐT, thành phố, quận/huyện và địa chỉ");
    }
    if (!openTime || !closeTime) {
      return toast.error("Vui lòng chọn giờ mở cửa và giờ đóng cửa");
    }
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
        is_active: isActive ? 1 : 0,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{store ? `Chỉnh sửa chi nhánh: ${store.name}` : "Thêm chi nhánh mới"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              placeholder="Tìm địa chỉ, đường, quận/huyện... (VD: 123 Nguyễn Trãi, Quận 1)"
              className="pl-9"
            />
            {searching && (
              <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
            )}
            {showResults && results.length > 0 && (
              <ul className="bg-background absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border shadow-lg">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePickResult(r);
                      }}
                      className="text-muted-foreground hover:bg-muted flex w-full items-start gap-2 px-3 py-2 text-left text-sm"
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0" />
                      <span>{r.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <MapPicker ref={mapHandle} lat={lat} lng={lng} onPicked={handleMapPick} />

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tên chi nhánh" value={name} onChange={setName} />
            <Field label="Hotline" value={phone} onChange={setPhone} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Thành phố</Label>
              <Select
                value={city}
                onValueChange={async (val) => {
                  setCity(val);
                  setDistrict("");
                  // Tự động xoay bản đồ về trung tâm Thành phố
                  try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(val)}`);
                    const data = await res.json();
                    if (data[0]) {
                      const la = Number(data[0].lat);
                      const lo = Number(data[0].lon);
                      setLat(la); setLng(lo);
                      mapHandle.current?.setMarker(la, lo);
                    }
                  } catch {}
                }}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue placeholder="Chọn Thành phố" />
                </SelectTrigger>
                <SelectContent>
                  {CANONICAL_CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  {city && !CANONICAL_CITIES.includes(city) && (
                    <SelectItem value={city}>{city}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quận / Huyện</Label>
              <Select
                value={district}
                onValueChange={async (val) => {
                  setDistrict(val);
                  // Tự động xoay bản đồ về Quận/Huyện
                  try {
                    const queryStr = `${val}, ${city || "Việt Nam"}`;
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(queryStr)}`);
                    const data = await res.json();
                    if (data[0]) {
                      const la = Number(data[0].lat);
                      const lo = Number(data[0].lon);
                      setLat(la); setLng(lo);
                      mapHandle.current?.setMarker(la, lo);
                    }
                  } catch {}
                }}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue placeholder="Chọn Quận / Huyện" />
                </SelectTrigger>
                <SelectContent>
                  {(CITY_DISTRICTS[city] ?? DEFAULT_DISTRICTS).map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                  {district &&
                    !(CITY_DISTRICTS[city] ?? DEFAULT_DISTRICTS).includes(district) && (
                      <SelectItem value={district}>{district}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Địa chỉ</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1.5" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Giờ mở cửa</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
                <span className="text-muted-foreground">→</span>
                <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Tiện ích (phân cách bằng dấu phẩy)</Label>
              <Input
                value={amenities}
                onChange={(e) => setAmenities(e.target.value)}
                placeholder="Máy lạnh, Mua mang đi, Chỗ đỗ ô tô"
                className="mt-1.5"
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
            Đang hoạt động
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>

          <Button variant="hero" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : store ? "Lưu thay đổi" : "Tạo chi nhánh"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5" />
    </div>
  );
}