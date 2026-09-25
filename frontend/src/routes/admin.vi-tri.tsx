import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { AdminPagination } from "@/components/admin/AdminUI";
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
    page: Number(search.page) > 0 ? Math.floor(Number(search.page)) : undefined,
  }),
  head: () => ({ meta: [{ title: "Vị trí & Mã QR bàn | Admin" }, { name: "robots", content: "noindex" }] }),
  component: TablesPage,
});

type TableRow = {
  id: number;
  store_id: number;
  store_name: string;
  name: string;
  has_checkout_qr?: boolean;
  qr_checkout_token?: string;
  is_active: boolean;
};

type TableQrResponse = TableRow & { qr_checkout_token: string };

function qrUrl(token: string) {
  return `${window.location.origin}/menu?table_token=${encodeURIComponent(token)}`;
}

function storeQrUrl(storeId: number) {
  return `${window.location.origin}/menu?store_id=${storeId}`;
}

const TABLES_STORAGE_KEY = "admin_tables_branch";

export function TablesPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [branchFilter, setBranchFilter] = useState(() => {
    if (search.store_id) return search.store_id;
    if (typeof window !== "undefined") {
      const fromStorage = sessionStorage.getItem(TABLES_STORAGE_KEY);
      if (fromStorage) return fromStorage;
    }
    return "all";
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(search.page || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTables, setTotalTables] = useState<number | undefined>(undefined);
  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [storeQrMap, setStoreQrMap] = useState<Record<number, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TableRow | null>(null);
  const [deleting, setDeleting] = useState<TableRow | null>(null);
  const [formNum, setFormNum] = useState("1");
  const [formStore, setFormStore] = useState("1");
  const [saving, setSaving] = useState(false);
  const [viewingQr, setViewingQr] = useState<TableRow | null>(null);

  const [branchTableCounts, setBranchTableCounts] = useState<Record<number, number>>({});

  const refreshBranchCounts = useCallback(() => {
    apiGet<any>("/admin/tables")
      .then((res) => {
        const rows = Array.isArray(res) ? res : res?.items || [];
        const counts: Record<number, number> = {};
        for (const t of rows) {
          counts[t.store_id] = (counts[t.store_id] || 0) + 1;
        }
        setBranchTableCounts(counts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshBranchCounts();
  }, [refreshBranchCounts]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rows: TableRow[] = [];
      if (branchFilter === "all") {
        // When showing all branches, fetch all tables to avoid cutting a branch's tables across multiple pages
        const res = await apiGet<any>("/admin/tables");
        rows = Array.isArray(res) ? res : res?.items || [];
        setTotalPages(1);
        setTotalTables(rows.length);
        const counts: Record<number, number> = {};
        for (const t of rows) {
          counts[t.store_id] = (counts[t.store_id] || 0) + 1;
        }
        setBranchTableCounts(counts);
      } else {
        const q = new URLSearchParams({ page: String(page), limit: "12", store_id: branchFilter });
        const res = await apiGet<any>(`/admin/tables?${q.toString()}`);
        if (Array.isArray(res)) {
          rows = res;
          setTotalPages(1);
          setTotalTables(rows.length);
        } else if (res && typeof res === "object") {
          rows = Array.isArray(res.items) ? res.items : [];
          if (res.pagination) {
            const tp = Math.max(1, res.pagination.totalPages || 1);
            setTotalPages(tp);
            setTotalTables(res.pagination.totalItems);
            if (res.pagination.totalPages > 0 && page > res.pagination.totalPages) {
              setPage(res.pagination.totalPages);
            }
          }
        }
      }
      setTables(rows);
      const newMap: Record<number, string> = {};
      await Promise.all(
        rows.map(async (r: TableRow) => {
          if (r.qr_checkout_token) {
            newMap[r.id] = await QRCode.toDataURL(qrUrl(r.qr_checkout_token), { width: 220, margin: 2 });
          }
        })
      );
      setQrMap(newMap);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được danh sách bàn");
    } finally {
      setLoading(false);
    }
  }, [branchFilter, page]);

  const handleBranchFilterChange = (val: string) => {
    setBranchFilter(val);
    setPage(1);
    if (typeof window !== "undefined") {
      if (val !== "all") {
        sessionStorage.setItem(TABLES_STORAGE_KEY, val);
      } else {
        sessionStorage.removeItem(TABLES_STORAGE_KEY);
      }
    }
    navigate({
      to: "/admin/vi-tri",
      search: (prev: any) => ({
        ...prev,
        store_id: val !== "all" ? val : undefined,
        page: undefined,
      }),
      replace: true,
    });
  };

  const handlePageChange = (p: number | ((prev: number) => number)) => {
    const nextVal = typeof p === "function" ? p(page) : p;
    setPage(nextVal);
    navigate({
      to: "/admin/vi-tri",
      search: (prev: any) => ({
        ...prev,
        page: nextVal > 1 ? nextVal : undefined,
      }),
      replace: true,
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromStorage = sessionStorage.getItem(TABLES_STORAGE_KEY);
    if (!search.store_id && fromStorage && fromStorage !== "all") {
      setBranchFilter(fromStorage);
      navigate({
        to: "/admin/vi-tri",
        search: (prev: any) => ({
          ...prev,
          store_id: fromStorage,
        }),
        replace: true,
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet<{ id: number; name: string }[]>("/admin/branches")
      .then(async (rawRows) => {
        const rows = Array.isArray(rawRows) ? rawRows : [];
        setBranches(rows);
        const map: Record<number, string> = {};
        await Promise.all(
          rows.map(async (b) => {
            map[b.id] = await QRCode.toDataURL(storeQrUrl(b.id), { width: 220, margin: 2 });
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

  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      if (a.store_id !== b.store_id) return a.store_id - b.store_id;
      const numA = tableNumber(a.name);
      const numB = tableNumber(b.name);
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id - b.id;
    });
  }, [tables]);

  const filtered = useMemo(() => {
    return branchFilter === "all"
      ? sortedTables
      : sortedTables.filter((t) => t.store_id === Number(branchFilter));
  }, [sortedTables, branchFilter]);

  const groupedByBranch = useMemo(() => {
    const groups: { store_id: number; store_name: string; tables: TableRow[] }[] = [];
    const map = new Map<number, { store_id: number; store_name: string; tables: TableRow[] }>();

    for (const t of filtered) {
      let group = map.get(t.store_id);
      if (!group) {
        group = { store_id: t.store_id, store_name: t.store_name, tables: [] };
        map.set(t.store_id, group);
        groups.push(group);
      }
      group.tables.push(t);
    }
    return groups;
  }, [filtered]);

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
      let createdQr: { id: number; token: string } | null = null;
      if (editing) {
        await apiPut(`/admin/tables/${editing.id}`, { name, store_id: Number(formStore) });
        toast.success(`Đã cập nhật ${name}`);
      } else {
        const created = await apiPost<TableQrResponse>("/admin/tables", { name, store_id: Number(formStore) });
        const dataUrl = await QRCode.toDataURL(qrUrl(created.qr_checkout_token), { width: 200, margin: 2 });
        createdQr = { id: created.id, token: dataUrl };
        toast.success(`Đã tạo ${name}`);
      }
      setDialogOpen(false);
      await load();
      if (createdQr) {
        setQrMap((current) => ({ ...current, [createdQr.id]: createdQr.token }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function rotateQr(t: TableRow) {
    try {
      const rotated = await apiPost<TableQrResponse>(`/admin/tables/${t.id}/rotate-qr`, {});
      const dataUrl = await QRCode.toDataURL(qrUrl(rotated.qr_checkout_token), { width: 200, margin: 2 });
      setQrMap((current) => ({ ...current, [t.id]: dataUrl }));
      setTables((current) => current.map((row) => row.id === t.id ? { ...row, has_checkout_qr: true } : row));
      toast.success(`Đã tạo QR checkout mới cho ${t.name}. Hãy in lại QR cũ.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tạo QR checkout mới");
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Vị trí & Mã QR bàn</h1>
          <p className="text-muted-foreground text-sm">
            Tạo vị trí, sinh mã QR riêng cho từng bàn — khách quét để đặt món trực tiếp tại bàn.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={branchFilter} onValueChange={handleBranchFilterChange}>
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
        <div className="space-y-8">
          {groupedByBranch.map((group) => (
            <div key={group.store_id} className="space-y-3.5">
              <div className="flex items-center justify-between border-b pb-2 pt-1">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <h2 className="font-display font-bold text-base text-foreground tracking-tight">
                    {group.store_name}
                  </h2>
                  <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                    {branchTableCounts[group.store_id] || group.tables.length} bàn
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {group.tables.map((t) => {
                  const hasQr = Boolean(qrMap[t.id]);
                  return (
                    <Card key={t.id} className="overflow-hidden">
                      <CardContent className="flex flex-col items-center gap-3 p-5">
                        <div className="bg-white rounded-2xl border p-4 shadow-2xs">
                          {hasQr ? (
                            <img
                              src={qrMap[t.id]}
                              alt={`QR ${t.name}`}
                              className="size-32 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setViewingQr(t)}
                              title="Click để phóng to mã QR"
                            />
                          ) : (
                            <div className="bg-muted flex size-32 flex-col items-center justify-center gap-1.5 p-2 text-center text-xs text-muted-foreground rounded-lg">
                              <span>Chưa tạo QR</span>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs font-semibold px-2.5 shadow-xs"
                                onClick={() => rotateQr(t)}
                              >
                                <Plus className="mr-1 size-3" /> Tạo QR
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="font-display font-bold">{t.name}</p>
                          <p className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
                            <MapPin className="size-3" /> {t.store_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingQr(t)}
                            disabled={!hasQr}
                            aria-label={`Xem mã QR ${t.name}`}
                            title={hasQr ? "Xem mã QR" : "Chưa có mã QR để xem"}
                            className="disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <QrIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadQr(t)}
                            disabled={!hasQr}
                            aria-label={`Tải mã QR ${t.name}`}
                            title={hasQr ? "Tải PNG" : "Chưa có mã QR để tải"}
                            className="disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Download className="size-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printQr(t)}
                            disabled={!hasQr}
                            aria-label={`In mã QR ${t.name}`}
                            title={hasQr ? "In QR" : "Chưa có mã QR để in"}
                            className="disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Printer className="size-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(t)}
                            aria-label={`Sửa ${t.name}`}
                            title="Sửa"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-berry hover:text-berry"
                            onClick={() => setDeleting(t)}
                            aria-label={`Xóa ${t.name}`}
                            title="Xóa"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        {!hasQr ? (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                            Chưa tạo QR
                          </Badge>
                        ) : t.is_active ? (
                          <Badge variant="secondary" className="bg-leaf/10 text-leaf font-medium">
                            Đang hoạt động
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Đã tắt
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tables.length > 0 && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          totalItems={totalTables}
          itemLabel="bàn"
          onPageChange={handlePageChange}
          loading={loading}
        />
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
      <Dialog open={!!viewingQr} onOpenChange={(open) => !open && setViewingQr(null)}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Mã QR - {viewingQr?.name}</DialogTitle>
          </DialogHeader>
          {viewingQr && qrMap[viewingQr.id] && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-5 rounded-2xl border shadow-sm">
                <img
                  src={qrMap[viewingQr.id]}
                  alt={`QR ${viewingQr.name}`}
                  className="size-48 sm:size-56 object-contain"
                />
              </div>
              <div className="text-sm">
                <p className="font-bold text-base">{viewingQr.name}</p>
                <p className="text-muted-foreground">{viewingQr.store_name}</p>
                <p className="text-xs text-muted-foreground mt-1">Quét mã để chọn món và đặt hàng trực tiếp tại bàn</p>
              </div>
              <div className="flex gap-2 w-full pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => downloadQr(viewingQr)}
                >
                  <Download className="mr-1.5 size-4" /> Tải ảnh
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => printQr(viewingQr)}
                >
                  <Printer className="mr-1.5 size-4" /> In mã QR
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
