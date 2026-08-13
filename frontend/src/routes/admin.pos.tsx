import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { apiGet, apiPost } from "@/lib/api";
import { vnd, Product, teaLines, baseOptions, sugarOptions, iceOptions } from "@/lib/data";

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

  // Category filter
  const [activeTab, setActiveTab] = useState<string>("Tất cả");

  // Dialog state
  const [editingItem, setEditingItem] = useState<PosCartItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<Store[]>("/api/stores"),
      apiGet<Product[]>("/api/products"),
      apiGet<SizeOption[]>("/api/options/sizes"),
      apiGet<ToppingOption[]>("/api/options/toppings"),
    ]).then(([st, pr, sz, top]) => {
      if (cancelled) return;
      setStores(st);
      if (st.length > 0) setSelectedStoreId(st[0].id);
      setProducts(pr);
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
          product_id: i.product_id,
          size_id: i.size_id,
          base_tea: i.base_tea,
          sugar_level: i.sugar_level,
          ice_level: i.ice_level,
          qty: i.qty,
          note: i.note,
          toppings: i.toppings.map(t => ({ topping_id: t.topping_id, qty: t.qty })),
        })),
      };

      const res = await apiPost<{ order_code: string; order_id: number; total: number }>("/api/orders", payload);
      toast.success(`Tạo đơn POS thành công: ${res.order_code}`);
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
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top POS Header */}
      <div className="flex items-center gap-4 bg-card border-b p-3 shrink-0">
        <ShoppingCart className="text-primary size-5" />
        <h1 className="font-bold font-display text-lg mr-4">POS Gọi Món</h1>
        
        <Select value={String(selectedStoreId || "")} onValueChange={(v) => setSelectedStoreId(Number(v))}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Chọn chi nhánh" />
          </SelectTrigger>
          <SelectContent>
            {stores.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border mx-2"></div>

        <div className="flex-1 overflow-x-auto whitespace-nowrap no-scrollbar">
          <div className="flex gap-2">
            <Badge 
              variant={selectedTableId === null ? "default" : "secondary"} 
              className="cursor-pointer"
              onClick={() => setSelectedTableId(null)}
            >
              Mang đi
            </Badge>
            {tables.map(t => (
              <Badge 
                key={t.id}
                variant={selectedTableId === t.id ? "default" : "secondary"} 
                className="cursor-pointer"
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
        <div className="w-[60%] flex flex-col bg-muted/20 border-r">
          <div className="p-3 border-b bg-background">
            <div className="overflow-x-auto whitespace-nowrap no-scrollbar">
              <div className="flex gap-2 pb-2">
                <Button 
                  size="sm" 
                  variant={activeTab === "Tất cả" ? "default" : "secondary"}
                  onClick={() => setActiveTab("Tất cả")}
                  className="rounded-full"
                >Tất cả</Button>
                {teaLines.map(t => (
                  <Button 
                    key={t} 
                    size="sm" 
                    variant={activeTab === t ? "default" : "secondary"}
                    onClick={() => setActiveTab(t)}
                    className="rounded-full"
                  >{t}</Button>
                ))}
              </div>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredProducts.map(p => (
                <Card 
                  key={p.id} 
                  className="cursor-pointer hover:border-primary transition-colors overflow-hidden flex shadow-sm hover:shadow-md" 
                  onClick={() => handleProductClick(p)}
                >
                  <img src={p.image} alt={p.name} className="w-20 h-24 object-cover" />
                  <div className="p-2 flex flex-col justify-center min-w-0">
                    <p className="font-semibold text-sm leading-tight line-clamp-2" title={p.name}>{p.name}</p>
                    <p className="text-primary font-bold text-sm mt-1">{vnd(p.price)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: CART */}
        <div className="w-[40%] flex flex-col bg-card">
          <div className="p-3 border-b font-semibold bg-muted/50 flex justify-between items-center">
            <span>Giỏ hàng ({cart.reduce((a,c) => a + c.qty, 0)})</span>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-berry" onClick={() => setCart([])}>
                <Trash2 className="size-4 mr-1"/> Xóa hết
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 p-3">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-20">
                Chưa có món nào trong giỏ
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.uid} className="bg-background border rounded-lg p-3 relative shadow-sm group">
                    <button 
                      className="absolute top-2 right-2 text-muted-foreground hover:text-berry opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFromCart(item.uid)}
                    >
                      <X className="size-4" />
                    </button>
                    
                    <div className="pr-6 cursor-pointer" onClick={() => { setEditingItem(item); setIsDialogOpen(true); }}>
                      <p className="font-semibold text-sm">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {item.size_label} · {item.base_tea} · {item.sugar_level} đường · {item.ice_level} đá
                        {item.toppings.length > 0 && <><br/>+ {item.toppings.map(t => `${t.qty}x ${t.name}`).join(', ')}</>}
                        {item.note && <><br/>Ghi chú: {item.note}</>}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border rounded-md">
                        <button className="px-2 py-1 hover:bg-muted text-muted-foreground" onClick={() => adjustCartQty(item.uid, -1)}><Minus className="size-3"/></button>
                        <span className="px-3 text-sm font-semibold">{item.qty}</span>
                        <button className="px-2 py-1 hover:bg-muted text-muted-foreground" onClick={() => adjustCartQty(item.uid, 1)}><Plus className="size-3"/></button>
                      </div>
                      <span className="font-bold text-sm">
                        {vnd((item.price + item.toppings.reduce((s,t) => s + t.price*t.qty, 0)) * item.qty)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t bg-muted/10 space-y-4 shrink-0">
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="COD" id="r1" />
                <Label htmlFor="r1" className="cursor-pointer">Tiền mặt</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="VietQR" id="r2" />
                <Label htmlFor="r2" className="cursor-pointer">VietQR tĩnh</Label>
              </div>
            </RadioGroup>

            <div className="flex justify-between items-end">
              <span className="text-muted-foreground font-medium">Tổng cộng</span>
              <span className="text-2xl font-extrabold text-primary font-display">{vnd(cartTotal)}</span>
            </div>

            <Button 
              variant="hero" 
              className="w-full h-12 text-lg" 
              disabled={cart.length === 0 || submitting}
              onClick={checkout}
            >
              {submitting ? <Loader2 className="animate-spin size-5" /> : "Thanh toán"}
            </Button>
          </div>
        </div>
      </div>

      {/* OPTIONS DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem?.product_name}</DialogTitle>
          </DialogHeader>
          
          {editingItem && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Size</Label>
                    <Select value={String(editingItem.size_id || "")} onValueChange={(v) => {
                      const sz = sizes.find(s => String(s.id) === v);
                      if (sz) setEditingItem({ ...editingItem, size_id: sz.id, size_label: sz.label });
                    }}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {sizes.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Cốt trà</Label>
                    <Select value={editingItem.base_tea} onValueChange={(v) => setEditingItem({ ...editingItem, base_tea: v })}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {baseOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Độ đường</Label>
                    <Select value={editingItem.sugar_level} onValueChange={(v) => setEditingItem({ ...editingItem, sugar_level: v })}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {sugarOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Độ đá</Label>
                    <Select value={editingItem.ice_level} onValueChange={(v) => setEditingItem({ ...editingItem, ice_level: v })}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {iceOptions.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Topping</Label>
                  <div className="space-y-2">
                    {toppings.map(t => {
                      const selected = editingItem.toppings.find(x => x.topping_id === t.id);
                      return (
                        <div key={t.id} className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border text-sm">
                          <span>{t.name} (+{vnd(t.price)})</span>
                          {selected ? (
                            <div className="flex items-center gap-2">
                              <button 
                                className="bg-background border rounded size-6 flex items-center justify-center hover:bg-muted"
                                onClick={() => {
                                  const newToppings = editingItem.toppings.map(x => 
                                    x.topping_id === t.id ? { ...x, qty: x.qty - 1 } : x
                                  ).filter(x => x.qty > 0);
                                  setEditingItem({ ...editingItem, toppings: newToppings });
                                }}
                              ><Minus className="size-3"/></button>
                              <span className="w-4 text-center font-semibold">{selected.qty}</span>
                              <button 
                                className="bg-background border rounded size-6 flex items-center justify-center hover:bg-muted"
                                onClick={() => {
                                  const newToppings = editingItem.toppings.map(x => 
                                    x.topping_id === t.id ? { ...x, qty: x.qty + 1 } : x
                                  );
                                  setEditingItem({ ...editingItem, toppings: newToppings });
                                }}
                              ><Plus className="size-3"/></button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
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
                  <Label className="text-xs text-muted-foreground mb-1 block">Ghi chú thêm</Label>
                  <Input 
                    placeholder="VD: ít sữa, không trân châu..." 
                    value={editingItem.note} 
                    onChange={e => setEditingItem({ ...editingItem, note: e.target.value })} 
                  />
                </div>

                <div className="flex items-center justify-between border-t mt-4 pt-4">
                  <span className="font-semibold text-sm">Số lượng:</span>
                  <div className="flex items-center border rounded-md">
                    <button 
                      className="px-3 py-2 hover:bg-muted text-muted-foreground" 
                      onClick={() => setEditingItem({ ...editingItem, qty: Math.max(1, editingItem.qty - 1) })}
                    ><Minus className="size-4"/></button>
                    <span className="px-4 font-semibold">{editingItem.qty}</span>
                    <button 
                      className="px-3 py-2 hover:bg-muted text-muted-foreground" 
                      onClick={() => setEditingItem({ ...editingItem, qty: editingItem.qty + 1 })}
                    ><Plus className="size-4"/></button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={saveItemToCart}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
