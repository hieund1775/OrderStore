import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarClock, CreditCard, Store, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranch } from '@/lib/branch';
import { useCart } from '@/lib/cart';
import { apiGet, apiPost, createIdempotencyKey, getCustomerToken, getCustomerUser } from '@/lib/api';

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
  const { selectedItems, removeItems } = useCart();
  const { stores, selectedStoreId, selectStore } = useBranch();
  const [date, setDate] = useState(vietnamToday());
  const [hour, setHour] = useState<string>('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [tables, setTables] = useState<StoreTable[]>([]);
  const [tableId, setTableId] = useState<string>('none');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const request = useRef<{ signature: string; key: string } | null>(null);

  const storeId = Number(selectedStoreId);
  const selectedStore = stores.find((store) => store.id === storeId);
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
    if (!Number.isInteger(storeId) || storeId <= 0 || !date) return undefined;
    setAvailability(null); setHour(''); setTables([]); setTableId('none');
    apiGet<Availability>(`/api/preorders/availability?store_id=${storeId}&date=${encodeURIComponent(date)}`)
      .then((value) => { if (active) setAvailability(value); })
      .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : 'Không thể tải khung giờ đặt trước'); });
    return () => { active = false; };
  }, [date, storeId]);

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
    <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2">
      <div><Label>Chi nhánh</Label><Select value={storeId ? String(storeId) : ''} onValueChange={(value) => selectStore(value)}><SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger><SelectContent>{stores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Ngày nhận</Label><Input type="date" value={date} min={vietnamToday()} onChange={(event) => setDate(event.target.value)} /></div>
      <div><Label>Khung giờ nhận (09:00–23:00)</Label><Select value={hour} onValueChange={setHour}><SelectTrigger><SelectValue placeholder="Chọn khung giờ" /></SelectTrigger><SelectContent>{availability?.slots.map((slot) => <SelectItem key={slot.hour} value={String(slot.hour)} disabled={!slot.available}>{String(slot.hour).padStart(2, '0')}:00–{String(slot.hour + 1).padStart(2, '0')}:00{slot.available ? '' : ' · không khả dụng'}</SelectItem>)}</SelectContent></Select></div>
      <div><Label><Table2 className="mr-1 inline size-4" />Bàn (không bắt buộc)</Label><Select value={tableId} onValueChange={setTableId} disabled={!hour}><SelectTrigger><SelectValue placeholder="Chưa chọn bàn" /></SelectTrigger><SelectContent><SelectItem value="none">Để cửa hàng sắp xếp</SelectItem>{tables.map((table) => <SelectItem key={table.id} value={String(table.id)}>{table.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Tên người nhận</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div><Label>Số điện thoại</Label><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
      <div className="md:col-span-2"><Label>Mã voucher (chỉ voucher hỗ trợ đặt trước)</Label><Input value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} /></div>
    </section>
    <section className="rounded-xl border bg-card p-5"><div className="mb-3 flex items-center gap-2 font-semibold"><Store className="size-4" />{selectedStore?.name || 'Chưa chọn chi nhánh'}</div><p className="text-sm text-muted-foreground">{selectedItems.length} món được chọn. Không giữ tồn kho; mọi giá và voucher được backend chốt khi thanh toán.</p>{!cartIsSingleStore && <p className="mt-2 text-sm text-destructive">Giỏ hiện có món khác chi nhánh. Hãy chỉ chọn món của một chi nhánh.</p>}</section>
    <Button className="w-full" size="lg" disabled={submitting || !cartIsSingleStore || selectedItems.length === 0} onClick={submit}><CreditCard className="mr-2 size-4" />{submitting ? 'Đang tạo thanh toán…' : 'Thanh toán preorder bằng VietQR'}</Button>
  </div>;
}
