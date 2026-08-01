import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, LocateFixed, MapPin, Navigation, Phone } from "lucide-react";
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
import { stores } from "@/lib/data";

export const Route = createFileRoute("/cua-hang")({
  head: () => ({
    meta: [
      { title: "Hệ thống cửa hàng & chi nhánh — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Tìm chi nhánh Trà Trái Cây Tô gần bạn: địa chỉ, giờ mở cửa, tiện ích và chỉ đường nhanh.",
      },
      { property: "og:title", content: "Hệ thống cửa hàng — Trà Trái Cây Tô" },
      { property: "og:description", content: "48 chi nhánh tại TP.HCM, Hà Nội và Đà Nẵng." },
    ],
  }),
  component: StoresPage,
});

function StoresPage() {
  const [city, setCity] = useState("all");
  const [district, setDistrict] = useState("all");

  const cities = Array.from(new Set(stores.map((s) => s.city)));
  const districts = Array.from(
    new Set(stores.filter((s) => city === "all" || s.city === city).map((s) => s.district)),
  );

  const list = useMemo(
    () =>
      stores.filter(
        (s) =>
          (city === "all" || s.city === city) && (district === "all" || s.district === district),
      ),
    [city, district],
  );

  return (
    <>
      <PageHeader
        eyebrow="Cửa hàng"
        title="Hệ thống chi nhánh"
        desc="Chọn khu vực hoặc bật định vị để tìm tiệm trà gần bạn nhất."
      />

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="bg-card space-y-3 rounded-2xl border p-4">
            <Select
              value={city}
              onValueChange={(v) => {
                setCity(v);
                setDistrict("all");
              }}
            >
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
            <Select value={district} onValueChange={setDistrict}>
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
            <Button variant="leaf" className="w-full">
              <LocateFixed className="size-4" /> Tìm chi nhánh gần tôi nhất
            </Button>
          </div>

          <div className="space-y-3">
            {list.map((s) => (
              <article key={s.id} className="bg-card rounded-2xl border p-4">
                <p className="font-display font-bold">{s.name}</p>
                <p className="text-muted-foreground mt-1 flex items-start gap-2 text-sm">
                  <MapPin className="text-primary mt-0.5 size-4 shrink-0" /> {s.address}
                </p>
                <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                  <Clock className="text-primary size-4" /> {s.hours}
                </p>
                <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                  <Phone className="text-primary size-4" /> {s.phone}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.amenities.map((a) => (
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
                  <Button variant="outline" size="sm" className="flex-1">
                    <Navigation className="size-4" /> Chỉ đường
                  </Button>
                  <Button variant="hero" size="sm" className="flex-1">
                    Đặt từ chi nhánh này
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="bg-accent/40 relative min-h-[420px] overflow-hidden rounded-2xl border">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] [background-size:44px_44px]" />
          {list.map((s, i) => (
            <div
              key={s.id}
              className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
              style={{ left: `${18 + i * 17}%`, top: `${32 + (i % 3) * 18}%` }}
            >
              <span className="bg-card rounded-full border px-2 py-1 text-[11px] font-semibold shadow-card-soft">
                {s.district}
              </span>
              <MapPin className="fill-primary text-primary size-7" />
            </div>
          ))}
          <p className="text-muted-foreground absolute bottom-4 left-1/2 -translate-x-1/2 text-xs">
            Bản đồ tương tác (Google Maps) sẽ hiển thị tại đây
          </p>
        </div>
      </div>
    </>
  );
}
