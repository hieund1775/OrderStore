import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Bike, MapPin, QrCode, Store, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/site/PageHeader";
import { useCart } from "@/lib/cart";
import { useBranch } from "@/lib/branch";
import { vnd } from "@/lib/data";
import { apiGet, apiPost, createIdempotencyKey, getCustomerToken, getCustomerUser } from "@/lib/api";
import { getOrderRequestHeaders } from "@/lib/order-access";
import {
  PendingPayOSPayment,
  normalizePendingPayment,
  parsePendingPaymentFromSession,
} from "@/lib/pending-payment";
import type { PaymentSummary } from "@/types/payment-summary";

export const Route = createFileRoute("/thanh-toan")({
  validateSearch: (search: Record<string, unknown>): { table_id?: string } => ({
    table_id:
      typeof search.table_id === "string"
        ? search.table_id
        : typeof search.table_id === "number"
          ? String(search.table_id)
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Giỏ hàng & Thanh toán — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Xác nhận đơn trà trái cây: chọn giao tận nơi hoặc lấy tại cửa hàng, áp mã ưu đãi và thanh toán COD, VietQR, MoMo, ZaloPay.",
      },
      { property: "og:title", content: "Thanh toán đơn trà — Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Đặt nhanh, thanh toán linh hoạt.",
      },
    ],
  }),
  component: Checkout,
});

type TableInfo = {
  table: { id: number; name: string; store_id: number; store_name: string; store_address: string };
};

type ProductCatalogMeta = {
  id: number;
  slug: string;
  name: string;
  root_category_id?: number;
  root_category_name?: string;
  root_category_slug?: string;
};

type CreateOrderResponse = {
  order_code?: string;
  group_code?: string;
  order_id?: number;
  subtotal?: number;
  discount_amount?: number;
  shipping_fee?: number;
  total?: number;
  total_amount?: number;
  is_grouped?: boolean;
  cancel_token?: string;
  checkout_url?: string;
  qr_code?: string;
  payment_expires_at?: string;
  payment_summary?: PaymentSummary;
};

function Checkout() {
  const { removeItems, selectedItems, selectedSubtotal } = useCart();
  const checkoutItems = selectedItems;
  const checkoutSubtotal = selectedSubtotal;
  const {
    stores: storeOptions,
    selectedStoreId,
    activeTableId,
    status: branchStatus,
    selectStore,
    bindTable,
    clearTable,
  } = useBranch();
  const navigate = useNavigate();
  const { table_id: searchTableId } = useSearch({ from: "/thanh-toan" });

  const [method, setMethod] = useState<"delivery" | "takeaway">("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const orderRequestRef = useRef<{ signature: string; key: string } | null>(null);
  const [addr, setAddr] = useState("");
  const [note, setNote] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [appliedCode, setAppliedCode] = useState("");
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingPayOSPayment | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [regeneratingQr, setRegeneratingQr] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [productMetaList, setProductMetaList] = useState<ProductCatalogMeta[]>([]);

  useEffect(() => {
    let active = true;
    apiGet<ProductCatalogMeta[]>("/api/products")
      .then((data) => {
        if (active && Array.isArray(data)) {
          setProductMetaList(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const productMetaMap = useMemo(() => {
    const map = new Map<string, ProductCatalogMeta>();
    for (const p of productMetaList) {
      map.set(String(p.id), p);
      if (p.slug) map.set(p.slug, p);
    }
    return map;
  }, [productMetaList]);

  useEffect(() => {
    const user = getCustomerUser();
    if (user) {
      if (user.fullname) setName(user.fullname);
      if (user.phone) setPhone(user.phone);
    }
  }, []);

  // Khôi phục đơn PayOS đang chờ thanh toán độc lập với các món chưa chọn còn lại trong giỏ.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("teaplus_pending_payment");
      const stored = parsePendingPaymentFromSession(raw);
      if (stored?.payment_code) setPendingOrder(stored);
    } catch {}
  }, []);
  const [countdownSec, setCountdownSec] = useState<number>(900);
  const tableId = searchTableId || activeTableId;
  const boundTableInfo =
    tableId != null && tableInfo != null && String(tableInfo.table.id) === String(tableId)
      ? tableInfo
      : null;
  const effectiveStoreId = boundTableInfo?.table.store_id ??
    (branchStatus === "ready" ? selectedStoreId : null);
  const checkoutStoreIds = Array.from(
    new Set(
      checkoutItems
        .map((item) => Number(item.storeId))
        .filter((storeId) => Number.isInteger(storeId) && storeId > 0),
    ),
  );
  const hasMultipleCheckoutStores = checkoutStoreIds.length > 1;
  const checkoutStoreId = checkoutStoreIds[0] ?? effectiveStoreId;
  const checkoutStoreIdRef = useRef<number | null>(checkoutStoreId);
  const previousStoreIdRef = useRef<number | null>(null);

  useEffect(() => {
    checkoutStoreIdRef.current = checkoutStoreId;
    const previousStoreId = previousStoreIdRef.current;
    if (checkoutStoreId != null && previousStoreId != null && checkoutStoreId !== previousStoreId) {
      setVoucherDiscount(0);
      setAppliedCode("");
      orderRequestRef.current = null;
    }
    if (checkoutStoreId != null) previousStoreIdRef.current = checkoutStoreId;
  }, [checkoutStoreId]);

  // Smart Chained Timeout Polling when PayOS pending order is active
  useEffect(() => {
    if (!pendingOrder || countdownSec <= 0) return;

    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let currentDelay = 3000;
    let isRequestInFlight = false;
    let shouldStop = false;

    const poll = async () => {
      if (!isMounted || !pendingOrder || isRequestInFlight) return;
      if (document.visibilityState === "hidden") return;

      isRequestInFlight = true;
      try {
        const res = await apiGet<{ order?: { payment_status: string }; group?: { payment_status: string } }>(
          `/api/payments/payos/status?code=${encodeURIComponent(pendingOrder.payment_code)}`,
          { headers: getOrderRequestHeaders(pendingOrder.payment_code) }
        );

        if (!isMounted) return;

        const paymentStatus = res.order?.payment_status || res.group?.payment_status;

        if (paymentStatus === "paid") {
          shouldStop = true;
          sessionStorage.removeItem("teaplus_pending_payment");
          toast.success("Thanh toán thành công!", {
            description: `Đơn hàng ${pendingOrder.payment_code} đã được xác nhận thanh toán.`,
          });
          navigate({ to: "/theo-doi-don", search: { code: pendingOrder.payment_code } });
          return;
        }

        if (paymentStatus === "expired") {
          shouldStop = true;
          return;
        }

        currentDelay = 3000;
      } catch (err: unknown) {
        currentDelay = Math.min(currentDelay * 1.5, 15000);
      } finally {
        isRequestInFlight = false;
        if (isMounted && !shouldStop && pendingOrder && countdownSec > 0) {
          timerId = setTimeout(poll, currentDelay);
        }
      }
    };

    timerId = setTimeout(poll, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isMounted && !shouldStop && pendingOrder && countdownSec > 0) {
        if (timerId) clearTimeout(timerId);
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pendingOrder?.payment_code, countdownSec <= 0, navigate]);

  // Countdown timer
  useEffect(() => {
    if (!pendingOrder?.payment_expires_at) return;
    const expiresMs = new Date(pendingOrder.payment_expires_at).getTime();

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setCountdownSec(remaining);
      return remaining;
    };

    updateTimer();
    const timer = setInterval(() => {
      const remaining = updateTimer();
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingOrder]);

  async function checkPaymentNow() {
    if (!pendingOrder) return;
    setCheckingPayment(true);
    try {
      const res = await apiGet<{ order?: { payment_status: string }; group?: { payment_status: string } }>(
        `/api/payments/payos/status?code=${encodeURIComponent(pendingOrder.payment_code)}`,
        { headers: getOrderRequestHeaders(pendingOrder.payment_code) }
      );
      const paymentStatus = res.order?.payment_status || res.group?.payment_status;
      if (paymentStatus === "paid") {
        sessionStorage.removeItem("teaplus_pending_payment");
        toast.success("Thanh toán thành công!", {
          description: `Đơn hàng ${pendingOrder.payment_code} đã được xác nhận thanh toán.`,
        });
        navigate({ to: "/theo-doi-don", search: { code: pendingOrder.payment_code } });
      } else {
        toast.info("Hệ thống chưa nhận được tín hiệu tiền về từ ngân hàng. Vui lòng đợi trong giây lát.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kiểm tra thanh toán thất bại");
    } finally {
      setCheckingPayment(false);
    }
  }

  async function regeneratePayOSQr() {
    if (!pendingOrder) return;
    setRegeneratingQr(true);
    try {
      const cancelToken =
        sessionStorage.getItem(`cancel_token_${pendingOrder.payment_code}`) ||
        localStorage.getItem(`cancel_token_${pendingOrder.payment_code}`) ||
        undefined;
      const res = await apiPost<{
        ok: boolean;
        order: {
          order_code: string;
          total: number;
          checkout_url?: string;
          qr_code?: string;
          payment_expires_at?: string;
        };
      }>("/api/payments/payos/regenerate-qr", {
        order_code: pendingOrder.payment_code,
        cancel_token: cancelToken,
        return_url: `${window.location.origin}/theo-doi-don`,
        cancel_url: `${window.location.origin}/thanh-toan`,
      }, {
        headers: getOrderRequestHeaders(pendingOrder.payment_code),
      });

      const updated = normalizePendingPayment({
        ...res.order,
        is_grouped: pendingOrder.is_grouped,
        order_id: pendingOrder.order_id,
      });

      if (updated) {
        setPendingOrder(updated);
        sessionStorage.setItem("teaplus_pending_payment", JSON.stringify(updated));
        toast.success("Đã tạo mã QR thanh toán mới (thời hạn 15 phút)!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tạo lại mã QR lúc này");
    } finally {
      setRegeneratingQr(false);
    }
  }

  async function cancelPendingOrder() {
    if (!pendingOrder) return;
    setCancellingOrder(true);
    try {
      const cancelToken =
        sessionStorage.getItem(`cancel_token_${pendingOrder.payment_code}`) ||
        localStorage.getItem(`cancel_token_${pendingOrder.payment_code}`) ||
        undefined;
      await apiPost("/api/orders/cancel", {
        order_code: pendingOrder.payment_code,
        reason: "Khách hàng hủy đơn khi chưa thanh toán",
        cancel_token: cancelToken,
      }, {
        headers: getOrderRequestHeaders(pendingOrder.payment_code),
      });
      sessionStorage.removeItem("teaplus_pending_payment");
      setPendingOrder(null);
      toast.success("Đã hủy đơn hàng thành công");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hủy đơn thất bại");
    } finally {
      setCancellingOrder(false);
    }
  }

  async function simulatePaymentDev() {
    if (!pendingOrder) return;
    try {
      await apiPost("/api/payments/payos/simulate-success", {
        order_code: pendingOrder.payment_code,
      });
      toast.success("Đã kích hoạt giả lập thanh toán!");
      await checkPaymentNow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể giả lập thanh toán");
    }
  }

  // Quét QR bàn → tự nhận diện bàn, mặc định "Tại bàn"
  useEffect(() => {
    if (!tableId) {
      setTableInfo(null);
      return;
    }
    let cancelled = false;
    apiGet<TableInfo>(`/api/table/resolve?table_id=${encodeURIComponent(tableId)}`)
      .then((res) => {
        if (cancelled) return;
        if (bindTable(res.table.id, res.table.store_id)) {
          setTableInfo(res);
          setMethod("takeaway");
        } else {
          setTableInfo(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTableInfo(null);
          clearTable();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bindTable, clearTable, tableId]);

  const discount = Math.min(voucherDiscount, checkoutSubtotal);
  const total = Math.max(0, checkoutSubtotal - discount);

  const industryGroups = useMemo(() => {
    const groupMap = new Map<string, {
      rootCategoryId: string;
      rootCategoryName: string;
      rootCategorySlug: string;
      items: typeof checkoutItems;
      subtotal: number;
    }>();

    for (const item of checkoutItems) {
      const meta = productMetaMap.get(item.productId);
      const rootId = meta?.root_category_id != null
        ? String(meta.root_category_id)
        : (item.rootCategoryId != null ? String(item.rootCategoryId) : "default");
      const rootName = meta?.root_category_name || item.rootCategoryName || "Chưa phân loại";
      const rootSlug = meta?.root_category_slug || item.rootCategorySlug || "chua-phan-loai";

      if (!groupMap.has(rootId)) {
        groupMap.set(rootId, {
          rootCategoryId: rootId,
          rootCategoryName: rootName,
          rootCategorySlug: rootSlug,
          items: [],
          subtotal: 0,
        });
      }
      const group = groupMap.get(rootId)!;
      group.items.push(item);
      group.subtotal += item.unitPrice * item.qty;
    }

    const groups = Array.from(groupMap.values());
    const totalSubtotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
    const totalDiscount = Math.min(voucherDiscount, totalSubtotal);

    let remainingDiscount = totalDiscount;
    return groups.map((g, idx) => {
      const isLast = idx === groups.length - 1;
      let allocatedDiscount = 0;
      if (totalSubtotal > 0 && totalDiscount > 0) {
        if (isLast) {
          allocatedDiscount = remainingDiscount;
        } else {
          allocatedDiscount = Math.floor((g.subtotal * totalDiscount) / totalSubtotal);
          remainingDiscount -= allocatedDiscount;
        }
      }
      const allocatedShipping = 0;
      const allocatedTotal = Math.max(0, g.subtotal - allocatedDiscount + allocatedShipping);
      return {
        ...g,
        allocatedDiscount,
        allocatedShipping,
        allocatedTotal,
      };
    });
  }, [checkoutItems, productMetaMap, voucherDiscount]);

  async function applyVoucher() {
    if (!voucherCode.trim()) return toast.error("Nhập mã ưu đãi trước");
    if (hasMultipleCheckoutStores) {
      return toast.error("Checkout đa chi nhánh chưa được backend kích hoạt. Vui lòng thanh toán từng chi nhánh.");
    }
    const storeAtRequest = checkoutStoreId;
    if (storeAtRequest == null) return toast.error("Vui lòng chọn chi nhánh nhận hàng");
    try {
      const res = await apiPost<{ valid: boolean; discount_amount: number; message: string }>(
        "/api/vouchers/apply",
        {
          code: voucherCode.trim(),
          subtotal: checkoutSubtotal,
          customer_phone: phone || "khach",
          store_id: storeAtRequest,
        },
      );
      if (checkoutStoreIdRef.current !== storeAtRequest) return;
      if (!res.valid) return toast.error(res.message);
      setVoucherDiscount(res.discount_amount);
      setAppliedCode(voucherCode.trim());
      toast.success(res.message);
    } catch (err) {
      if (checkoutStoreIdRef.current !== storeAtRequest) return;
      toast.error(err instanceof Error ? err.message : "Không áp dụng được mã");
    }
  }

  async function submitOrder() {
    if (checkoutItems.length === 0) return;
    if (!getCustomerToken()) {
      return toast.error("Vui lòng đăng ký hoặc đăng nhập tài khoản trước khi đặt hàng");
    }
    if (hasMultipleCheckoutStores) {
      return toast.error("Checkout đa chi nhánh chưa được backend kích hoạt. Vui lòng chọn món của một chi nhánh.");
    }
    if (checkoutItems.some((item) => item.stockMode === 'tracked' || item.fulfillmentLane === 'packing')) {
      return toast.error("Thanh toán hàng SKU đang chờ hoàn thiện giữ kho và checkout group ở backend.");
    }
    const cleanName = name.trim().replace(/\s+/g, " ");
    let cleanPhone = phone.trim().replace(/[\s\(\)\.-]/g, "");
    if (cleanPhone.startsWith("+84") && cleanPhone.length === 12) {
      cleanPhone = "0" + cleanPhone.slice(3);
    } else if (cleanPhone.startsWith("84") && cleanPhone.length === 11) {
      cleanPhone = "0" + cleanPhone.slice(2);
    }

    const isVnPhone = /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(cleanPhone);
    const isIntlPhone = /^\+[1-9][0-9]{7,14}$/.test(cleanPhone);
    const vnNameRegex = /^([A-Z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9][a-z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]*)(\s([A-Z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9][a-z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]*))+$/;

    if (!cleanName || !vnNameRegex.test(cleanName)) {
      return toast.error("Họ và tên không hợp lệ (tối thiểu 2 từ, viết hoa chữ cái đầu và không chứa số/ký tự lạ)");
    }
    if (!cleanPhone || (!isVnPhone && !isIntlPhone)) {
      return toast.error("Số điện thoại không hợp lệ (yêu cầu 10 số Việt Nam hoặc chuẩn quốc tế có mã vùng +)");
    }
    if (checkoutStoreId == null) {
      return toast.error("Vui lòng chọn chi nhánh nhận hàng");
    }
    if (boundTableInfo && checkoutStoreId !== boundTableInfo.table.store_id) {
      return toast.error("Món đã chọn không thuộc chi nhánh của bàn hiện tại");
    }
    setSubmitting(true);
    try {
      // Map slug → id qua API (backend chỉ chấp nhận id int)
      const [products, sizes, toppings] = await Promise.all([
        apiGet<{ id: number; slug: string }[]>("/api/products"),
        apiGet<{ id: number; label: string }[]>("/api/options/sizes"),
        apiGet<{ id: number; name: string }[]>("/api/options/toppings"),
      ]);
      const productIdBySlug = new Map<string, number>();
      for (const product of products) {
        productIdBySlug.set(String(product.id), Number(product.id));
        if (product.slug) productIdBySlug.set(product.slug, Number(product.id));
      }
      const sizeIdByLabel = new Map(sizes.map((s) => [s.label.toLowerCase(), s.id]));
      const toppingIdByName = new Map(toppings.map((t) => [t.name.toLowerCase(), t.id]));

      const payload = {
        store_id: checkoutStoreId,
        table_id: boundTableInfo ? boundTableInfo.table.id : null,
        order_type: method === "delivery" ? "Delivery" : "Take-away",
        payment_method: "VietQR",
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_addr: method === "delivery" && addr.trim() ? addr.trim() : null,
        voucher_code: appliedCode || null,
        note: note.trim() || null,
        source: "online",
        return_url: `${window.location.origin}/theo-doi-don`,
        cancel_url: `${window.location.origin}/thanh-toan`,
        items: checkoutItems.map((i) => ({
          product_id: productIdBySlug.get(i.productId) ?? Number(i.productId),
          size_id: i.size ? sizeIdByLabel.get(i.size.toLowerCase()) ?? null : null,
          base_tea: i.base || "Lục Trà Lài",
          sugar_level: i.sugar || "100%",
          ice_level: i.ice || "100%",
          topping_ids: (i.toppings || [])
            .map((t) => toppingIdByName.get(t.toLowerCase()))
            .filter((id): id is number => id != null),
          qty: i.qty,
          note: i.note,
        })),
      };

      const signature = JSON.stringify(payload);
      const previousRequest = orderRequestRef.current;
      const idempotencyKey = previousRequest?.signature === signature
        ? previousRequest.key
        : createIdempotencyKey();
      orderRequestRef.current = { signature, key: idempotencyKey };

      const res = await apiPost<CreateOrderResponse>("/api/orders", payload, {
        headers: { "Idempotency-Key": idempotencyKey },
      });

      orderRequestRef.current = null;
      const createdPaymentCode = res.group_code || res.order_code;

      if (res.cancel_token && createdPaymentCode) {
        try {
          sessionStorage.setItem(`cancel_token_${createdPaymentCode}`, res.cancel_token);
        } catch {}
      }

      if (res.checkout_url) {
        removeItems(checkoutItems.map((item) => item.key));
        try {
          sessionStorage.removeItem("teaplus_pending_payment");
        } catch {}
        toast.success("Đang chuyển hướng sang cổng thanh toán PayOS...");
        window.location.href = res.checkout_url;
        return;
      } else if (res.qr_code) {
        removeItems(checkoutItems.map((item) => item.key));
        const pending = normalizePendingPayment(res);
        if (pending) {
          setPendingOrder(pending);
          sessionStorage.setItem("teaplus_pending_payment", JSON.stringify(pending));
        }
        toast.info("Đã tạo đơn hàng! Vui lòng quét mã QR để chuyển khoản.");
      } else {
        toast.error("PayOS chưa trả về liên kết thanh toán. Vui lòng thử lại.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đặt hàng thất bại, thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  const mins = Math.floor(countdownSec / 60);
  const secs = countdownSec % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  if (pendingOrder) {
    const isExpired = countdownSec <= 0;
    return (
      <>
        <PageHeader eyebrow="Thanh toán PayOS" title="Đang chờ chuyển khoản" />
        <div className="container-page py-10 max-w-xl mx-auto">
          <div className="bg-card rounded-2xl border p-6 text-center space-y-6 shadow-lg">
            <div className={`inline-flex items-center justify-center size-14 rounded-full ${isExpired ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary animate-pulse"}`}>
              <Ticket className="size-7" />
            </div>

            <div>
              <h2 className="font-display text-2xl font-bold">
                {isExpired ? "Mã thanh toán đã hết hạn" : "Vui lòng thanh toán đơn hàng"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {pendingOrder.is_grouped ? "Mã thanh toán chung: " : "Mã đơn: "}
                <span className="font-mono font-bold text-foreground">{pendingOrder.payment_code}</span>
              </p>
              <p className="text-primary font-display text-3xl font-extrabold mt-2">
                {vnd(pendingOrder.total)}
              </p>
            </div>

            {/* Countdown Badge */}
            {isExpired ? (
              <div className="bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-xl p-3 inline-block text-sm font-semibold">
                ⚠️ Mã QR đã quá 15 phút. Đơn hàng của bạn vẫn được lưu giữ an toàn. Bạn có thể tạo mã mới bên dưới.
              </div>
            ) : (
              <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl p-3 inline-block font-mono text-sm font-semibold">
                ⏳ Mã thanh toán hết hạn sau: <span className="text-base font-bold">{timeStr}</span>
              </div>
            )}

            {/* QR Image / Code */}
            {!isExpired && pendingOrder.qr_code && (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 max-w-xs mx-auto shadow-inner">
                {pendingOrder.qr_code.startsWith("http") || pendingOrder.qr_code.startsWith("data:image") ? (
                  <img
                    src={pendingOrder.qr_code}
                    alt="VietQR PayOS"
                    className="size-56 object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pendingOrder.qr_code)}`}
                    alt="VietQR PayOS"
                    className="size-56 object-contain rounded-lg"
                  />
                )}
                <p className="text-xs text-gray-500 mt-2 font-medium">
                  Mở ứng dụng Ngân hàng / VNPAY để quét mã
                </p>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {!isExpired && (
                <div className="space-y-2">
                  <Button
                    variant="hero"
                    className="w-full text-base py-5 font-bold"
                    disabled={checkingPayment}
                    onClick={checkPaymentNow}
                  >
                    {checkingPayment ? "Đang kiểm tra..." : "🔍 Tôi đã chuyển khoản xong (Kiểm tra ngay)"}
                  </Button>

                  {pendingOrder.checkout_url && (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full"
                    >
                      <a href={pendingOrder.checkout_url} target="_blank" rel="noopener noreferrer">
                        Mở trang thanh toán PayOS ↗
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {isExpired ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="hero"
                    className="flex-1 py-5 font-bold"
                    disabled={regeneratingQr}
                    onClick={regeneratePayOSQr}
                  >
                    {regeneratingQr ? "Đang tạo mã..." : "🔄 Tạo mã QR thanh toán mới"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-berry border-berry/30 hover:bg-berry/10"
                    disabled={cancellingOrder}
                    onClick={cancelPendingOrder}
                  >
                    {cancellingOrder ? "Đang hủy..." : "🗑️ Hủy / Xóa đơn này"}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigate({ to: "/theo-doi-don", search: { code: pendingOrder.payment_code } });
                    }}
                  >
                    Theo dõi đơn hàng
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 text-berry hover:bg-berry/10"
                    disabled={cancellingOrder}
                    onClick={cancelPendingOrder}
                  >
                    {cancellingOrder ? "Đang hủy..." : "Hủy đơn này"}
                  </Button>
                </div>
              )}

              {/* Dev Simulation Helper */}
              {import.meta.env.DEV && (
                <div className="pt-2 border-t">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30"
                    onClick={simulatePaymentDev}
                  >
                    ⚡ [Dev Test] Giả lập thanh toán PayOS thành công
                  </Button>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground italic">
              Hệ thống sẽ tự động chuyển trang ngay sau khi nhận tiền về thành công (0ms webhook).
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Checkout" title="Giỏ hàng & Thanh toán" />

      {boundTableInfo && (
        <div className="container-page">
          <div className="gradient-warm text-primary-foreground flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 px-5 py-4 shadow-glow">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 flex size-11 shrink-0 items-center justify-center rounded-xl">
                <MapPin className="size-6" />
              </span>
              <div>
                <p className="font-display text-base font-bold">
                  Đặt món tại: {boundTableInfo.table.name}
                </p>
                <p className="text-sm opacity-90">
                  {boundTableInfo.table.store_name} · {boundTableInfo.table.store_address}
                </p>
              </div>
            </div>
            <span className="bg-white/20 rounded-full px-3 py-1 text-xs font-semibold">
              Bàn đã được gắn vào đơn
            </span>
          </div>
        </div>
      )}

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Items by Industry */}
          <section className="bg-card rounded-2xl border p-5 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Chi tiết ngành hàng & Món chọn ({checkoutItems.length})</h2>
              {industryGroups.length > 1 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-semibold">
                  Đơn gộp {industryGroups.length} ngành hàng
                </Badge>
              )}
            </div>

            {checkoutItems.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground text-sm">Giỏ hàng trống.</p>
                <Button asChild variant="hero" size="sm" className="mt-3">
                  <Link to="/menu">Chọn món ngay</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {industryGroups.map((group) => (
                  <div key={group.rootCategoryId} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-bold text-foreground">
                          {group.rootCategoryName}
                        </span>
                        <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                          {group.items.reduce((s, it) => s + it.qty, 0)} món
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {vnd(group.allocatedTotal)}
                      </span>
                    </div>

                    <div className="space-y-3 pt-1">
                      {group.items.map((i) => (
                        <div key={i.key} className="flex gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                          <img
                            src={i.image}
                            alt={i.name}
                            loading="lazy"
                            className="size-14 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm">{i.name}</p>
                            <p className="text-muted-foreground text-xs">
                              Size {i.size} · {i.base} · {i.sugar} đường · {i.ice} đá
                            </p>
                            {i.toppings && i.toppings.length > 0 && (
                              <p className="text-muted-foreground text-xs">
                                Topping: {i.toppings.join(", ")}
                              </p>
                            )}
                            {i.note && (
                              <p className="text-muted-foreground text-xs italic">Ghi chú: {i.note}</p>
                            )}
                            <p className="text-primary mt-1 font-bold text-xs">
                              {vnd(i.unitPrice)} × {i.qty} = {vnd(i.unitPrice * i.qty)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-background/80 rounded-lg p-2.5 text-xs space-y-1 border border-border/40">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tạm tính ngành:</span>
                        <span className="font-medium text-foreground">{vnd(group.subtotal)}</span>
                      </div>
                      {group.allocatedDiscount > 0 && (
                        <div className="flex justify-between text-leaf font-medium">
                          <span>Giảm giá phân bổ:</span>
                          <span>− {vnd(group.allocatedDiscount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-foreground border-t pt-1">
                        <span>Thành tiền ngành:</span>
                        <span className="text-primary font-bold">{vnd(group.allocatedTotal)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Fulfilment */}
          <section className="bg-card rounded-2xl border p-5">
            <h2 className="font-display mb-4 text-lg font-bold">Hình thức nhận hàng</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setMethod("delivery")}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left ${method === "delivery" ? "border-primary bg-accent/50" : ""}`}
              >
                <Bike className="text-primary size-5" />
                <div>
                  <p className="text-sm font-semibold">Giao tận nơi</p>
                  <p className="text-muted-foreground text-xs">25–35 phút</p>
                </div>
              </button>
              <button
                onClick={() => setMethod("takeaway")}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left ${method === "takeaway" ? "border-primary bg-accent/50" : ""}`}
              >
                <Store className="text-primary size-5" />
                <div>
                  <p className="text-sm font-semibold">
                    {boundTableInfo ? "Đến lấy / Tại bàn" : "Đến lấy tại cửa hàng"}
                  </p>
                  <p className="text-muted-foreground text-xs">Sẵn sàng sau 15 phút</p>
                </div>
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Họ và tên</Label>
                <Input
                  id="name"
                  placeholder="Nguyễn Minh Trang"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tel">Số điện thoại</Label>
                <Input
                  id="tel"
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {method === "delivery" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr">Địa chỉ giao hàng</Label>
                  <Input
                    id="addr"
                    placeholder="Số nhà, đường, phường, quận"
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Chi nhánh nhận hàng</Label>
                  <Select
                    value={effectiveStoreId == null ? undefined : String(effectiveStoreId)}
                    onValueChange={(value) => selectStore(value)}
                    disabled={!!boundTableInfo || branchStatus !== "ready" || storeOptions.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          branchStatus === "loading"
                            ? "Đang tải chi nhánh..."
                            : branchStatus === "error"
                              ? "Không tải được chi nhánh"
                              : "Chọn chi nhánh"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {storeOptions.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {boundTableInfo && (
                    <p className="text-muted-foreground text-xs">
                      Bàn {boundTableInfo.table.name} — {boundTableInfo.table.store_name}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Textarea
                  id="note"
                  rows={2}
                  placeholder="VD: Ít đá hơn, gọi trước khi giao…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Payment Method */}
          <section className="bg-card rounded-2xl border p-5">
            <h2 className="font-display mb-3 text-lg font-bold">Phương thức thanh toán</h2>
            <div className="flex items-center gap-3.5 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-all">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <QrCode className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">Chuyển khoản VietQR qua PayOS</p>
                  <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20 text-[10px] px-1.5 py-0 font-bold">
                    Tự động
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Quét mã QR qua mọi ứng dụng Ngân hàng / MoMo / VNPAY để kích hoạt đơn ngay tức thì.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-32 lg:h-fit">
          <div className="bg-card space-y-4 rounded-2xl border p-5">
            <h2 className="font-display text-lg font-bold">Tóm tắt đơn hàng</h2>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder="Nhập mã ưu đãi"
                  className="pl-9"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                />
              </div>
              <Button variant="soft" onClick={applyVoucher} disabled={!!appliedCode}>
                {appliedCode ? "Đã áp dụng" : "Áp dụng"}
              </Button>
            </div>
            {appliedCode && (
              <p className="text-leaf text-xs font-medium">
                Mã {appliedCode}: giảm {vnd(discount)}
              </p>
            )}

            <Separator />

            {/* Chi tiết theo ngành hàng */}
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                Chi tiết theo ngành hàng
              </p>
              {industryGroups.map((g) => (
                <div key={g.rootCategoryId} className="space-y-0.5">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="truncate pr-2">{g.rootCategoryName}</span>
                    <span className="font-bold text-foreground shrink-0">{vnd(g.allocatedTotal)}</span>
                  </div>
                  {g.allocatedDiscount > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Tạm tính: {vnd(g.subtotal)} · Giảm: −{vnd(g.allocatedDiscount)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <Row label="Tạm tính chung (Tiền món)" value={vnd(checkoutSubtotal)} />
              <Row label="Giảm giá chung" value={discount ? `− ${vnd(discount)}` : "0₫"} />
              <Row label="Phí giao hàng" value="0₫" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="font-semibold">Tổng thanh toán</span>
              <span className="text-primary font-display text-2xl font-extrabold">
                {vnd(total)}
              </span>
            </div>

            <Button
              variant="hero"
              className="w-full"
              disabled={checkoutItems.length === 0 || submitting}
              onClick={submitOrder}
            >
              {submitting ? "Đang đặt hàng…" : "Xác nhận đặt hàng"}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Tổng tiền do hệ thống tính toán chính xác từ giá niêm yết.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
