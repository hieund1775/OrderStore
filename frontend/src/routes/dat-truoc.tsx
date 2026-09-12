import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarClock, CreditCard, Minus, Plus, ShoppingBag, Store, Table2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranch } from '@/lib/branch';
import { useCart } from '@/lib/cart';
import { apiGet, apiPost, createIdempotencyKey, getCustomerToken, getCustomerUser } from '@/lib/api';
import { ProductCard } from '@/components/menu/ProductCard';
import { mapApiProduct, type ApiCatalogProduct, type Product, vnd } from '@/lib/data';
import {
  fetchPreorderStoreAvailability,
  hasAvailablePreorderStore,
  isPreorderAvailableForStore,
  type PreorderStoreAvailability,
} from '@/lib/preorder-store-availability';

export const Route = createFileRoute('/dat-truoc')({ component: PreorderCheckoutPage });

type PreorderSlot = { hour: number; available: boolean; reason?: string; scheduled_start_at?: string };
type Availability = { slots: PreorderSlot[] };
type StoreTable = { id: number; name: string };
type Product = { id: number; slug?: string };
type Option = { id: number; label?: string; name?: string };
type CheckoutResponse = { preorder?: { preorder_code?: string }; checkout_url?: string; qr_code?: string; group_code?: string; order_code?: string };

function vietnamToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function PreorderCheckoutPage() {
  const { selectedItems, selectedSubtotal, removeItem, removeItems, setQty } = useCart();
  const { stores, selectedStoreId, selectStore } = useBranch();
  const [date, setDate] = useState(vietnamToday());
  const [hour, setHour] = useState<string>('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [preorderStores, setPreorderStores] = useState<PreorderStoreAvailability[] | null>(null);
  const [tables, setTables] = useState<StoreTable[]>([]);
  const [tableId, setTableId] = useState<string>('none');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const request = useRef<{ signature: string; key: string } | null>(null);

  const storeId = Number(selectedStoreId);
  const selectedStore = stores.find((store) => store.id === storeId);
  const selectedStorePreorderAvailable = preorderStores == null
    ? null
    : isPreorderAvailableForStore(preorderStores, storeId);
  const anyStorePreorderAvailable = preorderStores != null && hasAvailablePreorderStore(preorderStores);
  const cartIsSingleStore = useMemo(
    () => selectedItems.length > 0 && selectedItems.every((item) => !item.storeId || Number(item.storeId) === storeId),
    [selectedItems, storeId],
  );

  useEffect(() => {
    const user = getCustomerUser();
    if (user) { setName(user.fullname || ''); setPhone(user.phone || ''); }
  }, []);

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    apiGet<ApiCatalogProduct[]>('/api/products')
      .then((rows) => {
        if (!active) return;
        setCatalogProducts((rows || []).map(mapApiProduct));
        setCatalogError(null);
      })
      .catch((error) => {
        if (!active) return;
        setCatalogProducts([]);
        setCatalogError(error instanceof Error ? error.message : 'Không thể tải thực đơn');
      })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetchPreorderStoreAvailability()
      .then((rows) => { if (active) setPreorderStores(rows); })
      .catch(() => { if (active) setPreorderStores([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!Number.isInteger(storeId) || storeId <= 0 || !date) return undefined;
    setAvailability(null); setHour(''); setTables([]); setTableId('none');
    // Do not issue a request that is guaranteed to be rejected with 409 while
    // the public store configuration is still loading.
    if (preorderStores == null) return undefined;
    if (selectedStorePreorderAvailable === false) return undefined;
    apiGet<Availability>(`/api/preorders/availability?store_id=${storeId}&date=${encodeURIComponent(date)}`)
      .then((value) => { if (active) setAvailability(value); })
      .catch((error) => {
        if (!active) return;
        setPreorderStores((current) => current?.map((store) => Number(store.store_id) === storeId
          ? { ...store, is_available: false }
          : store) ?? current);
        toast.error(error instanceof Error ? error.message : 'Không thể tải khung giờ đặt trước');
      });
    return () => { active = false; };
  }, [date, preorderStores, selectedStorePreorderAvailable, storeId]);

  useEffect(() => {
    let active = true;
    if (!hour || !Number.isInteger(storeId)) return undefined;
    apiGet<{ tables: StoreTable[] }>(`/api/preorders/tables?store_id=${storeId}&date=${encodeURIComponent(date)}&hour=${hour}`)
      .then((value) => { if (active) setTables(value.tables || []); })
      .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : 'Không thể tải bàn trống'); });
    return () => { active = false; };
  }, [date, hour, storeId]);

  async function submit() {
    if (!getCustomerToken()) { toast.error('Vui lòng đăng nhập để đặt trước.'); return; }
    if (selectedStorePreorderAvailable !== true) { toast.error('Đặt trước hiện chưa áp dụng tại chi nhánh này.'); return; }
    if (!cartIsSingleStore) { toast.error('Đặt trước chỉ nhận món của đúng một chi nhánh.'); return; }
    if (!name.trim() || !phone.trim() || !date || !hour) { toast.error('Vui lòng điền thông tin nhận món và khung giờ.'); return; }
    const selectedSlot = availability?.slots.find((slot) => String(slot.hour) === hour && slot.available);
    if (!selectedSlot) { toast.error('Khung giờ không còn phù hợp. Với giờ gần hơn 3 tiếng, vui lòng đặt đơn thường.'); return; }
    setSubmitting(true);
    try {
      const [products, sizes, toppings] = await Promise.all([
        apiGet<Product[]>('/api/products'), apiGet<Option[]>('/api/options/sizes'), apiGet<Option[]>('/api/options/toppings'),
      ]);
      const productId = new Map<string, number>();
      for (const product of products) {
        productId.set(String(product.id), product.id);
        if (product.slug) productId.set(product.slug, product.id);
      }
      const sizeId = new Map(sizes.filter((size) => size.label).map((size) => [String(size.label).toLowerCase(), size.id]));
      const toppingId = new Map(toppings.filter((topping) => topping.name).map((topping) => [String(topping.name).toLowerCase(), topping.id]));
      const payload = {
        store_id: storeId,
        scheduled_date: date,
        scheduled_hour: Number(hour),
        table_id: tableId === 'none' ? null : Number(tableId),
        customer_name: name.trim(), customer_phone: phone.trim(),
        voucher_code: voucherCode.trim() || null,
        source: 'online',
        return_url: `${window.location.origin}/theo-doi-don`,
        cancel_url: `${window.location.origin}/dat-truoc`,
        items: selectedItems.map((item) => ({
          product_id: productId.get(item.productId) ?? Number(item.productId),
          size_id: item.size ? sizeId.get(item.size.toLowerCase()) ?? null : null,
          base_tea: item.base || 'Lục Trà Lài', sugar_level: item.sugar || '100%', ice_level: item.ice || '100%',
          topping_ids: (item.toppings || []).map((value) => toppingId.get(value.toLowerCase())).filter((value): value is number => value != null),
          qty: item.qty, note: item.note || null,
        })),
      };
      const signature = JSON.stringify(payload);
      const key = request.current?.signature === signature ? request.current.key : createIdempotencyKey();
      request.current = { signature, key };
      const result = await apiPost<CheckoutResponse>('/api/preorders/checkout', payload, { headers: { 'Idempotency-Key': key } });
      request.current = null;
      removeItems(selectedItems.map((item) => item.key));
      if (result.checkout_url) { window.location.assign(result.checkout_url); return; }
      toast.success(`Đã tạo preorder ${result.preorder?.preorder_code || result.group_code || result.order_code || ''}. Hãy thanh toán VietQR để chờ Manager xác nhận.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo preorder');
    } finally { setSubmitting(false); }
  }

  return <div className="container-page max-w-3xl space-y-6 py-8">
    <div className="flex items-start gap-3"><CalendarClock className="mt-1 size-7 text-primary" /><div><h1 className="text-2xl font-bold">Đặt trước tại cửa hàng</h1><p className="text-muted-foreground">Thanh toán 100% ngay. Manager sẽ xác nhận sau khi thanh toán thành công.</p></div></div>
    {!getCustomerToken() && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần <Link className="font-semibold underline" to="/ho-so">đăng nhập</Link> trước khi đặt trước.</div>}
    {preorderStores != null && !anyStorePreorderAvailable && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">Đặt trước hiện chưa áp dụng tại các cửa hàng. Vui lòng quay lại sau.</div>}
    <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2">
      <div><Label>Chi nhánh</Label><Select value={storeId ? String(storeId) : ''} onValueChange={(value) => selectStore(value)}><SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger><SelectContent>{stores.map((store) => {
        const available = preorderStores == null ? true : isPreorderAvailableForStore(preorderStores, store.id);
        return <SelectItem key={store.id} value={String(store.id)} disabled={!available}>{store.name}{available ? '' : ' · Chưa áp dụng đặt trước'}</SelectItem>;
      })}</SelectContent></Select>{selectedStorePreorderAvailable === false && <p className="mt-1 text-xs text-amber-700">Đặt trước hiện chưa áp dụng tại {selectedStore?.name || 'chi nhánh này'}. Hãy chọn chi nhánh khác.</p>}</div>
      <div><Label>Ngày nhận</Label><Input type="date" value={date} min={vietnamToday()} onChange={(event) => setDate(event.target.value)} /></div>
      <div><Label>Khung giờ nhận (09:00–23:00)</Label><Select value={hour} onValueChange={setHour} disabled={selectedStorePreorderAvailable !== true}><SelectTrigger><SelectValue placeholder="Chọn khung giờ" /></SelectTrigger><SelectContent>{availability?.slots.map((slot) => <SelectItem key={slot.hour} value={String(slot.hour)} disabled={!slot.available}>{String(slot.hour).padStart(2, '0')}:00–{String(slot.hour + 1).padStart(2, '0')}:00{slot.available ? '' : ' · không khả dụng'}</SelectItem>)}</SelectContent></Select></div>
      <div><Label><Table2 className="mr-1 inline size-4" />Bàn (không bắt buộc)</Label><Select value={tableId} onValueChange={setTableId} disabled={!hour}><SelectTrigger><SelectValue placeholder="Chưa chọn bàn" /></SelectTrigger><SelectContent><SelectItem value="none">Để cửa hàng sắp xếp</SelectItem>{tables.map((table) => <SelectItem key={table.id} value={String(table.id)}>{table.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Tên người nhận</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div><Label>Số điện thoại</Label><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
      <div className="md:col-span-2"><Label>Mã voucher (chỉ voucher hỗ trợ đặt trước)</Label><Input value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} /></div>
    </section>
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 font-semibold"><ShoppingBag className="size-4" />Chọn món cho đơn đặt trước</div>
      {!selectedStore ? <p className="text-sm text-muted-foreground">Hãy chọn chi nhánh trước để xem và thêm món.</p> : null}
      {selectedStore && selectedStorePreorderAvailable !== true ? <p className="text-sm text-amber-700">Chi nhánh này chưa nhận đặt trước nên chưa thể thêm món cho preorder.</p> : null}
      {selectedStorePreorderAvailable === true && catalogLoading ? <p className="text-sm text-muted-foreground">Đang tải thực đơn…</p> : null}
      {selectedStorePreorderAvailable === true && catalogError ? <p className="text-sm text-destructive">{catalogError}</p> : null}
      {selectedStorePreorderAvailable === true && !catalogLoading && !catalogError ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{catalogProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : null}
    </section>

    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 font-semibold"><Store className="size-4" />Giỏ preorder · {selectedStore?.name || 'Chưa chọn chi nhánh'}</div>
      {selectedItems.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có món nào. Hãy chọn món ở phần thực đơn phía trên.</p> : <div className="space-y-3">
        {selectedItems.map((item) => <div key={item.key} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.size || 'M'} · {vnd(item.unitPrice)}</p></div>
          <div className="flex items-center gap-1 rounded-md border"><Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Giảm số lượng ${item.name}`} onClick={() => setQty(item.key, item.qty - 1)}><Minus className="size-4" /></Button><span className="w-6 text-center text-sm font-medium">{item.qty}</span><Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Tăng số lượng ${item.name}`} onClick={() => setQty(item.key, item.qty + 1)}><Plus className="size-4" /></Button></div>
          <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={`Xóa ${item.name}`} onClick={() => removeItem(item.key)}><Trash2 className="size-4" /></Button>
        </div>)}
        <div className="flex items-center justify-between border-t pt-3 font-semibold"><span>Tạm tính</span><span>{vnd(selectedSubtotal)}</span></div>
      </div>}
      {!cartIsSingleStore && <p className="mt-3 text-sm text-destructive">Giỏ hiện có món khác chi nhánh. Hãy bỏ các món khác chi nhánh trước khi thanh toán preorder.</p>}
    </section>
    <Button className="w-full" size="lg" disabled={submitting || selectedStorePreorderAvailable !== true || !cartIsSingleStore || selectedItems.length === 0} onClick={submit}><CreditCard className="mr-2 size-4" />{submitting ? 'Đang tạo thanh toán…' : 'Thanh toán preorder bằng VietQR'}</Button>
  </div>;
}
