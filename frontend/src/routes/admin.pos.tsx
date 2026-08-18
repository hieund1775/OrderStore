import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShoppingCart, Trash2, X, Plus, Minus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost, createIdempotencyKey } from "@/lib/api";
import { vnd, mapApiProduct, type ApiCatalogProduct, type Product, products as mockProducts, teaLines, fruitGroups, baseOptions, sugarOptions, iceOptions } from "@/lib/data";

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
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [tables, setTables] = useState<TableData[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [toppings, setToppings] = useState<ToppingOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [submitting, setSubmitting] = useState(false);
  const orderRequestRef = useRef<{ signature: string; key: string } | null>(null);

  // Category filter
  const [activeTab, setActiveTab] = useState<string>("Tất cả");

  // Dialog state
  const [editingItem, setEditingItem] = useState<PosCartItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [checkoutQr, setCheckoutQr] = useState<string | null>(null);
  const [qrOrderCode, setQrOrderCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<Store[]>("/api/stores"),
      apiGet<SizeOption[]>("/api/options/sizes"),
      apiGet<ToppingOption[]>("/api/options/toppings"),
      apiGet<ApiCatalogProduct[]>("/api/products"),
    ]).then(([st, sz, top, catalog]) => {
      if (cancelled) return;
      setStores(st);
      if (st.length > 0) setSelectedStoreId(st[0].id);
      setProducts(catalog.length > 0 ? catalog.map(mapApiProduct) : mockProducts);
      setSizes(sz);
      setToppings(top);
      setLoading(false);
    }).catch(err => {
      toast.error(err instanceof Error ? err.message : "Lỗi tải dữ liệu POS");
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedStoreId) return;
    let cancelled = false;
    apiGet<TableData[]>(`/api/tables?store_id=${selectedStoreId}`).then(res => {
      if (!cancelled) {
        setTables(res);
        setSelectedTableId(null);
      }
    }).catch(() => setTables([]));
    return () => { cancelled = true; };
  }, [selectedStoreId]);

  const filteredProducts = useMemo(() => {
    if (activeTab === "Tất cả") return products;
    return products.filter(p => p.line === activeTab);
  }, [products, activeTab]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const itemPrice = item.price;
      const toppingPrice = item.toppings.reduce((sum, t) => sum + t.price * t.qty, 0);
      return acc + (itemPrice + toppingPrice) * item.qty;
    }, 0);
  }, [cart]);

  function handleProductClick(p: Product) {
    const defaultSize = sizes.length > 0 ? sizes[0] : null;
    const newItem: PosCartItem = {
      uid: crypto.randomUUID(),
      product_id: p.id,
      product_name: p.name,
      size_id: defaultSize ? defaultSize.id : null,
      size_label: defaultSize ? defaultSize.label : "M",
      price: p.price,
      base_tea: baseOptions[0],
      sugar_level: "100%",
      ice_level: "100%",
      qty: 1,
      note: "",
      toppings: [],
    };
    setEditingItem(newItem);
    setIsDialogOpen(true);
  }

  function saveItemToCart() {
    if (!editingItem) return;
    
    setCart(prev => {
      // Check if exact same item exists (excluding uid)
      const existingIdx = prev.findIndex(item => 
        item.product_id === editingItem.product_id &&
        item.size_id === editingItem.size_id &&
        item.base_tea === editingItem.base_tea &&
        item.sugar_level === editingItem.sugar_level &&
        item.ice_level === editingItem.ice_level &&
        item.note === editingItem.note &&
        JSON.stringify(item.toppings) === JSON.stringify(editingItem.toppings)
      );

      if (existingIdx >= 0 && prev[existingIdx].uid !== editingItem.uid) {
        // Increment qty of existing
        const copy = [...prev];
        copy[existingIdx].qty += editingItem.qty;
        return copy;
      }

      // If it's an update to an existing uid, replace it
      const isUpdate = prev.some(item => item.uid === editingItem.uid);
      if (isUpdate) {
        return prev.map(item => item.uid === editingItem.uid ? editingItem : item);
      }

      // Otherwise, add new
      return [...prev, editingItem];
    });
    setIsDialogOpen(false);
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
        payment_method: paymentMethod,
        customer_name: "Khách tại quầy",
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
        "/api/orders",
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

  if (loading) {
    return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></div>;
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-muted/10">
      {/* Top POS Header */}
      <div className="flex items-center gap-4 bg-background border-b px-5 py-4 shrink-0 shadow-sm z-10">
        <ShoppingCart className="text-leaf size-6" />
        <h1 className="font-bold font-display text-xl mr-4 tracking-tight">POS Gọi Món</h1>
        
        <Select value={String(selectedStoreId || "")} onValueChange={(v) => setSelectedStoreId(Number(v))}>
          <SelectTrigger className="w-[220px] h-10 rounded-xl bg-muted/20 border-transparent hover:bg-muted/40 transition-colors font-medium">
            <SelectValue placeholder="Chọn chi nhánh" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {stores.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border mx-3"></div>

        <div className="flex-1 overflow-x-auto whitespace-nowrap no-scrollbar">
          <div className="flex gap-2 items-center">
            <Badge 
              variant={selectedTableId === null ? "default" : "outline"} 
              className={`cursor-pointer px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${selectedTableId === null ? "bg-leaf hover:bg-leaf/90 shadow-glow text-primary-foreground border-transparent" : "hover:bg-muted/50"}`}
              onClick={() => setSelectedTableId(null)}
            >
              Mang đi
            </Badge>
            {tables.map(t => (
              <Badge 
                key={t.id}
                variant={selectedTableId === t.id ? "default" : "outline"} 
                className={`cursor-pointer px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${selectedTableId === t.id ? "bg-primary hover:bg-primary/90 shadow-glow text-primary-foreground border-transparent" : "hover:bg-muted/50"}`}
                onClick={() => setSelectedTableId(t.id)}
              >
                {t.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: MENU */}
        <div className="w-[65%] flex flex-col bg-slate-50/50 border-r">
          <div className="p-4 border-b bg-background/95 backdrop-blur z-10 flex items-center justify-between">
            <span className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Danh mục món</span>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-[200px] bg-background font-semibold shadow-sm rounded-xl">
                <SelectValue placeholder="Chọn dòng trà" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="Tất cả">Tất cả món</SelectItem>
                {teaLines.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <ScrollArea className="flex-1 p-5">
            <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredProducts.map(p => (
                <Card 
                  key={p.id} 
                  className="group cursor-pointer hover:border-leaf transition-all duration-300 hover:-translate-y-1 hover:shadow-glow overflow-hidden flex flex-col rounded-2xl bg-card border-transparent shadow-card-soft" 
                  onClick={() => handleProductClick(p)}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted/10 relative">
                    <img src={p.image || (p as any).image_url || '/images/products/tra-xoai.jpg'} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                    <p className="font-semibold text-sm leading-snug line-clamp-2" title={p.name}>{p.name}</p>
                    <p className="text-leaf font-extrabold">{vnd(p.price)}</p>
                  </div>
                </Card>
              ))}
            </div>
            <div className="h-8"></div>
          </ScrollArea>
        </div>

        {/* RIGHT: CART */}
        <div className="w-[35%] flex flex-col bg-background relative shadow-[-8px_0_32px_-12px_rgba(0,0,0,0.08)] z-20">
          <div className="p-5 border-b font-display bg-background flex justify-between items-center z-10 shrink-0">
            <span className="font-bold text-lg">Giỏ hàng ({cart.reduce((a,c) => a + c.qty, 0)})</span>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-berry hover:bg-berry/10 hover:text-berry rounded-lg font-semibold transition-colors" onClick={() => setCart([])}>
                <Trash2 className="size-4 mr-1.5"/> Xóa hết
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 p-4 bg-muted/5">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm py-24 opacity-60">
                <ShoppingCart className="size-12 mb-4 text-muted-foreground/50" />
                <p>Chưa có món nào trong giỏ</p>
                <p className="text-xs mt-1">Chọn món ở menu bên trái để bắt đầu</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.uid} className="bg-background border rounded-2xl p-4 relative shadow-sm group hover:border-primary/50 transition-colors flex gap-4">
                    <button 
                      className="absolute top-2 right-2 text-muted-foreground hover:bg-berry/10 hover:text-berry rounded-full p-1.5 transition-all opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 z-10"
                      onClick={() => removeFromCart(item.uid)}
                    >
                      <X className="size-4" />
                    </button>
                    
                    <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-muted/20 mt-1 cursor-pointer" onClick={() => { setEditingItem(item); setIsDialogOpen(true); }}>
                      <img 
                        src={products.find(p => String(p.id) === String(item.product_id))?.image || (products.find(p => String(p.id) === String(item.product_id)) as any)?.image_url || '/images/products/tra-xoai.jpg'} 
                        alt={item.product_name} 
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 flex flex-col justify-between">
                      <div className="pr-6 cursor-pointer" onClick={() => { setEditingItem(item); setIsDialogOpen(true); }}>
                        <p className="font-bold text-sm leading-tight">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {item.size_label} · {item.base_tea} · {item.sugar_level} đường · {item.ice_level} đá
                          {item.toppings.length > 0 && <span className="block text-primary/80 font-medium mt-0.5">+ {item.toppings.map(t => `${t.qty}x ${t.name}`).join(', ')}</span>}
                          {item.note && <span className="block italic mt-0.5 opacity-80">Ghi chú: {item.note}</span>}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed">
                        <div className="flex items-center bg-muted/30 rounded-xl border p-1">
                          <button className="p-1 hover:bg-background hover:shadow-sm rounded-lg text-muted-foreground transition-all" onClick={() => adjustCartQty(item.uid, -1)}><Minus className="size-3.5"/></button>
                          <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                          <button className="p-1 hover:bg-background hover:shadow-sm rounded-lg text-muted-foreground transition-all" onClick={() => adjustCartQty(item.uid, 1)}><Plus className="size-3.5"/></button>
                        </div>
                        <span className="font-extrabold text-primary text-base">
                          {vnd((item.price + item.toppings.reduce((s,t) => s + t.price*t.qty, 0)) * item.qty)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="h-8"></div>
          </ScrollArea>

          <div className="p-5 border-t bg-background space-y-5 shrink-0 z-10">
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="COD" id="r1" className="text-leaf border-leaf" />
                <Label htmlFor="r1" className="cursor-pointer font-semibold text-sm">Tiền mặt</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="VietQR" id="r2" className="text-leaf border-leaf" />
                <Label htmlFor="r2" className="cursor-pointer font-semibold text-sm">VietQR tĩnh</Label>
              </div>
            </RadioGroup>

            <div className="flex justify-between items-end bg-gradient-to-r from-muted/50 to-muted/20 p-4 rounded-2xl border border-muted">
              <span className="text-muted-foreground font-bold text-sm">Tổng thanh toán</span>
              <span className="text-3xl font-extrabold text-leaf font-display tracking-tight drop-shadow-sm">{vnd(cartTotal)}</span>
            </div>

            <Button 
              variant="hero" 
              className="w-full h-14 text-lg rounded-2xl shadow-glow font-bold tracking-wide" 
              disabled={cart.length === 0 || submitting}
              onClick={checkout}
            >
              {submitting ? <Loader2 className="animate-spin size-5" /> : "Thanh toán ngay"}
            </Button>
          </div>
        </div>
      </div>

      {/* OPTIONS DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-transparent shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)]">
          <DialogHeader className="bg-muted/30 p-6 pb-4 border-b">
            <DialogTitle className="font-display text-2xl font-bold tracking-tight">{editingItem?.product_name}</DialogTitle>
          </DialogHeader>
          
          {editingItem && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 p-6">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block font-bold uppercase tracking-wider">Size</Label>
                    <Select value={String(editingItem.size_id || "")} onValueChange={(v) => {
                      const sz = sizes.find(s => String(s.id) === v);
                      if (sz) setEditingItem({ ...editingItem, size_id: sz.id, size_label: sz.label });
                    }}>
                      <SelectTrigger className="rounded-xl h-10 bg-muted/10"><SelectValue/></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {sizes.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block font-bold uppercase tracking-wider">Cốt trà</Label>
                    <Select value={editingItem.base_tea} onValueChange={(v) => setEditingItem({ ...editingItem, base_tea: v })}>
                      <SelectTrigger className="rounded-xl h-10 bg-muted/10"><SelectValue/></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {baseOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block font-bold uppercase tracking-wider">Độ đường</Label>
                    <Select value={editingItem.sugar_level} onValueChange={(v) => setEditingItem({ ...editingItem, sugar_level: v })}>
                      <SelectTrigger className="rounded-xl h-10 bg-muted/10"><SelectValue/></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {sugarOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block font-bold uppercase tracking-wider">Độ đá</Label>
                    <Select value={editingItem.ice_level} onValueChange={(v) => setEditingItem({ ...editingItem, ice_level: v })}>
                      <SelectTrigger className="rounded-xl h-10 bg-muted/10"><SelectValue/></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {iceOptions.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-3 block font-bold uppercase tracking-wider">Topping</Label>
                  <div className="space-y-2.5">
                    {toppings.map(t => {
                      const selected = editingItem.toppings.find(x => x.topping_id === t.id);
                      return (
                        <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/10 hover:bg-muted/20 border-transparent'}`}>
                          <span className="text-sm font-semibold">{t.name} <span className="text-primary font-bold ml-1">(+{vnd(t.price)})</span></span>
                          {selected ? (
                            <div className="flex items-center gap-1.5 bg-background shadow-sm rounded-lg p-1 border">
                              <button 
                                className="rounded-md size-6 flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
                                onClick={() => {
                                  const newToppings = editingItem.toppings.map(x => 
                                    x.topping_id === t.id ? { ...x, qty: x.qty - 1 } : x
                                  ).filter(x => x.qty > 0);
                                  setEditingItem({ ...editingItem, toppings: newToppings });
                                }}
                              ><Minus className="size-3.5"/></button>
                              <span className="w-5 text-center font-bold text-sm">{selected.qty}</span>
                              <button 
                                className="rounded-md size-6 flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
                                onClick={() => {
                                  const newToppings = editingItem.toppings.map(x => 
                                    x.topping_id === t.id ? { ...x, qty: x.qty + 1 } : x
                                  );
                                  setEditingItem({ ...editingItem, toppings: newToppings });
                                }}
                              ><Plus className="size-3.5"/></button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-semibold hover:text-primary hover:border-primary" onClick={() => {
                              setEditingItem({
                                ...editingItem,
                                toppings: [...editingItem.toppings, { topping_id: t.id, name: t.name, price: t.price, qty: 1 }]
                              })
                            }}>Thêm</Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block font-bold uppercase tracking-wider">Ghi chú thêm</Label>
                  <Input 
                    placeholder="VD: ít sữa, không trân châu..." 
                    value={editingItem.note} 
                    onChange={e => setEditingItem({ ...editingItem, note: e.target.value })} 
                    className="rounded-xl h-11 bg-muted/10 border-transparent focus-visible:ring-primary/30"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-dashed mt-6 pt-6">
                  <span className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Số lượng:</span>
                  <div className="flex items-center bg-muted/20 rounded-xl border p-1 shadow-sm">
                    <button 
                      className="p-2 hover:bg-background rounded-lg text-muted-foreground transition-all hover:shadow-sm" 
                      onClick={() => setEditingItem({ ...editingItem, qty: Math.max(1, editingItem.qty - 1) })}
                    ><Minus className="size-4"/></button>
                    <span className="w-12 text-center font-extrabold text-lg">{editingItem.qty}</span>
                    <button 
                      className="p-2 hover:bg-background rounded-lg text-muted-foreground transition-all hover:shadow-sm" 
                      onClick={() => setEditingItem({ ...editingItem, qty: editingItem.qty + 1 })}
                    ><Plus className="size-4"/></button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="p-5 border-t bg-muted/10">
            <Button variant="ghost" className="rounded-xl font-semibold" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
            <Button variant="hero" className="rounded-xl shadow-glow font-bold px-8" onClick={saveItemToCart}>Cập nhật giỏ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
