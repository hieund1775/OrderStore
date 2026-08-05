import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/khuyen-mai")({
  head: () => ({
    meta: [
      { title: "Khuyến mãi & Voucher | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Cấu hình voucher giảm giá %: mã dùng 1 lần hoặc mã theo thời hạn giới hạn lượt dùng.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PromotionsAdminPage,
});

type Promotion = {
  id: number;
  title: string;
  code: string | null;
  discount_value: number | null;
  discount_type: string | null;
  max_discount: number | null;
  min_order: number | null;
  voucher_type: "single_use" | "time_bounded";
  usage_limit: number | null;
  used_count: number;
  start_date: string;
  end_date: string;
  status: string;
  is_active: boolean;
};

const statusTone: Record<string, string> = {
  "Đang diễn ra": "bg-leaf/15 text-leaf",
  "Đang chạy": "bg-leaf/15 text-leaf",
  "Lên lịch": "bg-primary/15 text-primary",
  "Sắp diễn ra": "bg-primary/15 text-primary",
  "Đã kết thúc": "bg-muted text-muted-foreground",
  "Kết thúc": "bg-muted text-muted-foreground",
};

const emptyForm = {
  title: "",
  code: "",
  discount_value: "",
  max_discount: "",
  min_order: "",
  voucher_type: "time_bounded" as "single_use" | "time_bounded",
  usage_limit: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
};

function PromotionsAdminPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiGet<Promotion[]>("/admin/promotions");
      setPromos(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Promotion) {
    setEditing(p);
    setForm({
      title: p.title,
      code: p.code || "",
      discount_value: p.discount_value != null ? String(p.discount_value) : "",
      max_discount: p.max_discount != null ? String(p.max_discount) : "",
      min_order: p.min_order != null ? String(p.min_order) : "",
      voucher_type: p.voucher_type,
      usage_limit: p.usage_limit != null ? String(p.usage_limit) : "",
      start_date: p.start_date?.slice(0, 10) || "",
      end_date: p.end_date?.slice(0, 10) || "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Nhập tên chương trình");
    if (!form.code.trim()) return toast.error("Nhập mã giảm giá");
    const discount = Number(form.discount_value);
    if (!discount || discount <= 0 || discount > 100) {
      return toast.error("Phần trăm giảm phải từ 1 đến 100");
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        code: form.code.trim().toUpperCase(),
        type: "Giảm giá",
        discount_value: discount,
        discount_type: "percent",
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        min_order: form.min_order ? Number(form.min_order) : null,
        voucher_type: form.voucher_type,
        usage_limit:
          form.voucher_type === "time_bounded" && form.usage_limit
            ? Number(form.usage_limit)
            : null,
        start_date: form.start_date,
        end_date: form.end_date,
      };
      if (editing) {
        await apiPut(`/admin/promotions/${editing.id}`, payload);
        toast.success("Đã cập nhật mã giảm giá");
      } else {
        await apiPost("/admin/promotions", payload);
        toast.success("Đã tạo mã giảm giá");
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Promotion, active: boolean) {
    try {
      await apiPut(`/admin/promotions/${p.id}`, { is_active: active });
      setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: active } : x)));
      toast.success(active ? "Đã bật mã" : "Đã tắt mã");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Khuyến mãi & Voucher"
        desc="Mã giảm giá % — dùng 1 lần hoặc theo thời hạn giới hạn lượt"
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Tạo mã giảm giá
          </Button>
        }
      />

      <Card className="shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Đang tải…</div>
        ) : promos.length === 0 ? (
          <div className="py-16 text-center">
            <Ticket className="text-muted-foreground mx-auto mb-2 size-8" />
            <p className="font-semibold">Chưa có mã giảm giá nào</p>
            <p className="text-muted-foreground text-sm">Bấm "Tạo mã giảm giá" để bắt đầu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chương trình</TableHead>
                  <TableHead>Giảm</TableHead>
                  <TableHead>Loại mã</TableHead>
                  <TableHead className="hidden md:table-cell">Điều kiện</TableHead>
                  <TableHead className="hidden lg:table-cell">Hạn dùng</TableHead>
                  <TableHead className="hidden lg:table-cell">Lượt dùng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promos.map((p) => (
                  <TableRow key={p.id} className={p.is_active ? "" : "opacity-50"}>
                    <TableCell>
                      <p className="font-semibold">{p.title}</p>
                      <p className="text-primary font-mono text-xs font-bold">{p.code}</p>
                    </TableCell>
                    <TableCell>
                      {p.discount_type === "percent" ? (
                        <span className="font-bold">
                          {p.discount_value}%
                          {p.max_discount ? ` (max ${vnd(p.max_discount)})` : ""}
                        </span>
                      ) : (
                        vnd(p.discount_value || 0)
                      )}
                    </TableCell>
                    <TableCell>
                      {p.voucher_type === "single_use" ? (
                        <Badge variant="secondary" className="bg-berry/10 text-berry">
                          🎟️ Mã 1 lần
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          📅 Theo thời hạn
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {p.min_order ? `Đơn từ ${vnd(p.min_order)}` : "Không giới hạn"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                      {p.start_date?.slice(0, 10)} → {p.end_date?.slice(0, 10)}
                    </TableCell>
                    <TableCell className="hidden text-xs lg:table-cell">
                      {p.used_count}
                      {p.usage_limit != null && ` / ${p.usage_limit}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusTone[p.status] || ""}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={(v) => toggleActive(p, v)}
                          aria-label={`Bật/tắt mã ${p.code}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(p)}
                          aria-label={`Sửa mã ${p.code}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa mã giảm giá" : "Tạo mã giảm giá mới"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="promo-title">Tên chương trình</Label>
              <Input
                id="promo-title"
                placeholder="VD: Giảm 10% cho khách mới"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-code">Mã giảm giá</Label>
              <Input
                id="promo-code"
                placeholder="VD: NEW10"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-value">Phần trăm giảm (%)</Label>
              <Input
                id="promo-value"
                type="number"
                min={1}
                max={100}
                placeholder="10"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-max">Mức giảm tối đa (₫)</Label>
              <Input
                id="promo-max"
                type="number"
                min={0}
                placeholder="VD: 30000"
                value={form.max_discount}
                onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-min">Đơn tối thiểu (₫)</Label>
              <Input
                id="promo-min"
                type="number"
                min={0}
                placeholder="VD: 89000"
                value={form.min_order}
                onChange={(e) => setForm({ ...form, min_order: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Loại mã</Label>
              <Select
                value={form.voucher_type}
                onValueChange={(v) =>
                  setForm({ ...form, voucher_type: v as "single_use" | "time_bounded" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_use">🎟️ Mã 1 lần (mỗi SĐT 1 lần)</SelectItem>
                  <SelectItem value="time_bounded">📅 Theo thời hạn & lượt dùng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.voucher_type === "time_bounded" && (
              <div className="space-y-1.5">
                <Label htmlFor="promo-limit">Giới hạn lượt dùng</Label>
                <Input
                  id="promo-limit"
                  type="number"
                  min={1}
                  placeholder="VD: 500"
                  value={form.usage_limit}
                  onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="promo-start">Ngày bắt đầu</Label>
              <Input
                id="promo-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end">Ngày kết thúc</Label>
              <Input
                id="promo-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Đang lưu…" : editing ? "Cập nhật" : "Tạo mã"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
