import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import QRCode from "qrcode";
import {
  Download,
  Plus,
  Printer,
  QrCode as QrIcon,
  Trash2,
  Pencil,
  Loader2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

export const Route = createFileRoute("/admin/vi-tri")({
  validateSearch: (search: Record<string, unknown>) => ({
    store_id:
      typeof search.store_id === "string"
        ? search.store_id
        : typeof search.store_id === "number"
          ? String(search.store_id)
          : undefined,
  }),
  head: () => ({ meta: [{ title: "Vị trí & Mã QR bàn | Admin" }, { name: "robots", content: "noindex" }] }),
  component: TablesPage,
});

type TableRow = {
  id: number;
  store_id: number;
  store_name: string;
  name: string;
  qr_code_token: string;
  is_active: boolean;
};

function qrUrl(table: TableRow) {
  return `${window.location.origin}/menu?table_id=${table.id}`;
}

function storeQrUrl(storeId: number) {
  return `${window.location.origin}/menu?store_id=${storeId}`;
}

function TablesPage() {
  const search = Route.useSearch();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [branchFilter, setBranchFilter] = useState(search.store_id ?? "all");
  const [loading, setLoading] = useState(true);
  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [storeQrMap, setStoreQrMap] = useState<Record<number, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TableRow | null>(null);
  const [deleting, setDeleting] = useState<TableRow | null>(null);
  const [formNum, setFormNum] = useState("1");
  const [formStore, setFormStore] = useState("1");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiGet<TableRow[]>("/admin/tables");
      setTables(rows);
      const map: Record<number, string> = {};
      await Promise.all(
        rows.map(async (t) => {
          map[t.id] = await QRCode.toDataURL(qrUrl(t), { width: 200, margin: 1 });
        }),
      );
      setQrMap(map);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được danh sách bàn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet<{ id: number; name: string }[]>("/admin/branches")
      .then(async (rows) => {
        setBranches(rows);
        const map: Record<number, string> = {};
        await Promise.all(
          rows.map(async (b) => {
            map[b.id] = await QRCode.toDataURL(storeQrUrl(b.id), { width: 220, margin: 1 });
          })
        );
        setStoreQrMap(map);
      })
      .catch(() => {});
  }, []);

  function tableNumber(name: string) {
    const m = name.match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  function nextTableNumber(storeId: string) {
    const nums = tables
      .filter((t) => String(t.store_id) === storeId)
      .map((t) => tableNumber(t.name))
      .filter((n) => n > 0);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  const filtered = branchFilter === "all" ? tables : tables.filter((t) => t.store_id === Number(branchFilter));

  function openCreate() {
    setEditing(null);
    const store =
      branchFilter === "all"
        ? branches.length
          ? String(branches[0].id)
          : "1"
        : branchFilter;
    setFormStore(store);
    setFormNum(String(nextTableNumber(store)));
    setDialogOpen(true);
  }

  function openEdit(t: TableRow) {
    setEditing(t);
    setFormNum(String(tableNumber(t.name) || 1));
    setFormStore(String(t.store_id));
    setDialogOpen(true);
  }

  async function save() {
    const num = Number(formNum);
    if (!Number.isInteger(num) || num <= 0) {
      return toast.error("Số bàn phải là số nguyên dương (1, 2, 3...)");
    }
    const name = `Bàn ${num}`;
    const dup = tables.some(
      (t) => String(t.store_id) === formStore && t.name === name && t.id !== editing?.id,
    );
    if (dup) {
      return toast.error(`Bàn ${num} đã tồn tại trong chi nhánh này`);
    }

    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/admin/tables/${editing.id}`, { name, store_id: Number(formStore) });
        toast.success(`Đã cập nhật ${name}`);
      } else {
        await apiPost("/admin/tables", { name, store_id: Number(formStore) });
        toast.success(`Đã tạo ${name}`);
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiDelete(`/admin/tables/${deleting.id}`);
      toast.success(`Đã xóa ${deleting.name}`);
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa thất bại");
    }
  }

  function downloadQr(t: TableRow) {
    const dataUrl = qrMap[t.id];
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${t.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  }

  function printQr(t: TableRow) {
    const w = window.open("", "_blank", "width=380,height=480");
    if (!w) return toast.error("Trình duyệt chặn cửa sổ in — hãy cho phép popup");
    const img = qrMap[t.id];
    w.document.write(`
      <html><head><title>QR ${t.name}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
        h3 { margin: 8px 0 2px; } p { margin: 2px 0; color: #666; font-size: 13px; }
        img { width: 220px; height: 220px; }
        @media print { .no-print { display: none; } }
      </style></head>
      <body>
        <img src="${img}" alt="QR ${t.name}" />
        <h3>${t.name}</h3>
        <p>${t.store_name}</p>
        <p>Quét mã để đặt món tại bàn</p>
        <button class="no-print" onclick="window.print()" style="margin-top:16px;padding:8px 20px">In mã QR</button>
        <script>setTimeout(() => window.print(), 300)</script>
      </body></html>
    `);
    w.document.close();
  }

  function downloadStoreQr(b: { id: number; name: string }) {
    const dataUrl = storeQrMap[b.id];
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-chinhanh-${b.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  }

  function printStoreQr(b: { id: number; name: string }) {
    const w = window.open("", "_blank", "width=400,height=520");
    if (!w) return toast.error("Trình duyệt chặn cửa sổ in — hãy cho phép popup");
    const img = storeQrMap[b.id];
    w.document.write(`
      <html><head><title>Mã QR Chi nhánh - ${b.name}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
        h2 { margin: 8px 0 2px; color: #16a34a; }
        h3 { margin: 4px 0 12px; }
        p { margin: 4px 0; color: #555; font-size: 13px; }
        img { width: 240px; height: 240px; margin: 12px 0; }
        .badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: bold; font-size: 11px; padding: 4px 12px; border-radius: 12px; margin-bottom: 8px; }
        @media print { .no-print { display: none; } }
      </style></head>
      <body>
        <div class="badge">📍 MÃ QR TỔNG CHI NHÁNH</div>
        <h2>TRÀ TRÁI CÂY TÔ</h2>
        <h3>${b.name}</h3>
        <img src="${img}" alt="QR ${b.name}" />
        <p>Quét mã để chọn menu và đặt món tự động tại chi nhánh này</p>
        <p style="font-size: 11px; color: #888;">(Dán tại quầy order hoặc cửa ra vào)</p>
        <button class="no-print" onclick="window.print()" style="margin-top:16px;padding:8px 20px;font-size:14px;cursor:pointer">In mã QR Chi Nhánh</button>
        <script>setTimeout(() => window.print(), 300)</script>
      </body></html>
    `);
    w.document.close();
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Vị trí & Mã QR bàn</h1>
          <p className="text-muted-foreground text-sm">
            Tạo vị trí, sinh mã QR riêng cho từng bàn — khách quét để đặt món trực tiếp tại bàn.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả chi nhánh</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Thêm bàn
          </Button>
        </div>
      </div>

      {/* Khối Mã QR Tổng Chi Nhánh */}
      {!loading && branches.length > 0 && (
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-leaf/5 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold">
                  📍 Mã QR Tổng Chi Nhánh
                </Badge>
                <span className="text-muted-foreground text-xs hidden sm:inline">
                  (Dán tại quầy order / cửa vào — Tự động đi kèm Cửa hàng, không có nút xóa lẻ)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(branchFilter === "all" ? branches : branches.filter((b) => String(b.id) === branchFilter)).map((b) => (
                <div key={b.id} className="bg-card flex items-center gap-4 rounded-xl border p-3.5 shadow-sm">
                  <div className="bg-white shrink-0 rounded-lg border p-1.5">
                    {storeQrMap[b.id] ? (
                      <img src={storeQrMap[b.id]} alt={`QR Chi nhánh ${b.name}`} className="size-20" />
                    ) : (
                      <div className="bg-muted size-20 animate-pulse rounded" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-display font-bold text-sm truncate">{b.name}</p>
                    <p className="text-muted-foreground text-xs">Mã QR Cửa Hàng #{b.id}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => downloadStoreQr(b)}
                        title="Tải ảnh QR Chi nhánh"
                      >
                        <Download className="mr-1 size-3" /> Tải QR
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => printStoreQr(b)}
                        title="In mã QR Chi nhánh"
                      >
                        <Printer className="mr-1 size-3" /> In QR
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Đang tải…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <QrIcon className="text-muted-foreground size-8" />
            <p className="font-semibold">Chưa có bàn nào</p>
            <p className="text-muted-foreground text-sm">
              Bấm "Thêm bàn" để tạo vị trí đầu tiên và sinh mã QR dán bàn.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <CardContent className="flex flex-col items-center gap-3 p-5">
                <div className="bg-white rounded-xl border p-2">
                  {qrMap[t.id] ? (
                    <img src={qrMap[t.id]} alt={`QR ${t.name}`} className="size-32" />
                  ) : (
                    <div className="bg-muted size-32" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-display font-bold">{t.name}</p>
                  <p className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
                    <MapPin className="size-3" /> {t.store_name}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => downloadQr(t)} aria-label={`Tải mã QR ${t.name}`} title="Tải PNG">
                    <Download className="size-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => printQr(t)} aria-label={`In mã QR ${t.name}`} title="In QR">
                    <Printer className="size-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(t)} aria-label={`Sửa ${t.name}`} title="Sửa">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-berry hover:text-berry" onClick={() => setDeleting(t)} aria-label={`Xóa ${t.name}`} title="Xóa">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {t.is_active ? (
                  <Badge variant="secondary" className="bg-leaf/10 text-leaf">
                    Đang hoạt động
                  </Badge>
                ) : (
                  <Badge variant="outline">Đã tắt</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa bàn/vị trí" : "Thêm bàn/vị trí mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="table-name">Số bàn</Label>
              <Input
                id="table-name"
                type="number"
                min={1}
                placeholder="VD: 7"
                value={formNum}
                onChange={(e) => setFormNum(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Sẽ tạo bàn mang tên <strong>Bàn {formNum || "..."}</strong> — không được trùng số trong chi nhánh.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Chi nhánh</Label>
              <Select
                value={formStore}
                onValueChange={(v) => {
                  setFormStore(v);
                  if (!editing) setFormNum(String(nextTableNumber(v)));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Đang lưu…" : editing ? "Cập nhật" : "Tạo bàn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bàn "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Mã QR của bàn này sẽ không còn hoạt động. Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-berry text-berry-foreground hover:bg-berry/90" onClick={confirmDelete}>
              Xóa bàn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
