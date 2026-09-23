import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CalendarClock, CreditCard, Edit2, Minus, Plus, ShoppingBag, Store, Ticket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranch } from '@/lib/branch';
import { usePreorderCart, type CartItem } from '@/lib/cart';
import { apiGet, apiPost, createIdempotencyKey, fetchPublicProducts, getCustomerToken, getCustomerUser } from '@/lib/api';
import { getCustomerSession, openCustomerLoginModal } from '@/lib/customer-session';
import { ProductCard } from '@/components/menu/ProductCard';
import { DynamicProductConfigurator } from '@/components/catalog/DynamicProductConfigurator';
import { PublicReviewHub } from '@/components/reviews/PublicReviewHub';
import { mapApiProduct, type Product, vnd, DEFAULT_PRODUCT_PLACEHOLDER } from '@/lib/data';
import { usePublicCategoryTree } from '@/lib/catalog-navigation';
import { resolveCheckoutPaymentRedirect } from '@/lib/payment-redirect';
import {
  fetchPreorderStoreAvailability,
  hasAvailablePreorderStore,
  isPreorderAvailableForStore,
  type PreorderStoreAvailability,
} from '@/lib/preorder-store-availability';

export const Route = createFileRoute('/dat-truoc')({ component: PreorderCheckoutPage });

type PreorderSlot = { hour: number; available: boolean; reason?: string; scheduled_start_at?: string };
type Availability = { slots: PreorderSlot[] };
type CheckoutProduct = { id: number; slug?: string };
type Option = { id: number; label?: string; name?: string };
type CheckoutResponse = {
  preorder?: { preorder_code?: string };
  checkout_url?: string;
  qr_code?: string;
  group_code?: string;
  order_code?: string;
  payment_provider?: string;
};

function vietnamToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function vietnamTomorrow() {
  const [year, month, day] = vietnamToday().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function vietnamMaxPreorderDate() {
  const [year, month, day] = vietnamToday().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);
}

function hasAnyAvailableSlot(slots: PreorderSlot[] | undefined) {
  return Boolean(slots?.some((slot) => slot.available));
}

function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  let str = phone.trim().replace(/[\s().-]/g, '');
  if (str.startsWith('+84') && str.length === 12) str = '0' + str.slice(3);
  else if (str.startsWith('84') && str.length === 11) str = '0' + str.slice(2);
  return /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(str);
}

function PreorderCheckoutPage() {
  const navigate = useNavigate();
  const { selectedItems, selectedSubtotal, removeItem, removeItems, setQty, updateItem } = usePreorderCart();
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  const handleSaveEdit = (configured: any) => {
    if (!editingItem) return;

    updateItem(editingItem.key, {
      storeId: editingItem.storeId,
      storeName: editingItem.storeName,
      storeDistrict: editingItem.storeDistrict,
      productId: String(configured.productId),
      productSlug: configured.productSlug,
      name: configured.productName,
      image: configured.image || editingItem.image,
      variantId: configured.variantId,
      sku: configured.sku,
      variantName: configured.variantName,
      stockMode: configured.stockMode,
      fulfillmentLane: configured.fulfillmentLane,
      size:
        configured.appliedModifiers?.find(
          (m: any) => m.attribute_code === 'size' || m.attribute_name?.toLowerCase().includes('size')
        )?.value_label ||
        configured.variantName ||
        editingItem.size,
      base:
        configured.appliedModifiers?.find(
          (m: any) =>
            m.attribute_code === 'base' ||
            m.attribute_name?.toLowerCase().includes('nền') ||
            m.attribute_name?.toLowerCase().includes('base')
        )?.value_label || editingItem.base,
      sugar:
        configured.appliedModifiers?.find(
          (m: any) => m.attribute_code === 'sugar' || m.attribute_name?.toLowerCase().includes('đường')
        )?.value_label || editingItem.sugar,
      ice:
        configured.appliedModifiers?.find(
          (m: any) => m.attribute_code === 'ice' || m.attribute_name?.toLowerCase().includes('đá')
        )?.value_label || editingItem.ice,
      toppings:
        configured.appliedModifiers
          ?.filter((m: any) => m.attribute_code === 'toppings' || m.attribute_code === 'topping' || m.attribute_name?.toLowerCase().includes('topping'))
          .map((m: any) => m.value_label || m.value_code) || editingItem.toppings,
      appliedModifiers: configured.appliedModifiers || [],
      unitPrice: configured.unitPrice,
      qty: configured.quantity,
      selected: editingItem.selected,
      note: editingItem.note,
    });

    setEditingItem(null);
    toast.success('Đã cập nhật tùy chọn món');
  };
  const { stores, selectedStoreId, selectStore } = useBranch();
  const [date, setDate] = useState(vietnamToday());
  const handleDateChange = (val: string) => {
    const todayStr = vietnamToday();
    const maxDateStr = vietnamMaxPreorderDate();
    if (val && val < todayStr) {
      toast.error('Không thể chọn ngày trong quá khứ. Đã tự động điều chỉnh về ngày hôm nay.');
      setDate(todayStr);
      return;
    }
    if (val && val > maxDateStr) {
      toast.error('Chỉ nhận đặt trước trong vòng 7 ngày.');
      setDate(maxDateStr);
      return;
    }
    setDate(val);
  };
  const [hour, setHour] = useState<string>('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [preorderStores, setPreorderStores] = useState<PreorderStoreAvailability[] | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [activeCatalogCategory, setActiveCatalogCategory] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [debouncedCatalogSearch, setDebouncedCatalogSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCatalogSearch(catalogSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const request = useRef<{ signature: string; key: string } | null>(null);

  const storeId = Number(selectedStoreId);
  const selectedStore = stores.find((store) => store.id === storeId);
  const categoryTreeQuery = usePublicCategoryTree(Number.isInteger(storeId) && storeId > 0 ? storeId : null);
  const preorderCategories = categoryTreeQuery.data || [];
  const selectedStorePreorderAvailable = preorderStores == null
    ? null
    : isPreorderAvailableForStore(preorderStores, storeId);
  const anyStorePreorderAvailable = preorderStores != null && hasAvailablePreorderStore(preorderStores);
  const noAvailableSlotsToday = date === vietnamToday()
    && availability != null
    && !hasAnyAvailableSlot(availability.slots);
  const cartIsSingleStore = useMemo(
    () => selectedItems.every((item) => !item.storeId || Number(item.storeId) === storeId),
    [selectedItems, storeId],
  );

  const slotRangeText = useMemo(() => {
    if (!availability?.slots || availability.slots.length === 0) return '09:00–23:00';
    const startHour = availability.slots[0].hour;
    const lastHour = availability.slots[availability.slots.length - 1].hour;
    return `${String(startHour).padStart(2, '0')}:00–${String(lastHour + 1).padStart(2, '0')}:00`;
  }, [availability?.slots]);

  const storeOperatingHoursText = useMemo(() => {
    const raw = (selectedStore?.hours || '').trim();
    // If store hours contains a known typo (e.g. 08:00 - 09:00 instead of 21:00) or is missing,
    // synchronize accurately with slotRangeText or default to 08:00 - 21:00
    if (raw && (raw.includes('08:00') || raw.includes('8:00')) && (raw.includes('09:00') || raw.includes('9:00'))) {
      return slotRangeText !== '09:00–23:00' ? slotRangeText.replace('–', ' - ') : '08:00 - 21:00';
    }
    if (raw) return raw;
    return slotRangeText !== '09:00–23:00' ? slotRangeText.replace('–', ' - ') : '08:00 - 21:00';
  }, [selectedStore?.hours, slotRangeText]);

  useEffect(() => {
    const user = getCustomerUser();
    if (user) { setName(user.fullname || ''); setPhone(user.phone || ''); }
  }, []);

  useEffect(() => {
    let active = true;
    if (!Number.isInteger(storeId) || storeId <= 0 || selectedStorePreorderAvailable !== true) {
      setCatalogProducts([]);
      setCatalogError(null);
      setCatalogLoading(false);
      return () => { active = false; };
    }
    setCatalogLoading(true);
    fetchPublicProducts({
      store_id: storeId,
      category: activeCatalogCategory || undefined,
      search: debouncedCatalogSearch || undefined,
      limit: 100,
    })
      .then((result) => {
        if (!active) return;
        setCatalogProducts((result.products || []).map(mapApiProduct));
        setCatalogError(null);
      })
      .catch((error) => {
        if (!active) return;
        setCatalogProducts([]);
        setCatalogError(error instanceof Error ? error.message : 'Không thể tải thực đơn');
      })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [activeCatalogCategory, debouncedCatalogSearch, selectedStorePreorderAvailable, storeId]);

  useEffect(() => {
    setActiveCatalogCategory('');
    setCatalogSearch('');
  }, [storeId]);

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
    setAvailability(null); setHour('');
    if (preorderStores == null) return undefined;
    if (selectedStorePreorderAvailable === false) return undefined;
    apiGet<Availability>(`/api/preorders/availability?store_id=${storeId}&date=${encodeURIComponent(date)}`)
      .then((value) => { if (active) setAvailability(value); })
      .catch((error) => {
        if (!active) return;
        setAvailability(null);
        toast.error(error instanceof Error ? error.message : 'Không thể tải khung giờ đặt trước');
      });
    return () => { active = false; };
  }, [date, preorderStores, selectedStorePreorderAvailable, storeId]);

  async function submit() {
    if (!getCustomerSession()) {
      toast.error('Vui lòng đăng nhập để đặt trước.');
      openCustomerLoginModal();
      return;
    }
    if (selectedStorePreorderAvailable !== true) { toast.error('Đặt trước hiện chưa áp dụng tại chi nhánh này.'); return; }
    if (!cartIsSingleStore) { toast.error('Đặt trước chỉ nhận món của đúng một chi nhánh.'); return; }
    if (!name.trim()) { toast.error('Vui lòng nhập tên người nhận.'); return; }
    if (!phone.trim()) { toast.error('Vui lòng nhập số điện thoại nhận món.'); return; }
    if (phone.trim().length > 15) { toast.error('Số điện thoại không được vượt quá 15 ký tự.'); return; }
    if (!isValidPhone(phone.trim())) { toast.error('Số điện thoại không đúng định dạng (VD: 0901234567).'); return; }
    if (!date || !hour) { toast.error('Vui lòng chọn ngày và khung giờ nhận món.'); return; }
    if (date < vietnamToday()) { toast.error('Không thể đặt trước cho ngày trong quá khứ.'); return; }
    const selectedSlot = availability?.slots.find((slot) => String(slot.hour) === hour && slot.available);
    if (!selectedSlot) { toast.error('Khung giờ không còn phù hợp. Với giờ gần hơn 3 tiếng, vui lòng đặt đơn thường.'); return; }
    setSubmitting(true);
    try {
      const [products, sizes, toppings] = await Promise.all([
        apiGet<CheckoutProduct[]>('/api/products'), apiGet<Option[]>('/api/options/sizes'), apiGet<Option[]>('/api/options/toppings'),
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
        customer_name: name.trim(), customer_phone: phone.trim(),
        voucher_code: voucherCode.trim() || null,
        source: 'online',
        return_url: `${window.location.origin}/don-dat-truoc`,
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
      if (result.checkout_url) {
        const redirect = resolveCheckoutPaymentRedirect(
          result.checkout_url,
          result.payment_provider,
          window.location.origin,
        );
        if (redirect.kind === 'sandbox') {
          removeItems(selectedItems.map((item) => item.key));
          toast.success('Đang mở cổng thanh toán sandbox...');
          void navigate({ to: '/thanh-toan/sandbox', search: { token: redirect.token } });
          return;
        }
        if (redirect.kind === 'external') {
          removeItems(selectedItems.map((item) => item.key));
          window.location.assign(redirect.url);
          return;
        }
        toast.error('Liên kết thanh toán không hợp lệ. Vui lòng thử lại.');
        return;
      }
      removeItems(selectedItems.map((item) => item.key));
      toast.success(`Đã tạo preorder ${result.preorder?.preorder_code || result.group_code || result.order_code || ''}. Hãy thanh toán VietQR để chờ Manager xác nhận.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo preorder');
    } finally { setSubmitting(false); }
  }

  return <div className="container-page space-y-6 py-8">
    <div className="flex items-start gap-3"><CalendarClock className="mt-1 size-7 text-primary" /><div><h1 className="text-2xl font-bold">Đặt trước tại cửa hàng</h1><p className="text-muted-foreground">Thanh toán 100% ngay. Manager sẽ xác nhận sau khi thanh toán thành công.</p></div></div>
    {!getCustomerToken() && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần <Link className="font-semibold underline" to="/ho-so">đăng nhập</Link> trước khi đặt trước.</div>}
    {preorderStores != null && !anyStorePreorderAvailable && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">Đặt trước hiện chưa áp dụng tại các cửa hàng. Vui lòng quay lại sau.</div>}
    <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2 lg:grid-cols-3">
      <div><Label>Chi nhánh</Label><Select value={storeId ? String(storeId) : ''} onValueChange={(value) => selectStore(value)}><SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger><SelectContent>{stores.map((store) => {
        const available = preorderStores == null ? true : isPreorderAvailableForStore(preorderStores, store.id);
        return <SelectItem key={store.id} value={String(store.id)} disabled={!available}>{store.name}{available ? '' : ' · Chưa áp dụng đặt trước'}</SelectItem>;
      })}</SelectContent></Select>{selectedStorePreorderAvailable === false && <p className="mt-1 text-xs text-amber-700">Đặt trước hiện chưa áp dụng tại {selectedStore?.name || 'chi nhánh này'}. Hãy chọn chi nhánh khác.</p>}</div>
      <div>
        <Label>Ngày nhận</Label>
        <Input
          type="date"
          value={date}
          min={vietnamToday()}
          max={vietnamMaxPreorderDate()}
          onChange={(event) => handleDateChange(event.target.value)}
        />
        {date && date < vietnamToday() && (
          <p className="mt-1 text-xs text-destructive">
            Ngày nhận không thể ở trong quá khứ (từ {vietnamToday().split('-').reverse().join('/')} trở đi).
          </p>
        )}
      </div>
      {noAvailableSlotsToday && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm md:col-span-2 lg:col-span-3"><p>Hôm nay đã hết khung giờ nhận đặt trước. Vui lòng chọn ngày tiếp theo.</p><Button type="button" variant="link" className="h-auto px-0 py-1" onClick={() => setDate(vietnamTomorrow())}>Chọn ngày mai ({vietnamTomorrow().split('-').reverse().join('/')})</Button></div>}
      <div><Label>Khung giờ nhận ({slotRangeText})</Label><Select value={hour} onValueChange={setHour} disabled={selectedStorePreorderAvailable !== true}><SelectTrigger><SelectValue placeholder="Chọn khung giờ" /></SelectTrigger><SelectContent>{availability?.slots.map((slot) => <SelectItem key={slot.hour} value={String(slot.hour)} disabled={!slot.available}>{String(slot.hour).padStart(2, '0')}:00–{String(slot.hour + 1).padStart(2, '0')}:00{slot.available ? '' : ' · không khả dụng'}</SelectItem>)}</SelectContent></Select></div>
      <div><Label><Ticket className="mr-1 inline size-4" />Mã voucher (áp dụng đặt trước)</Label><Input value={voucherCode} onChange={(event) => setVoucherCode(event.target.value.toUpperCase())} placeholder="Ví dụ: PREORDER10" /></div>
      <div><Label>Tên người nhận</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div><Label>Số điện thoại</Label><Input type="tel" maxLength={15} value={phone} placeholder="Ví dụ: 0901234567" onChange={(event) => setPhone(event.target.value)} />{phone.trim() && (!isValidPhone(phone.trim()) || phone.trim().length > 15) && <p className="mt-1 text-xs text-destructive">Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).</p>}</div>
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 md:col-span-2 lg:col-span-3">
        <p className="font-semibold">Lưu ý thời gian check-in tự phục vụ:</p>
        <p className="mt-0.5 text-blue-800">Khung giờ khách tự check-in tại cửa hàng mở trong giờ hoạt động (<strong>{storeOperatingHoursText}</strong>) trong ngày đã chọn. Giờ đặt trước là thời gian dự kiến để cửa hàng chuẩn bị món chu đáo nhất.</p>
      </div>
    </section>
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 font-semibold"><ShoppingBag className="size-4" />Chọn món cho đơn đặt trước</div>
      {!selectedStore ? <p className="text-sm text-muted-foreground">Hãy chọn chi nhánh trước để xem và thêm món.</p> : null}
      {selectedStore && selectedStorePreorderAvailable !== true ? <p className="text-sm text-amber-700">Chi nhánh này chưa nhận đặt trước nên chưa thể thêm món cho preorder.</p> : null}
      {selectedStorePreorderAvailable === true && catalogLoading ? <p className="text-sm text-muted-foreground">Đang tải thực đơn…</p> : null}
      {selectedStorePreorderAvailable === true && catalogError ? <p className="text-sm text-destructive">{catalogError}</p> : null}
      {selectedStorePreorderAvailable === true && !catalogLoading && !catalogError ? <>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1.5 pt-1 no-scrollbar whitespace-nowrap scroll-smooth touch-pan-x min-w-0" aria-label="Lọc theo danh mục">
            <Button
              type="button"
              size="sm"
              variant={activeCatalogCategory ? 'outline' : 'default'}
              className="shrink-0 whitespace-nowrap"
              onClick={() => setActiveCatalogCategory('')}
            >
              Tất cả món
            </Button>
            {preorderCategories.map((category) => (
              <Button
                key={category.id}
                type="button"
                size="sm"
                variant={activeCatalogCategory === category.slug ? 'default' : 'outline'}
                className="shrink-0 whitespace-nowrap"
                onClick={() => setActiveCatalogCategory(category.slug)}
              >
                {category.name}
              </Button>
            ))}
          </div>
          <Input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Tìm món…" className="sm:max-w-52" aria-label="Tìm món preorder" />
        </div>
        {catalogProducts.length === 0 ? <p className="text-sm text-muted-foreground">Không có món phù hợp tại chi nhánh này.</p> : <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{catalogProducts.map((product) => <ProductCard key={product.id} product={product} usePreorder />)}</div>}
      </> : null}
    </section>

    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 font-semibold"><Store className="size-4" />Giỏ preorder · {selectedStore?.name || 'Chưa chọn chi nhánh'}</div>
      {selectedItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có món nào. Hãy chọn món ở phần thực đơn phía trên.</p>
      ) : (
        <div className="space-y-3">
          {selectedItems.map((item) => {
            const hasModifiers = item.appliedModifiers && item.appliedModifiers.length > 0;
            return (
              <div key={item.key} className="flex items-start gap-3 rounded-xl border p-3.5 bg-background shadow-xs">
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_PRODUCT_PLACEHOLDER;
                    }}
                    className="size-14 rounded-lg object-cover border shrink-0 mt-0.5"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate font-semibold text-sm">{item.name}</p>
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors shrink-0 cursor-pointer"
                      title="Chỉnh sửa size, đường, đá, topping..."
                    >
                      <Edit2 className="size-3" />
                      <span>Sửa</span>
                    </button>
                  </div>

                  {hasModifiers ? (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.appliedModifiers
                        ?.map(
                          (m) =>
                            `${m.value_label}${
                              m.price_adjustment && m.price_adjustment > 0
                                ? ` (+${vnd(m.price_adjustment)})`
                                : ''
                            }`,
                        )
                        .join(' · ')}
                    </p>
                  ) : (
                    (() => {
                      const details: string[] = [];
                      if (item.size) details.push(item.size.toLowerCase().startsWith('size ') ? item.size : `Size ${item.size}`);
                      if (item.base) details.push(item.base);
                      if (item.sugar) details.push(item.sugar.includes('đường') ? item.sugar : `${item.sugar} đường`);
                      if (item.ice) details.push(item.ice.includes('đá') ? item.ice : `${item.ice} đá`);
                      if (item.toppings && item.toppings.length > 0) details.push(`+${item.toppings.join(', ')}`);
                      return details.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {details.join(' · ')}
                        </p>
                      ) : null;
                    })()
                  )}

                  {item.note && (
                    <p className="text-[11px] text-muted-foreground/80 italic truncate">
                      Ghi chú: {item.note}
                    </p>
                  )}

                  <p className="text-xs font-bold text-primary pt-0.5">
                    {vnd(item.unitPrice)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-center">
                  <div className="flex items-center gap-1 rounded-md border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Giảm số lượng ${item.name}`}
                      onClick={() => setQty(item.key, item.qty - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-5 text-center text-xs font-semibold">{item.qty}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Tăng số lượng ${item.name}`}
                      onClick={() => setQty(item.key, item.qty + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Xóa ${item.name}`}
                    onClick={() => removeItem(item.key)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t pt-3 font-semibold">
            <span>Tạm tính</span>
            <span>{vnd(selectedSubtotal)}</span>
          </div>
        </div>
      )}
    </section>
    <Button className="w-full" size="lg" disabled={submitting || selectedStorePreorderAvailable !== true || !cartIsSingleStore || selectedItems.length === 0} onClick={submit}><CreditCard className="mr-2 size-4" />{submitting ? 'Đang tạo thanh toán…' : 'Thanh toán preorder bằng VietQR'}</Button>
    <section className="border-t pt-8">
      <div className="mb-5">
        <h2 className="text-xl font-bold">Đánh giá đơn đặt trước</h2>
        <p className="mt-1 text-sm text-muted-foreground">Chỉ hiển thị đánh giá từ khách đã nhận món đặt trước.</p>
      </div>
      <PublicReviewHub initialSource="preorder" lockSource />
    </section>

    {/* Edit Configurator Modal for Preorder Cart */}
    {editingItem && (
      <DynamicProductConfigurator
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
        productSlug={editingItem.productSlug || editingItem.productId}
        storeId={editingItem.storeId}
        mode="edit"
        initialItem={editingItem}
        onUpdate={handleSaveEdit}
        onAddToCart={handleSaveEdit}
      />
    )}
  </div>;
}
