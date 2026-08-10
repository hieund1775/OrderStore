import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Flame, MapPin, Phone, Printer, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InBillModal, type BillOrder } from "@/components/admin/InBillModal";
import { PrinterPairingModal } from "@/components/admin/PrinterPairingModal";
import { apiGet, apiPatch } from "@/lib/api";
import { fmtDateTime, fmtTime, parseLocalDate } from "@/lib/data";
import { isAutoPrintEnabled, setAutoPrintEnabled, isOrderPrinted, silentPrintTicket, getActivePrinterConfig, type ActivePrinterConfig } from "@/lib/auto-print";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/bep")({
  head: () => ({
    meta: [
      { title: "Màn hình bếp KDS | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Kitchen Display System với thẻ đơn lớn, màu trạng thái trực quan và cảnh báo quá 15 phút.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KdsPage,
});

type KitchenTopping = { name: string; price: number };
type KitchenItem = {
  id: number;
  product_name: string;
  qty: number;
  size_label: string;
  base_tea: string;
  sugar_level: string;
  ice_level: string;
  note: string | null;
  line_total: number;
  toppings: KitchenTopping[];
};
type KitchenOrder = {
  id: number;
  order_code: string;
  order_type: string;
  customer_name: string;
  customer_phone: string;
  table_id: number | null;
  store_id: number;
  location_name: string | null;
  note: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  created_at: string;
  store_name: string;
  current_status: string;
  items: KitchenItem[];
};

function toBillOrder(o: KitchenOrder): BillOrder {
  return {
    id: o.id,
    order_code: o.order_code,
    store_id: o.store_id,
    store_name: o.store_name,
    location_name: o.location_name,
    order_type: o.order_type,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    payment_method: o.payment_method,
    created_at: o.created_at,
    items: o.items.map((it) => ({
      product_name: it.product_name,
      qty: it.qty,
      size_label: it.size_label,
      note: it.note,
      toppings: it.toppings,
      line_total: it.line_total,
    })),
    subtotal: o.subtotal,
    discount_amount: o.discount_amount,
    total: o.total,
  };
}

type Lane = "prep" | "done";

const lanes: { id: Lane; label: string; ring: string }[] = [
  { id: "prep", label: "🔴 Đang chuẩn bị (Pha chế)", ring: "border-primary/40 bg-primary/5" },
  { id: "done", label: "🟢 Hoàn thành", ring: "border-leaf/40 bg-leaf/5" },
];

const DONE_AFTER_MS = 5 * 60 * 1000;
const LATE_AFTER_MINUTES = 15;
const POLL_MS = 10_000;

function laneOf(status: string): Lane {
  if (status === "Hoàn thành" || status === "Đang giao") return "done";
  return "prep";
}

function fmtMinutes(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const s = Math.max(0, Math.floor((ms % 60000) / 1000));
  return `${m}′${String(s).padStart(2, "0")}″`;
}

let audioCtx: AudioContext | null = null;

function playDingDong() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const now = audioCtx.currentTime;
    const playNote = (freq: number, at: number, dur: number) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    };
    playNote(1318.5, now, 0.6); // E6
    playNote(1046.5, now + 0.35, 0.9); // C6
  } catch {
    /* audio bị chặn — bỏ qua, chỉ toast */
  }
}

function KdsPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [doneOrders, setDoneOrders] = useState<KitchenOrder[]>([]);
  const [doneAt, setDoneAt] = useState<Record<number, number>>({});
  const [newIds, setNewIds] = useState<Record<number, boolean>>({});
  const [selected, setSelected] = useState<KitchenOrder | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoPrint, setAutoPrint] = useState(() => isAutoPrintEnabled());
  const [pairingOpen, setPairingOpen] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<ActivePrinterConfig | null>(() => getActivePrinterConfig());
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [storeFilter, setStoreFilter] = useState("all");
  const prevIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    apiGet<{ id: number; name: string }[]>("/admin/branches")
      .then(setBranches)
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const query = storeFilter !== "all" ? `?store_id=${storeFilter}` : "";
      const rows = await apiGet<KitchenOrder[]>(`/admin/kitchen/orders${query}`);
      setOrders(rows);
      const ids = new Set(rows.map((o) => o.id));
      const fresh = rows.filter((o) => !prevIds.current.has(o.id));
      if (fresh.length > 0) {
        setNewIds((s) => ({ ...s, ...Object.fromEntries(fresh.map((o) => [o.id, true])) }));
        if (soundEnabled) {
          playDingDong();
          toast.success(`Có ${fresh.length} đơn mới!`, { description: fresh[0].order_code });
        }

        // Tự động in ticket bếp nếu tính năng Auto-Print được bật
        if (isAutoPrintEnabled()) {
          fresh.forEach((o) => {
            if (!isOrderPrinted(o.order_code)) {
              silentPrintTicket(o);
            }
          });
        }

        setTimeout(() => {
          setNewIds((s) => {
            const next = { ...s };
            fresh.forEach((o) => delete next[o.id]);
            return next;
          });
        }, 6000);
      }
      prevIds.current = ids;
    } catch {
      /* server tạm ngắt — giữ trạng thái cũ */
    }
  }, [soundEnabled, storeFilter]);

  // Polling realtime & Storage Event Listener cho Standalone mode
  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, POLL_MS);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "teaplus_orders") {
        fetchOrders();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      clearInterval(t);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchOrders]);

  // Tick 1 giây: đồng hồ phút + tự ẩn đơn hoàn thành sau 5 phút
  useEffect(() => {
    const t = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      setDoneOrders((prev) => prev.filter((o) => ts - (doneAt[o.id] || ts) < DONE_AFTER_MS));
    }, 1000);
    return () => clearInterval(t);
  }, [doneAt]);

  async function move(o: KitchenOrder, target: "prep" | "done") {
    const status = target === "prep" ? "Đang chuẩn bị" : "Hoàn thành";
    try {
      await apiPatch(`/admin/orders/${o.id}/status`, { status });
      if (target === "done") {
        setDoneAt((s) => ({ ...s, [o.id]: Date.now() }));
        setDoneOrders((s) => [...s.filter((x) => x.id !== o.id), o]);
      }
      toast.success(`Đơn ${o.order_code} → ${lanes.find((l) => l.id === target)?.label}`);
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chuyển trạng thái thất bại");
    }
  }

  async function moveBack(o: KitchenOrder) {
    try {
      await apiPatch(`/admin/orders/${o.id}/status`, { status: "Đang chuẩn bị" });
      setDoneOrders((s) => s.filter((x) => x.id !== o.id));
      toast.success(`Đơn ${o.order_code} → 🟡 Đang chuẩn bị`);
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lùi trạng thái thất bại");
    }
  }

  const orderInLane = (lane: Lane): KitchenOrder[] => {
    if (lane === "done") return doneOrders;
    return orders.filter((o) => laneOf(o.current_status) === lane);
  };

  return (
    <>
      <AdminPageHeader
        title="Màn hình bếp (KDS)"
        desc="Đơn quá 15 phút sẽ chuyển đỏ — đơn hoàn thành tự ẩn sau 5 phút"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Lọc bếp chi nhánh:</span>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-48 h-8 text-xs">
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
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Printer Recognition Status Badge Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPairingOpen(true)}
            className="text-xs font-semibold gap-1.5"
          >
            <Printer className="size-3.5 text-primary" />
            {printerConfig ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                🟢 Đã nối: {printerConfig.device_name}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                🔴 Chưa cấu hình máy in
              </span>
            )}
          </Button>

          <div className="flex items-center gap-2 rounded-full border px-3 py-1 bg-card text-xs shadow-xs">
            <span className="font-semibold">Tự động in ticket</span>
            <Switch
              checked={autoPrint}
              onCheckedChange={(checked) => {
                setAutoPrint(checked);
                setAutoPrintEnabled(checked);
                toast.info(checked ? "Đã bật tự động in ticket bếp khi có đơn mới" : "Đã tắt tự động in ticket bếp");
              }}
            />
          </div>
          <Button
            variant={soundEnabled ? "hero" : "outline"}
            size="sm"
            onClick={() => {
              setSoundEnabled((v) => !v);
              if (!soundEnabled) playDingDong();
            }}
            aria-pressed={soundEnabled}
          >
            <Volume2 className="size-4" />
            {soundEnabled ? "Chuông báo: BẬT" : "Chuông báo: TẮT"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {lanes.map((lane) => {
          const laneOrders = orderInLane(lane.id);
          return (
            <section key={lane.id} className={`rounded-2xl border p-4 ${lane.ring}`}>
              <p className="mb-4 flex items-center justify-between text-sm font-bold">
                {lane.label}
                <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                  {laneOrders.length}
                </span>
              </p>
              <div className="space-y-4">
                {laneOrders.map((o) => {
                  const age = now - parseLocalDate(o.created_at).getTime();
                  const late = lane.id !== "done" && age > LATE_AFTER_MINUTES * 60000;
                  const isNew = !!newIds[o.id];
                  return (
                    <article
                      key={o.id}
                      onClick={() => setSelected(o)}
                      className={`bg-card cursor-pointer rounded-2xl border-2 p-4 transition-colors ${
                        late
                          ? "border-berry animate-pulse shadow-[0_0_0_1px_theme(colors.berry/40)]"
                          : isNew
                            ? "border-primary animate-pulse"
                            : "border-transparent hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-display text-lg font-extrabold">{o.order_code}</p>
                        <span
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                            late
                              ? "bg-berry text-berry-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {late ? <Flame className="size-3" /> : <Clock className="size-3" />}
                          Đặt lúc {fmtTime(o.created_at)} {late ? `(Trễ ${Math.floor(age / 60000)}p)` : `(${fmtMinutes(age)})`}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                        {o.location_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" /> {o.location_name}
                          </span>
                        )}
                        <span>{o.store_name}</span>
                      </p>
                      <ul className="mt-3 space-y-2">
                        {o.items.map((it) => (
                          <li key={it.id} className="border-l-4 border-primary/40 pl-3">
                            <p className="text-base font-semibold">
                              {it.qty}× {it.product_name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {it.size_label} · {it.base_tea} · {it.sugar_level} đường ·{" "}
                              {it.ice_level} đá
                              {it.toppings.length > 0 &&
                                ` · ${it.toppings.map((t) => t.name).join(", ")}`}
                            </p>
                            {it.note && (
                              <p className="text-muted-foreground text-xs italic">📝 {it.note}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex gap-2">
                        {lane.id === "done" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveBack(o);
                            }}
                          >
                            Lùi lại
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="hero"
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                move(o, "done");
                              }}
                            >
                              Hoàn thành
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
                {laneOrders.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-sm">Chưa có đơn nào.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Đơn {selected?.order_code}
              {selected && (
                <Badge
                  variant="secondary"
                  className={
                    selected.current_status === "Hoàn thành"
                      ? "bg-leaf/10 text-leaf"
                      : "bg-primary/10 text-primary"
                  }
                >
                  {selected.current_status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setBillOpen(true)}>
              <Printer className="size-4" /> In hóa đơn
            </Button>
          </div>
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-xl p-3 text-sm">
                <p className="flex items-center gap-2">
                  <MapPin className="text-primary size-4" />
                  {selected.location_name || "Không có bàn"} · {selected.store_name}
                </p>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <Phone className="size-3.5" /> {selected.customer_phone || "—"} ·{" "}
                  {selected.customer_name}
                </p>
                <p className="text-muted-foreground mt-1">
                  Loại đơn: {selected.order_type} · Tạo lúc{" "}
                  {fmtDateTime(selected.created_at)}
                </p>
              </div>
              <ul className="space-y-2">
                {selected.items.map((it) => (
                  <li key={it.id} className="border-l-4 border-primary/40 pl-3 text-sm">
                    <p className="font-semibold">
                      {it.qty}× {it.product_name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {it.size_label} · {it.base_tea} · {it.sugar_level} đường · {it.ice_level} đá
                      {it.toppings.length > 0 && ` · ${it.toppings.map((t) => t.name).join(", ")}`}
                    </p>
                    {it.note && (
                      <p className="text-muted-foreground text-xs italic">📝 {it.note}</p>
                    )}
                  </li>
                ))}
              </ul>
              {selected.note && (
                <p className="bg-accent/40 text-accent-foreground rounded-lg p-3 text-sm">
                  📝 Ghi chú đơn: {selected.note}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <InBillModal
        order={selected ? toBillOrder(selected) : null}
        open={billOpen}
        onClose={() => setBillOpen(false)}
      />

      <PrinterPairingModal
        open={pairingOpen}
        onOpenChange={setPairingOpen}
        onConfigSaved={() => setPrinterConfig(getActivePrinterConfig())}
      />
    </>
  );
}
