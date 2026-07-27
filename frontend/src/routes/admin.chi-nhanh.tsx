import { createFileRoute } from "@tanstack/react-router";
import { Clock, MapPin, Phone, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { stores } from "@/lib/data";

export const Route = createFileRoute("/admin/chi-nhanh")({
  head: () => ({
    meta: [
      { title: "Hệ thống cửa hàng | Admin Vườn Xanh" },
      {
        name: "description",
        content: "Danh sách chi nhánh, giờ mở cửa và bật/tắt hoạt động từng cơ sở.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Hệ thống cửa hàng | Admin Vườn Xanh" },
      {
        property: "og:description",
        content: "Quản lý chi nhánh, giờ hoạt động và trạng thái nhận đơn.",
      },
    ],
  }),
  component: StoresAdminPage,
});

function StoresAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="Hệ thống cửa hàng"
        desc={`${stores.length} chi nhánh đang vận hành`}
        actions={
          <Button variant="hero">
            <Plus className="mr-1 size-4" /> Thêm chi nhánh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stores.map((s, i) => (
          <Card key={s.id} className="shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold">{s.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {s.district} · {s.city}
                  </p>
                </div>
                <Switch defaultChecked={i !== 4} />
              </div>
              <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
                <li className="flex gap-2">
                  <MapPin className="text-primary mt-0.5 size-4 shrink-0" /> {s.address}
                </li>
                <li className="flex gap-2">
                  <Clock className="text-primary mt-0.5 size-4 shrink-0" /> {s.hours}
                </li>
                <li className="flex gap-2">
                  <Phone className="text-primary mt-0.5 size-4 shrink-0" /> {s.phone}
                </li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {s.amenities.map((a) => (
                  <Badge key={a} variant="secondary">
                    {a}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 flex gap-2 border-t pt-4">
                <Button variant="soft" size="sm" className="flex-1">
                  Chỉnh sửa
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Xem doanh thu
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
