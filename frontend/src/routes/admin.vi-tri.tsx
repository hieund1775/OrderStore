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
import { adminBranches } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/vi-tri")({
  validateSearch: (search: Record<string, unknown>) => ({
    store_id: typeof search.store_id === "string" ? search.store_id : undefined,
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

function TablesPage() {
  const search = Route.useSearch();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [branchFilter, setBranchFilter] = useState(search.store_id ?? "all");
  const [loading, setLoading] = useState(true);
  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TableRow | null>(null);
  const [deleting, setDeleting] = useState<TableRow | null>(null);
  const [formName, setFormName] = useState("");
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

  const filtered = branchFilter === "all" ? tables : tables.filter((t) => t.store_id === Number(branchFilter));

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormStore(branchFilter === "all" ? "1" : branchFilter);
    setDialogOpen(true);
  }

  function openEdit(t: TableRow) {
    setEditing(t);
    setFormName(t.name);
    setFormStore(String(t.store_id));
    setDialogOpen(true);
  }

  async function save() {
    if (!formName.trim()) return toast.error("Vui lòng nhập tên bàn/vị trí");
    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/admin/tables/${editing.id}`, { name: formName.trim() });
        toast.success("Đã cập nhật bàn");
      } else {
        await apiPost("/admin/tables", { store_id: Number(formStore), name: formName.trim() });
        toast.success("Đã tạo bàn mới");
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
      toast.success("Đã xóa bàn");
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
              {adminBranches.map((b) => (
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
              <Label htmlFor="table-name">Tên bàn / vị trí</Label>
              <Input
                id="table-name"
                placeholder="VD: Bàn 06 - Tầng 1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Chi nhánh</Label>
              <Select value={formStore} onValueChange={setFormStore}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {adminBranches
                    .filter((b) => b.id !== "all")
                    .map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <p className="bg-accent/40 text-accent-foreground rounded-lg p-2.5 text-xs">
                Mã QR bảo mật tự động sinh — URL: <code className="font-mono">/menu?table_id=…</code>
              </p>
            )}
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
