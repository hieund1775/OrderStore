import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, Loader2, LocateFixed, MapPin, Navigation, Phone, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/site/PageHeader";
import { apiGet } from "@/lib/api";

export const Route = createFileRoute("/cua-hang")({
  head: () => ({
    meta: [
      { title: "Hệ thống cửa hàng & Google Maps — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Tìm chi nhánh Trà Trái Cây Tô gần bạn với bản đồ Google Maps tương tác, địa chỉ, giờ mở cửa và chỉ đường nhanh.",
      },
      { property: "og:title", content: "Hệ thống cửa hàng — Trà Trái Cây Tô" },
      { property: "og:description", content: "Tìm chi nhánh gần nhất trên bản đồ Google Maps tương tác." },
    ],
  }),
  component: StoresPage,
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
};

const CITY_CENTERS: Record<string, { lat: number; lng: number; name: string }> = {
  "TP. Hồ Chí Minh": { lat: 10.776, lng: 106.695, name: "Trung tâm TP. Hồ Chí Minh" },
  "Hà Nội": { lat: 21.0285, lng: 105.854, name: "Trung tâm Thủ đô Hà Nội" },
  "Đà Nẵng": { lat: 16.067, lng: 108.221, name: "Trung tâm Thành phố Đà Nẵng" },
  "Cần Thơ": { lat: 10.037, lng: 105.783, name: "Trung tâm TP. Cần Thơ" },
  "Hải Phòng": { lat: 20.845, lng: 106.688, name: "Trung tâm TP. Hải Phòng" },
  "Huế": { lat: 16.4637, lng: 107.5909, name: "Trung tâm TP. Huế" },
  "Nha Trang": { lat: 12.2388, lng: 109.1967, name: "Trung tâm TP. Nha Trang" },
  "Bình Dương": { lat: 10.9804, lng: 106.6519, name: "Trung tâm Bình Dương" },
  "Đồng Nai": { lat: 10.9574, lng: 106.8426, name: "Trung tâm Đồng Nai" },
  "Vũng Tàu": { lat: 10.3461, lng: 107.0843, name: "Trung tâm TP. Vũng Tàu" },
  "Đà Lạt": { lat: 11.9465, lng: 108.4419, name: "Trung tâm TP. Đà Lạt" },
  "Quảng Ninh": { lat: 20.9101, lng: 107.1839, name: "Trung tâm Quảng Ninh" },
};

function parseAmenities(s: string | null): string[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function mapQuery(s: Store) {
  return s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : encodeURIComponent(s.address);
}

function StoresPage() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("all");
  const [district, setDistrict] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapCoords, setMapCoords] = useState<{ lat: number | null; lng: number | null; title: string }>({
    lat: 10.776,
    lng: 106.695,
    title: "TP. Hồ Chí Minh",
  });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<Store[]>("/api/stores")
      .then((rows) => {
        if (cancelled) return;
        setStores(rows);
        if (rows[0]) {
          setSelectedId(rows[0].id);
          if (rows[0].lat != null && rows[0].lng != null) {
            setMapCoords({ lat: rows[0].lat, lng: rows[0].lng, title: rows[0].name });
          }
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được cửa hàng"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cities = Array.from(new Set(stores.map((s) => s.city)));
  const districts = Array.from(
    new Set(stores.filter((s) => city === "all" || s.city === city).map((s) => s.district)),
  );

  // Xử lý đổi Thành phố ở Dropdown -> Bản đồ tự bay về trung tâm Thành phố đó
  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    setDistrict("all");
    if (newCity !== "all" && CITY_CENTERS[newCity]) {
      const center = CITY_CENTERS[newCity];
      setMapCoords({ lat: center.lat, lng: center.lng, title: center.name });
      const storeInCity = stores.find((s) => s.city === newCity);
      if (storeInCity) {
        setSelectedId(storeInCity.id);
      }
    } else if (stores[0]) {
      setSelectedId(stores[0].id);
      if (stores[0].lat != null && stores[0].lng != null) {
        setMapCoords({ lat: stores[0].lat, lng: stores[0].lng, title: stores[0].name });
      }
    }
  };

  // Xử lý đổi Quận/Huyện ở Dropdown -> Bản đồ tự bay về chi nhánh thuộc Quận đó
  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    if (newDistrict !== "all") {
      const storeInDistrict = stores.find(
        (s) => (city === "all" || s.city === city) && s.district === newDistrict,
      );
      if (storeInDistrict) {
        setSelectedId(storeInDistrict.id);
        if (storeInDistrict.lat != null && storeInDistrict.lng != null) {
          setMapCoords({ lat: storeInDistrict.lat, lng: storeInDistrict.lng, title: storeInDistrict.name });
        }
      }
    }
  };

  // Click chọn cửa hàng cụ thể
  const handleSelectStore = (s: Store) => {
    setSelectedId(s.id);
    if (s.lat != null && s.lng != null) {
      setMapCoords({ lat: s.lat, lng: s.lng, title: s.name });
    }
  };

  const list = useMemo(
    () =>
      stores.filter(
        (s) =>
          (city === "all" || s.city === city) && (district === "all" || s.district === district),
      ),
    [stores, city, district],
  );

  const selected = stores.find((s) => s.id === selectedId) ?? list[0] ?? null;

  function findNearest() {
    if (!("geolocation" in navigator)) {
      return toast.error("Trình duyệt của bạn không hỗ trợ định vị");
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const withCoords = stores.filter((s) => s.lat != null && s.lng != null);
        const nearest = withCoords.sort(
          (a, b) =>
            haversineKm(latitude, longitude, Number(a.lat), Number(a.lng)) -
            haversineKm(latitude, longitude, Number(b.lat), Number(b.lng)),
        )[0];
        setLocating(false);
        if (!nearest) return toast.error("Chưa có chi nhánh nào có tọa độ để tính khoảng cách");
        handleSelectStore(nearest);
        const km = haversineKm(latitude, longitude, Number(nearest.lat), Number(nearest.lng));
        toast.success(`Chi nhánh gần bạn nhất: ${nearest.name} (${km.toFixed(1)} km)`);
      },
      () => {
        setLocating(false);
        toast.error("Không xác định được vị trí — hãy cho phép quyền truy cập vị trí");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function orderFrom(s: Store) {
    if (!s.is_active) {
      return toast.error(`${s.name} đang tạm đóng cửa — hãy chọn chi nhánh khác`);
    }
    sessionStorage.setItem("teaplus_store_id", String(s.id));
    toast.success(`Đã chọn chi nhánh ${s.name} — thêm món và thanh toán nhé!`);
    void navigate({ to: "/menu" });
  }

  const mapIframeUrl = useMemo(() => {
    if (mapCoords.lat != null && mapCoords.lng != null) {
      return `https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
    if (selected) {
      return `https://maps.google.com/maps?q=${mapQuery(selected)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
    return `https://maps.google.com/maps?q=TP.+H%E1%BB%93+Ch%C3%AD+Minh&t=&z=12&ie=UTF8&iwloc=&output=embed`;
  }, [mapCoords, selected]);

  return (
    <>
      <PageHeader
        eyebrow="Cửa hàng & Google Maps"
        title="Hệ thống chi nhánh"
        desc="Chọn khu vực hoặc bật định vị để tìm tiệm trà gần bạn nhất trên bản đồ Google Maps."
      />

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
            <Select value={city} onValueChange={handleCityChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tỉnh / Thành phố" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả tỉnh / thành</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={district} onValueChange={handleDistrictChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Quận / Huyện" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả quận / huyện</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="leaf" className="w-full font-semibold" onClick={findNearest} disabled={locating}>
              {locating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LocateFixed className="size-4" />
              )}
              Tìm chi nhánh gần tôi nhất (GPS)
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
              {list.map((s) => (
                <article
                  key={s.id}
                  onClick={() => handleSelectStore(s)}
                  className={`bg-card cursor-pointer rounded-2xl border p-4 transition-all ${
                    selectedId === s.id
                      ? "border-primary ring-2 ring-primary/20 shadow-md"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-display font-bold">{s.name}</p>
                  <p className="text-muted-foreground mt-1 flex items-start gap-2 text-sm">
                    <MapPin className="text-primary mt-0.5 size-4 shrink-0" /> {s.address}
                  </p>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                    <Clock className="text-primary size-4 shrink-0" />
                    <span className="min-w-0 flex-1">{s.hours}</span>
                    {s.is_active ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium"
                      >
                        🟢 Đang mở cửa
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="rounded-full text-[11px] font-medium"
                      >
                        🔴 Đã đóng cửa
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                    <Phone className="text-primary size-4 shrink-0" /> {s.phone}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {parseAmenities(s.amenities).map((a) => (
                      <Badge
                        key={a}
                        variant="secondary"
                        className="rounded-full text-[11px] font-normal"
                      >
                        {a}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${mapQuery(s)}`,
                          "_blank",
                          "noopener",
                        );
                      }}
                    >
                      <Navigation className="size-4" /> Google Maps
                    </Button>
                    <Button
                      variant="hero"
                      size="sm"
                      className="flex-1"
                      disabled={!s.is_active}
                      onClick={(e) => {
                        e.stopPropagation();
                        orderFrom(s);
                      }}
                    >
                      <ShoppingBag className="size-4" /> {s.is_active ? "Đặt món" : "Tạm đóng cửa"}
                    </Button>
                  </div>
                </article>
              ))}
              {list.length === 0 && (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Không có chi nhánh nào trong khu vực này
                </p>
              )}
            </div>
          )}
        </div>

        {/* Khung bản đồ Google Maps Iframe */}
        <div className="flex flex-col gap-3">
          {selected && (
            <div className="bg-card flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <MapPin className="text-primary size-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm truncate">{mapCoords.title || selected.name}</p>
                  <p className="text-muted-foreground text-xs truncate">{selected.address}</p>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery(selected)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button variant="hero" size="sm">
                  <Navigation className="size-4" /> Mở Google Maps
                </Button>
              </a>
            </div>
          )}

          <div className="relative min-h-[480px] flex-1 overflow-hidden rounded-2xl border shadow-md">
            <iframe
              title={`Bản đồ ${mapCoords.title}`}
              src={mapIframeUrl}
              className="h-full min-h-[480px] w-full border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </>
  );
}
