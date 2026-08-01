import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader, SectionCard } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminPromotions } from "@/lib/admin-data";
import { stores } from "@/lib/data";

export const Route = createFileRoute("/admin/khuyen-mai")({
  head: () => ({
    meta: [
      { title: "Khuyến mãi & Marketing | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Cấu hình Flash Sale, Happy Hour, combo, mua 2 tặng 1 và banner trang chủ.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Khuyến mãi & Marketing | Admin Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Ma trận điều kiện áp dụng theo chi nhánh, khung giờ và hạng thành viên.",
      },
    ],
  }),
  component: PromotionsAdminPage,
});

const statusTone: Record<string, string> = {
  "Đang chạy": "bg-leaf/15 text-leaf",
  "Lên lịch": "bg-primary/15 text-primary",
  "Kết thúc": "bg-muted text-muted-foreground",
};

function PromotionsAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="Khuyến mãi & Marketing"
        desc="Chiến dịch đang chạy trên website và ứng dụng khách hàng"
        actions={<PromoForm />}
      />

      <Card className="shadow-soft mb-6 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chương trình</TableHead>
                <TableHead>Loại hình</TableHead>
                <TableHead className="hidden md:table-cell">Phạm vi</TableHead>
                <TableHead className="hidden lg:table-cell">Khung giờ / Thời gian</TableHead>
                <TableHead className="hidden xl:table-cell">Đối tượng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Bật</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminPromotions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.type}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{p.scope}</TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{p.time}</TableCell>
                  <TableCell className="hidden text-sm xl:table-cell">{p.audience}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch defaultChecked={p.status === "Đang chạy"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <SectionCard
        title="Banner & Pop-up trang chủ"
        desc="Ảnh hiển thị trên hero và popup chào mừng khách hàng"
        actions={
          <Button variant="soft" size="sm">
            <Plus className="mr-1 size-4" /> Thêm banner
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["Hero – Flash Sale 15h", "Popup – Mua 2 Tặng 1", "Banner giữa trang – Combo 79K"].map(
            (b) => (
              <div key={b} className="rounded-xl border p-4">
                <div className="bg-muted mb-3 grid h-28 place-items-center rounded-lg">
                  <ImageIcon className="text-muted-foreground size-6" />
                </div>
                <p className="text-sm font-semibold">{b}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Hiển thị</span>
                  <Switch defaultChecked />
                </div>
              </div>
            ),
          )}
        </div>
      </SectionCard>
    </>
  );
}

function PromoForm() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="hero">
          <Plus className="mr-1 size-4" /> Tạo khuyến mãi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo chương trình khuyến mãi</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="promo-name">Tên chương trình</Label>
            <Input id="promo-name" placeholder="Flash Sale cuối tuần" className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Loại hình</Label>
              <Select defaultValue="flash">
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flash">Flash Sale</SelectItem>
                  <SelectItem value="happy">Happy Hour</SelectItem>
                  <SelectItem value="combo">Combo tiết kiệm</SelectItem>
                  <SelectItem value="b2g1">Mua 2 Tặng 1</SelectItem>
                  <SelectItem value="voucher">Voucher giảm giá</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hạng thành viên áp dụng</Label>
              <Select defaultValue="all">
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả khách hàng</SelectItem>
                  <SelectItem value="new">Khách mới</SelectItem>
                  <SelectItem value="gold">Vàng trở lên</SelectItem>
                  <SelectItem value="diamond">Kim Cương</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="promo-from">Từ ngày</Label>
              <Input id="promo-from" type="date" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="promo-to">Đến ngày</Label>
              <Input id="promo-to" type="date" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="promo-h1">Khung giờ bắt đầu</Label>
              <Input id="promo-h1" type="time" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="promo-h2">Khung giờ kết thúc</Label>
              <Input id="promo-h2" type="time" className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Chi nhánh áp dụng</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <Checkbox defaultChecked /> {s.district}
                </label>
              ))}
            </div>
          </div>
          <Button
            variant="hero"
            className="w-full"
            onClick={() => toast.success("Đã tạo chương trình (demo)")}
          >
            Lưu chương trình
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
