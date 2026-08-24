import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Ticket, Trash2 } from "lucide-react";
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
import { apiDelete, apiGet, apiPost, apiPut, getUser } from "@/lib/api";
import { vnd } from "@/lib/data";

import { formatLocalDateKey, formatVoucherDate, getPromotionStatus, type PromotionStatusInput } from "@/lib/promotion-status";

export const Route = createFileRoute("/admin/khuyen-mai")({
  head: () => ({
    meta: [
      { title: "Khuyến mãi & Voucher | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Cấu hình voucher giảm giá %: mã dùng 1 lần cho mỗi SĐT hoặc mã dùng chung theo thời hạn & lượt dùng.",
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
  voucher_type: "single_use" | "shared";
  usage_limit: number | null;
  used_count: number;
  start_date: string;
  end_date: string | null;
  status: string;
  is_active: boolean;
};

const emptyForm = {
  title: "",
  code: "",
  discount_value: "",
  max_discount: "",
  min_order: "",
  voucher_type: "shared" as "single_use" | "shared",
  is_unlimited_usage: true,
  usage_limit: "",
  start_date: formatLocalDateKey(),
  is_unlimited_date: false,
  end_date: formatLocalDateKey(new Date(Date.now() + 30 * 86400000)),
};

function renderVoucherBadge(p: Promotion) {
  const status = getPromotionStatus(p);
  switch (status.variant) {
    case "inactive":
      return <Badge variant="secondary" className="bg-muted text-muted-foreground">Tạm tắt</Badge>;
    case "expired":
      return <Badge variant="destructive">Hết hạn</Badge>;
    case "exhausted":
      return <Badge variant="destructive">Hết lượt</Badge>;
    case "pending":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Sắp diễn ra</Badge>;
    case "active":
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">Đang diễn ra</Badge>;
  }
}

function PromotionsAdminPage() {
  const canManage = getUser()?.role === "super";
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (!canManage) return;
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Promotion) {
    if (!canManage) return;
    setEditing(p);
    const isSingleUse = p.voucher_type === "single_use";
    setForm({
      title: p.title,
      code: p.code || "",
      discount_value: p.discount_value != null ? String(p.discount_value) : "",
      max_discount: p.max_discount != null ? String(p.max_discount) : "",
      min_order: p.min_order != null ? String(p.min_order) : "",
      voucher_type: isSingleUse ? "single_use" : "shared",
      is_unlimited_usage: isSingleUse || p.usage_limit == null,
      usage_limit: p.usage_limit != null ? String(p.usage_limit) : "",
      start_date: p.start_date?.slice(0, 10) || formatLocalDateKey(),
      is_unlimited_date: !p.end_date,
      end_date: p.end_date?.slice(0, 10) || formatLocalDateKey(new Date(Date.now() + 30 * 86400000)),
    });
    setDialogOpen(true);
  }

  function openDelete(p: Promotion) {
    if (!canManage) return;
    setSelectedToDelete(p);
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!canManage || !selectedToDelete) return;
    setDeleting(true);
    try {
      await apiDelete(`/admin/promotions/${selectedToDelete.id}`);
      toast.success(`Đã xóa voucher ${selectedToDelete.code}`);
      setDeleteDialogOpen(false);
      setSelectedToDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setDeleting(false);
    }
  }

  async function save() {
    if (!canManage) return;
    if (!form.title.trim()) return toast.error("Nhập tên chương trình");
    if (!form.code.trim()) return toast.error("Nhập mã giảm giá");
    if (!form.start_date) return toast.error("Chọn ngày bắt đầu");
    const discount = Number(form.discount_value);
    if (!discount || discount <= 0 || discount > 100) {
      return toast.error("Phần trăm giảm phải từ 1 đến 100");
    }
    if (!form.is_unlimited_date && !form.end_date) {
      return toast.error("Chọn ngày kết thúc hoặc bật Không hạn ngày");
    }
    if (!form.is_unlimited_date && form.end_date < form.start_date) {
      return toast.error("Ngày kết thúc không được trước ngày bắt đầu");
    }
    const usageLimit = Number(form.usage_limit);
    if (
      form.voucher_type === "shared"
      && !form.is_unlimited_usage
      && (!Number.isInteger(usageLimit) || usageLimit <= 0)
    ) {
      return toast.error("Giới hạn lượt dùng phải là số nguyên dương");
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
          form.voucher_type === "shared" && !form.is_unlimited_usage && form.usage_limit
            ? Number(form.usage_limit)
            : null,
        start_date: form.start_date,
        end_date: form.is_unlimited_date ? null : form.end_date,
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
    if (!canManage) return;
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
        desc="Quản lý mã giảm giá — dùng 1 lần theo SĐT hoặc mã dùng chung theo thời hạn & lượt dùng"
        actions={canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Tạo mã giảm giá
          </Button>
        ) : undefined}
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
                  {canManage && <TableHead className="text-right">Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {promos.map((p) => {
                  const statusInfo = getPromotionStatus(p);
                  return (
                    <TableRow key={p.id} className={p.is_active ? "" : "opacity-60"}>
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
                            🎟️ Mã 1 lần / SĐT
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            👥 Dùng chung
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                        {p.min_order ? `Đơn từ ${vnd(p.min_order)}` : "Không giới hạn đơn"}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                        {formatVoucherDate(p.start_date)} → {statusInfo.dateDisplay}
                      </TableCell>
                      <TableCell className="hidden text-xs lg:table-cell">
                        <span className="font-medium">{statusInfo.usageDisplay}</span>
                      </TableCell>
                      <TableCell>
                        {renderVoucherBadge(p)}
                      </TableCell>
                      {canManage && <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDelete(p)}
                            aria-label={`Xóa mã ${p.code}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Dialog Tạo / Sửa mã */}
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
                placeholder="VD: 30000 (để trống nếu không giới hạn)"
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
                placeholder="VD: 89000 (để trống nếu không giới hạn)"
                value={form.min_order}
                onChange={(e) => setForm({ ...form, min_order: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Kiểu sử dụng</Label>
              <Select
                value={form.voucher_type}
                onValueChange={(v) =>
                  setForm({ ...form, voucher_type: v as "single_use" | "shared" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_use">🎟️ Một lần cho mỗi số điện thoại (Single-use)</SelectItem>
                  <SelectItem value="shared">👥 Dùng chung (Shared)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.voucher_type === "shared" && (
              <div className="space-y-2 sm:col-span-2 rounded-xl border p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label htmlFor="promo-unlimited-usage" className="cursor-pointer text-xs font-semibold">
                    Không giới hạn tổng lượt dùng
                  </Label>
                  <Switch
                    id="promo-unlimited-usage"
                    checked={form.is_unlimited_usage}
                    onCheckedChange={(checked) => setForm({ ...form, is_unlimited_usage: checked })}
                  />
                </div>
                {!form.is_unlimited_usage && (
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="promo-limit" className="text-xs">Giới hạn tổng lượt dùng</Label>
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
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="promo-start">Ngày bắt đầu</Label>
              <Input
                id="promo-start"
                type="date"
                value={form.start_date}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setForm({
                    ...form,
                    start_date: newStart,
                    end_date: form.end_date && form.end_date < newStart ? newStart : form.end_date,
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="promo-end">Ngày kết thúc</Label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_unlimited_date: !form.is_unlimited_date })}
                  className="text-xs text-primary underline hover:opacity-80"
                >
                  {form.is_unlimited_date ? "Có ngày kết thúc" : "Không hạn ngày"}
                </button>
              </div>
              <Input
                id="promo-end"
                type="date"
                min={form.start_date}
                disabled={form.is_unlimited_date}
                value={form.is_unlimited_date ? "" : form.end_date}
                placeholder={form.is_unlimited_date ? "Không giới hạn ngày" : undefined}
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

      {/* Dialog Xác nhận xóa voucher */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa voucher</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn có chắc chắn muốn xóa voucher{" "}
            <strong className="text-foreground font-mono">{selectedToDelete?.code}</strong>{" "}
            ({selectedToDelete?.title})? Voucher sẽ được lưu trữ để bảo toàn lịch sử và không thể sử dụng lại.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Đang xóa..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
