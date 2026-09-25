import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShoppingCart, Trash2, X, Plus, Minus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost, clearToken, createIdempotencyKey, getUser } from "@/lib/api";
import { vnd, mapApiProduct, type ApiCatalogProduct, type Product, formatOrderItemOptions } from "@/lib/data";
import { DynamicProductConfigurator, type ConfiguredItemPayload } from "@/components/catalog/DynamicProductConfigurator";

export const Route = createFileRoute("/admin/pos")({
  head: () => ({
    meta: [
      { title: "POS Gọi Món | Admin Trà Trái Cây Tô" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PosPage,
});

type Store = { id: number; name: string };
type TableData = { id: number; name: string };
type SizeOption = { id: number; label: string; base_price_multiplier: number };
type ToppingOption = { id: number; name: string; price: number };

export type BootstrapSource = "branches" | "products" | "sizes" | "toppings" | "tables";

export type BootstrapErrors = {
  branches?: string | null;
  products?: string | null;
  sizes?: string | null;
  toppings?: string | null;
  tables?: string | null;
};

type PosCartItem = {
  uid: string;
  product_id: string;
  product_name: string;
  size_id: number | null;
  size_label: string;
  price: number;
  base_tea: string;
  sugar_level: string;
  ice_level: string;
  qty: number;
  note: string;
  toppings: { topping_id: number; name: string; price: number; qty: number }[];
};

function PosPage() {
  const currentUser = getUser();
  const canChooseStore = currentUser?.role === "super";
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [tables, setTables] = useState<TableData[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [toppings, setToppings] = useState<ToppingOption[]>([]);

  const [bootstrapErrors, setBootstrapErrors] = useState<BootstrapErrors>({});
  const [loadingSources, setLoadingSources] = useState<Record<BootstrapSource, boolean>>({
    branches: true,
    products: true,
    sizes: true,
    toppings: true,
    tables: false,
  });

  const inFlightSourcesRef = useRef<Set<BootstrapSource>>(new Set());
  const tableAbortControllerRef = useRef<AbortController | null>(null);
  const selectedStoreIdRef = useRef<number | null>(null);
  selectedStoreIdRef.current = selectedStoreId;

  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const orderRequestRef = useRef<{ signature: string; key: string } | null>(null);

  // Category filter
  const [activeTab, setActiveTab] = useState<string>("Tất cả");

  // Dialog state
  const [configuringProductSlug, setConfiguringProductSlug] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutQr, setCheckoutQr] = useState<string | null>(null);
  const [qrOrderCode, setQrOrderCode] = useState<string | null>(null);

  // 1. Independent source loaders
  const loadBranches = useCallback(async () => {
    if (inFlightSourcesRef.current.has("branches")) return;
    inFlightSourcesRef.current.add("branches");
    setLoadingSources((s) => ({ ...s, branches: true }));
    try {
      // This endpoint returns all branches only to Super. Manager/Cashier
      // receive exactly their JWT-scoped branch from the server.
      const st = await apiGet<Store[]>("/admin/branches");
      const list = Array.isArray(st) ? st : [];
      setStores(list);
      setBootstrapErrors((prev) => ({ ...prev, branches: null }));
      if (list.length > 0 && selectedStoreIdRef.current === null) {
        setSelectedStoreId(list[0].id);
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        clearToken();
        if (typeof window !== "undefined" && window.location.pathname !== "/admin/login") {
          window.location.href = "/admin/login";
        }
        return;
      }
      if (status === 403) {
        setBootstrapErrors((prev) => ({
          ...prev,
          branches: "Tài khoản không có quyền truy cập chi nhánh POS (403 Forbidden)",
        }));
        return;
      }
      setBootstrapErrors((prev) => ({
        ...prev,
        branches: err instanceof Error ? err.message : "Lỗi tải danh sách chi nhánh",
      }));
    } finally {
      inFlightSourcesRef.current.delete("branches");
      setLoadingSources((s) => ({ ...s, branches: false }));
    }
  }, []);

  const loadSizes = useCallback(async () => {
    if (inFlightSourcesRef.current.has("sizes")) return;
    inFlightSourcesRef.current.add("sizes");
    setLoadingSources((s) => ({ ...s, sizes: true }));
    try {
      const sz = await apiGet<SizeOption[]>("/api/options/sizes");
      setSizes(Array.isArray(sz) ? sz : []);
      setBootstrapErrors((prev) => ({ ...prev, sizes: null }));
    } catch (err: unknown) {
      setBootstrapErrors((prev) => ({
        ...prev,
        sizes: err instanceof Error ? err.message : "Lỗi tải kích thước món (sizes)",
      }));
    } finally {
      inFlightSourcesRef.current.delete("sizes");
      setLoadingSources((s) => ({ ...s, sizes: false }));
    }
  }, []);

  const loadToppings = useCallback(async () => {
    if (inFlightSourcesRef.current.has("toppings")) return;
    inFlightSourcesRef.current.add("toppings");
    setLoadingSources((s) => ({ ...s, toppings: true }));
    try {
      const top = await apiGet<ToppingOption[]>("/api/options/toppings");
      setToppings(Array.isArray(top) ? top : []);
      setBootstrapErrors((prev) => ({ ...prev, toppings: null }));
    } catch (err: unknown) {
      setBootstrapErrors((prev) => ({
        ...prev,
        toppings: err instanceof Error ? err.message : "Lỗi tải danh sách topping",
      }));
    } finally {
      inFlightSourcesRef.current.delete("toppings");
      setLoadingSources((s) => ({ ...s, toppings: false }));
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (inFlightSourcesRef.current.has("products")) return;
    inFlightSourcesRef.current.add("products");
    setLoadingSources((s) => ({ ...s, products: true }));
    try {
      const catalog = await apiGet<ApiCatalogProduct[]>("/api/products?lane=kitchen");
      // Never fall back to mock catalog in production runtime. POS only serves kitchen lane items; packaging items are strictly excluded.
      const mapped = Array.isArray(catalog) ? catalog.map(mapApiProduct) : [];
      setProducts(mapped.filter((p) => !p.fulfillment_lane || p.fulfillment_lane === 'kitchen'));
      setBootstrapErrors((prev) => ({ ...prev, products: null }));
    } catch (err: unknown) {
      setBootstrapErrors((prev) => ({
        ...prev,
        products: err instanceof Error ? err.message : "Lỗi tải danh mục món (products)",
      }));
    } finally {
      inFlightSourcesRef.current.delete("products");
      setLoadingSources((s) => ({ ...s, products: false }));
    }
  }, []);

  const loadTables = useCallback(async (selectedStoreId: number) => {
    if (tableAbortControllerRef.current) {
      tableAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    tableAbortControllerRef.current = controller;

    setLoadingSources((s) => ({ ...s, tables: true }));
    try {
      const res = await apiGet<TableData[]>(`/admin/tables?store_id=${selectedStoreId}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setTables(Array.isArray(res) ? res : []);
      setSelectedTableId(null);
      setBootstrapErrors((prev) => ({ ...prev, tables: null }));
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError" || controller.signal.aborted) return;
      setTables([]);
      setBootstrapErrors((prev) => ({
        ...prev,
        tables: err instanceof Error ? err.message : "Lỗi tải danh sách bàn",
      }));
    } finally {
      if (!controller.signal.aborted) {
        setLoadingSources((s) => ({ ...s, tables: false }));
      }
    }
  }, []);

  // Initial bootstrap: load branches, sizes, toppings, and products independently
  useEffect(() => {
    void loadBranches();
    void loadSizes();
    void loadToppings();
    void loadProducts();
  }, [loadBranches, loadSizes, loadToppings, loadProducts]);

  // Load tables when selectedStoreId changes, cancelling stale requests
  useEffect(() => {
    if (selectedStoreId != null) {
      void loadTables(selectedStoreId);
    } else {
      setTables([]);
      setSelectedTableId(null);
    }
    return () => {
      if (tableAbortControllerRef.current) {
        tableAbortControllerRef.current.abort();
      }
    };
  }, [selectedStoreId, loadTables]);

  const kitchenCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.line && p.line.trim()) {
        set.add(p.line.trim());
      }
    }
    return Array.from(set);
  }, [products]);

  useEffect(() => {
    if (activeTab !== "Tất cả" && !kitchenCategories.includes(activeTab)) {
      setActiveTab("Tất cả");
    }
  }, [kitchenCategories, activeTab]);

  const filteredProducts = useMemo(() => {
    if (activeTab === "Tất cả") return products;
    return products.filter((p) => p.line === activeTab);
  }, [products, activeTab]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const itemPrice = item.price;
      const toppingPrice = item.toppings.reduce((sum, t) => sum + t.price * t.qty, 0);
      return acc + (itemPrice + toppingPrice) * item.qty;
    }, 0);
  }, [cart]);

  function handleProductClick(p: Product) {
    setConfiguringProductSlug(p.slug || p.id);
    setIsConfigOpen(true);
  }

  function handleAddToCartFromConfigurator(configuredItem: ConfiguredItemPayload) {
    const sugarModifier = configuredItem.appliedModifiers.find(
      (m) => m.attribute_code === 'sugar' || m.attribute_name?.toLowerCase().includes('đường')
    );
    const iceModifier = configuredItem.appliedModifiers.find(
      (m) => m.attribute_code === 'ice' || m.attribute_name?.toLowerCase().includes('đá')
    );
    const toppingModifiers = configuredItem.appliedModifiers.filter(
      (m) => m.attribute_code === 'topping' || m.attribute_name?.toLowerCase().includes('topping')
    );

    const cartToppings = toppingModifiers.map((t) => ({
      topping_id: Number(t.attribute_value_id || t.value_id || 0),
      name: t.value_label || t.attribute_name,
      price: Number(t.price_adjustment || 0),
      qty: 1,
    }));

    const newItem: PosCartItem = {
      uid: crypto.randomUUID(),
      product_id: String(configuredItem.productId),
      product_name: configuredItem.productName,
      size_id: configuredItem.variantId,
      size_label: configuredItem.variantName?.replace(/^Size\s*/i, '').trim() || (configuredItem.variantName || 'M'),
      price: configuredItem.unitPrice,
      base_tea: '', // Nhóm Cốt trà bỏ luôn không còn sài
      sugar_level: sugarModifier?.value_label || '',
      ice_level: iceModifier?.value_label || '',
      qty: configuredItem.quantity,
      note: '',
      toppings: cartToppings,
    };

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) =>
          item.product_id === newItem.product_id &&
          item.size_id === newItem.size_id &&
          item.sugar_level === newItem.sugar_level &&
          item.ice_level === newItem.ice_level &&
          item.note === newItem.note &&
          JSON.stringify(item.toppings) === JSON.stringify(newItem.toppings)
      );

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].qty += newItem.qty;
        return copy;
      }
      return [...prev, newItem];
    });

    setIsConfigOpen(false);
    setConfiguringProductSlug(null);
  }

  function removeFromCart(uid: string) {
    setCart(prev => prev.filter(i => i.uid !== uid));
  }

  function adjustCartQty(uid: string, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.uid === uid) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  }

  async function checkout() {
    if (!selectedStoreId) return toast.error("Vui lòng chọn chi nhánh");
    if (cart.length === 0) return toast.error("Giỏ hàng trống");
    
    setSubmitting(true);
    try {
      const payload = {
        store_id: selectedStoreId,
        table_id: selectedTableId,
        order_type: "POS",
        payment_method: "COD",
        customer_name: "Khách Tại Quầy",
        customer_phone: "0000000000",
        source: "pos",
        items: cart.map(i => ({
          product_id: Number(i.product_id),
          size_id: i.size_id,
          base_tea: i.base_tea,
          sugar_level: i.sugar_level,
          ice_level: i.ice_level,
          qty: i.qty,
          note: i.note,
          topping_ids: i.toppings.map(t => Number(t.topping_id)),
          toppings: i.toppings.map(t => ({ topping_id: t.topping_id, qty: t.qty })),
        })),
      };

      const signature = JSON.stringify(payload);
      const previousRequest = orderRequestRef.current;
      const idempotencyKey = previousRequest?.signature === signature
        ? previousRequest.key
        : createIdempotencyKey();
      orderRequestRef.current = { signature, key: idempotencyKey };

      const res = await apiPost<{ order_code: string; order_id: number; total: number; qr_code?: string; checkout_url?: string }>(
        "/admin/pos/orders",
        payload,
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      orderRequestRef.current = null;
      if (res.qr_code) {
        setCheckoutQr(res.qr_code);
        setQrOrderCode(res.order_code);
      } else {
        toast.success(`Tạo đơn POS thành công: ${res.order_code}`);
      }
      setCart([]);
      setSelectedTableId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tạo đơn thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  const isInitialLoading =
    (loadingSources.branches && stores.length === 0 && !bootstrapErrors.branches) ||
    (loadingSources.products && products.length === 0 && !bootstrapErrors.products);

  if (isInitialLoading) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 className="animate-spin size-8 text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Đang khởi tạo hệ thống POS...</p>
      </div>
    );
  }

  const cartContent = (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <div className="p-4 sm:p-5 border-b font-display bg-background flex justify-between items-center z-10 shrink-0">
        <span className="font-bold text-base sm:text-lg">Giỏ hàng ({cart.reduce((a, c) => a + c.qty, 0)})</span>
        {cart.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-berry hover:bg-berry/10 hover:text-berry rounded-lg font-semibold transition-colors text-xs"
            onClick={() => setCart([])}
          >
            <Trash2 className="size-3.5 mr-1.5" /> Xóa hết
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-3 sm:p-4 bg-muted/5">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm py-20 sm:py-24 opacity-60">
            <ShoppingCart className="size-12 mb-3 text-muted-foreground/50" />
            <p className="font-medium">Chưa có món nào trong giỏ</p>
            <p className="text-xs mt-1">Chọn món ở menu để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {cart.map((item) => (
              <div
                key={item.uid}
                className="bg-background border rounded-2xl p-3 sm:p-4 relative shadow-sm group hover:border-primary/50 transition-colors flex gap-3 sm:gap-4"
              >
                <button
                  className="absolute top-2 right-2 text-muted-foreground hover:bg-berry/10 hover:text-berry rounded-full p-1.5 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 z-10"
                  onClick={() => removeFromCart(item.uid)}
                  aria-label="Xóa món"
                >
                  <X className="size-4" />
                </button>

                <div
                  className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-muted/20 mt-1 cursor-pointer"
                  onClick={() => {
                    const p = products.find((x) => String(x.id) === String(item.product_id));
                    setConfiguringProductSlug(p?.slug || item.product_id);
                    setIsConfigOpen(true);
                  }}
                >
                  <img
                    src={
                      products.find((p) => String(p.id) === String(item.product_id))?.image ||
                      (products.find((p) => String(p.id) === String(item.product_id)) as any)?.image_url ||
                      "/images/products/tra-xoai.jpg"
                    }
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div
                    className="pr-6 cursor-pointer"
                    onClick={() => {
                      const p = products.find((x) => String(x.id) === String(item.product_id));
                      setConfiguringProductSlug(p?.slug || item.product_id);
                      setIsConfigOpen(true);
                    }}
                  >
                    <p className="font-bold text-sm leading-tight truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {formatOrderItemOptions(item)}
                      {item.note && <span className="block italic mt-0.5 opacity-80">Ghi chú: {item.note}</span>}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-dashed gap-2">
                    <div className="flex items-center bg-muted/30 rounded-xl border p-0.5 sm:p-1">
                      <button
                        className="p-1 hover:bg-background hover:shadow-sm rounded-lg text-muted-foreground transition-all"
                        onClick={() => adjustCartQty(item.uid, -1)}
                        aria-label="Giảm số lượng"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-7 sm:w-8 text-center text-xs sm:text-sm font-bold">{item.qty}</span>
                      <button
                        className="p-1 hover:bg-background hover:shadow-sm rounded-lg text-muted-foreground transition-all"
                        onClick={() => adjustCartQty(item.uid, 1)}
                        aria-label="Tăng số lượng"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="font-extrabold text-primary text-sm sm:text-base whitespace-nowrap">
                      {vnd(
                        (item.price + item.toppings.reduce((s, t) => s + t.price * t.qty, 0)) * item.qty,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="h-6"></div>
      </ScrollArea>

      <div className="p-4 sm:p-5 border-t bg-background space-y-3 sm:space-y-4 shrink-0 z-10">
        <div className="flex justify-between items-end bg-gradient-to-r from-muted/50 to-muted/20 p-3 sm:p-4 rounded-2xl border border-muted">
          <span className="text-muted-foreground font-bold text-xs sm:text-sm">Tổng thanh toán</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-leaf font-display tracking-tight drop-shadow-sm">
            {vnd(cartTotal)}
          </span>
        </div>

        <Button
          variant="hero"
          className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-2xl shadow-glow font-bold tracking-wide"
          disabled={cart.length === 0 || submitting}
          onClick={() => {
            setMobileCartOpen(false);
            checkout();
          }}
        >
          {submitting ? <Loader2 className="animate-spin size-5" /> : "Xác nhận & Thu tiền ngay"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-muted/10 relative">
      {/* Top POS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background border-b px-4 py-3 sm:px-5 sm:py-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <ShoppingCart className="text-leaf size-5 sm:size-6 shrink-0" />
          <h1 className="font-bold font-display text-lg sm:text-xl tracking-tight whitespace-nowrap">
            POS Gọi Món
          </h1>

          {canChooseStore ? (
            <Select value={String(selectedStoreId || "")} onValueChange={(v) => setSelectedStoreId(Number(v))}>
              <SelectTrigger className="w-[180px] sm:w-[220px] h-9 sm:h-10 rounded-xl bg-muted/20 border-transparent hover:bg-muted/40 transition-colors font-medium text-xs sm:text-sm">
                <SelectValue placeholder="Chọn chi nhánh" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {stores.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary" className="h-9 sm:h-10 px-3 rounded-xl font-medium text-xs sm:text-sm">
              {stores.find((store) => store.id === selectedStoreId)?.name || "Chi nhánh được phân công"}
            </Badge>
          )}
        </div>

        <div className="flex-1 overflow-x-auto whitespace-nowrap no-scrollbar pb-0.5 sm:pb-0">
          <div className="flex gap-1.5 sm:gap-2 items-center">
            <Badge
              variant={selectedTableId === null ? "default" : "outline"}
              className={`${loadingSources.tables ? "cursor-wait opacity-60" : "cursor-pointer"} px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                selectedTableId === null
                  ? "bg-leaf hover:bg-leaf/90 shadow-glow text-primary-foreground border-transparent"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => {
                if (!loadingSources.tables) setSelectedTableId(null);
              }}
            >
              Mang đi
            </Badge>
            {tables.map((t) => (
              <Badge
                key={t.id}
                variant={selectedTableId === t.id ? "default" : "outline"}
                className={`${loadingSources.tables ? "cursor-wait opacity-60" : "cursor-pointer"} px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedTableId === t.id
                    ? "bg-primary hover:bg-primary/90 shadow-glow text-primary-foreground border-transparent"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => {
                  if (!loadingSources.tables) setSelectedTableId(t.id);
                }}
              >
                {t.name}
              </Badge>
            ))}
            {loadingSources.tables && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Đang tải bàn" />}
            {bootstrapErrors.tables && (
              <div className="inline-flex items-center gap-1 text-xs text-destructive">
                <span>⚠️ {bootstrapErrors.tables}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs underline text-destructive hover:bg-destructive/10"
                  disabled={loadingSources.tables || !selectedStoreId}
                  onClick={() => selectedStoreId && void loadTables(selectedStoreId)}
                >
                  Thử lại
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Source Bootstrap Error Banners */}
      {bootstrapErrors.branches && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm p-3 mx-4 mt-3 rounded-xl flex items-center justify-between shadow-xs">
          <span>⚠️ Lỗi chi nhánh: {bootstrapErrors.branches}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-destructive/30 hover:bg-destructive/20"
            disabled={loadingSources.branches}
            onClick={() => void loadBranches()}
          >
            {loadingSources.branches ? <Loader2 className="animate-spin size-3 mr-1" /> : null}
            Thử lại
          </Button>
        </div>
      )}

      {(bootstrapErrors.sizes || bootstrapErrors.toppings) && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs sm:text-sm p-3 mx-4 mt-2 rounded-xl flex items-center justify-between shadow-xs">
          <span>
            ⚠️ Lỗi tùy chọn: {[bootstrapErrors.sizes, bootstrapErrors.toppings].filter(Boolean).join(" · ")}
          </span>
          <div className="flex gap-2">
            {bootstrapErrors.sizes && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/20"
                disabled={loadingSources.sizes}
                onClick={() => void loadSizes()}
              >
                {loadingSources.sizes ? <Loader2 className="animate-spin size-3 mr-1" /> : null}
                Thử lại Sizes
              </Button>
            )}
            {bootstrapErrors.toppings && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/20"
                disabled={loadingSources.toppings}
                onClick={() => void loadToppings()}
              >
                {loadingSources.toppings ? <Loader2 className="animate-spin size-3 mr-1" /> : null}
                Thử lại Toppings
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: MENU */}
        <div className="w-full md:w-[55%] lg:w-[65%] flex flex-col bg-slate-50/50 border-r pb-20 md:pb-0">
          <div className="p-3 sm:p-4 border-b bg-background/95 backdrop-blur z-10 flex items-center justify-between gap-2">
            <span className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
              Danh mục món
            </span>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-[160px] sm:w-[200px] h-9 bg-background font-semibold shadow-sm rounded-xl text-xs sm:text-sm">
                <SelectValue placeholder="Chọn danh mục" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="Tất cả">Tất cả món</SelectItem>
                {kitchenCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 p-3 sm:p-5">
            {bootstrapErrors.products ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                <div className="p-3 rounded-full bg-destructive/10 text-destructive">
                  <X className="size-8" />
                </div>
                <p className="font-bold text-base text-foreground">Không thể tải danh sách món</p>
                <p className="text-xs text-muted-foreground max-w-sm">{bootstrapErrors.products}</p>
                <Button
                  variant="hero"
                  size="sm"
                  disabled={loadingSources.products}
                  onClick={() => void loadProducts()}
                  className="text-xs font-bold"
                >
                  {loadingSources.products ? <Loader2 className="animate-spin size-3.5 mr-1" /> : null}
                  Thử lại tải thực đơn
                </Button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 text-muted-foreground">
                <ShoppingCart className="size-12 mb-3 text-muted-foreground/40" />
                <p className="font-medium text-sm">Chưa có món nào trong thực đơn</p>
                <p className="text-xs mt-1">
                  {activeTab === "Tất cả" ? "Danh mục món hiện đang trống." : `Không tìm thấy món thuộc nhóm "${activeTab}".`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {filteredProducts.map((p) => (
                  <Card
                    key={p.id}
                    className="group cursor-pointer hover:border-leaf transition-all duration-300 hover:-translate-y-1 hover:shadow-glow overflow-hidden flex flex-col rounded-2xl bg-card border-transparent shadow-card-soft"
                    onClick={() => handleProductClick(p)}
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-muted/10 relative">
                      <img
                        src={p.image || (p as any).image_url || "/images/products/tra-xoai.jpg"}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-1.5 sm:gap-2">
                      <p className="font-semibold text-xs sm:text-sm leading-snug line-clamp-2" title={p.name}>
                        {p.name}
                      </p>
                      <p className="text-leaf font-extrabold text-xs sm:text-base">{vnd(p.price)}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            <div className="h-8"></div>
          </ScrollArea>
        </div>

        {/* RIGHT: DESKTOP & TABLET CART SIDEBAR */}
        <div className="hidden md:flex md:w-[45%] lg:w-[35%] flex-col bg-background relative shadow-[-8px_0_32px_-12px_rgba(0,0,0,0.08)] z-20">
          {cartContent}
        </div>
      </div>

      {/* MOBILE BOTTOM FLOATING CART BAR */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t p-3 shadow-lg z-30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <ShoppingCart className="text-leaf size-6" />
            {cart.length > 0 && (
              <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full text-[10px] font-bold">
                {cart.reduce((a, c) => a + c.qty, 0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium uppercase">Tổng tiền</p>
            <p className="text-base font-extrabold text-leaf leading-tight">{vnd(cartTotal)}</p>
          </div>
        </div>

        <Button
          variant="hero"
          size="sm"
          className="rounded-xl font-bold px-4 h-10 shadow-glow"
          onClick={() => setMobileCartOpen(true)}
        >
          Xem giỏ ({cart.reduce((a, c) => a + c.qty, 0)})
        </Button>
      </div>

      {/* MOBILE CART SHEET DRAWER */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col rounded-t-3xl overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Giỏ hàng POS</SheetTitle>
          </SheetHeader>
          {cartContent}
        </SheetContent>
      </Sheet>

      {/* OPTIONS CONFIGURATOR DÙNG CHUẨN CATALOG LANE KITCHEN */}
      {configuringProductSlug && (
        <DynamicProductConfigurator
          open={isConfigOpen}
          onOpenChange={(open) => {
            setIsConfigOpen(open);
            if (!open) setConfiguringProductSlug(null);
          }}
          productSlug={configuringProductSlug}
          storeId={selectedStoreId || undefined}
          mode="add"
          onAddToCart={handleAddToCartFromConfigurator}
        />
      )}

      {/* QR CODE DIALOG */}
      <Dialog open={!!checkoutQr} onOpenChange={(open) => !open && setCheckoutQr(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-6 overflow-hidden border-transparent shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold tracking-tight">Thanh toán VietQR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-muted-foreground text-sm">Mã đơn: <strong className="text-foreground">{qrOrderCode}</strong></p>
            <div className="bg-white p-4 rounded-2xl shadow-sm border">
              {checkoutQr && <img src={checkoutQr} alt="VietQR" className="w-48 h-48 object-contain" />}
            </div>
            <p className="text-sm">Vui lòng cho khách hàng quét mã này để hoàn tất thanh toán (PayOS).</p>
          </div>
          <DialogFooter>
            <Button variant="hero" className="w-full rounded-xl shadow-glow font-bold" onClick={() => {
              setCheckoutQr(null);
              toast.success(`Đã tạo đơn ${qrOrderCode} thành công!`);
            }}>
              Đóng lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
