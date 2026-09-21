import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Minus, ShoppingBag, AlertCircle, Lock } from 'lucide-react';
import {
  fetchPublicProductDetails,
  resolveProductConfiguration,
  type PublicProductDetails,
  type ResolvedProductConfiguration,
  type AppliedModifier,
} from '@/lib/api';
import {
  vnd,
  products as fallbackProducts,
  resolveProductImage,
  FALLBACK_TEA_IMAGE,
} from '@/lib/data';
import { toast } from 'sonner';
import { getCustomerSession, openCustomerLoginModal } from '@/lib/customer-session';

import { type CartItem } from '@/lib/cart';

export interface ConfiguredItemPayload {
  productId: number;
  productName: string;
  productSlug: string;
  variantId: number | null;
  sku: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  appliedModifiers: AppliedModifier[];
  stockMode: 'tracked' | 'made_to_order';
  fulfillmentLane: 'kitchen' | 'packing';
  image?: string;
}

export interface DynamicProductConfiguratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productSlug: string;
  storeId?: number | string;
  mode?: 'add' | 'buy' | 'edit';
  initialItem?: CartItem | null;
  onAddToCart?: (configuredItem: ConfiguredItemPayload) => void;
  onBuyNow?: (configuredItem: ConfiguredItemPayload) => void;
  onUpdate?: (configuredItem: ConfiguredItemPayload) => void;
}

/**
 * The public resolver is the pricing authority. This is only a resilient UI
 * fallback for legacy/local menu data when that read-only resolver is briefly
 * unavailable. Keep its shape identical to the canonical response so the
 * Add, Buy now and preorder handlers never receive a partial configuration.
 */
export function buildLocalFallbackConfiguration(
  product: PublicProductDetails,
  selectedVariantValueIds: number[],
  selectedModifierValueIds: number[],
): ResolvedProductConfiguration {
  const selectedVariant = product.variants?.[0] || {
    id: product.id,
    sku: `SKU-${product.slug}-DEFAULT`,
    variant_signature: 'default',
    name_suffix: 'Tiêu chuẩn',
    price: product.price,
    compare_at_price: null,
    is_available: true,
    available_stock: null,
  };
  const appliedModifiers: AppliedModifier[] = [];
  let modifierExtra = 0;

  for (const attribute of product.attributes || []) {
    for (const value of attribute.values || []) {
      const isSelected = attribute.role === 'variant'
        ? selectedVariantValueIds.includes(value.id)
        : selectedModifierValueIds.includes(value.id);
      if (!isSelected) continue;
      const priceAdjustment = Number(value.price_adjustment || 0);
      modifierExtra += priceAdjustment;
      appliedModifiers.push({
        attribute_definition_id: attribute.id,
        attribute_code: attribute.code,
        attribute_name: attribute.name,
        attribute_value_id: value.id,
        value_code: value.code,
        value_label: value.label,
        attribute_label: value.label,
        price_adjustment: priceAdjustment,
      });
    }
  }

  const basePrice = Number(selectedVariant.price ?? product.price ?? 0);
  const finalPrice = basePrice + modifierExtra;
  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      fulfillment_lane: product.fulfillment_lane,
      stock_mode: product.stock_mode,
    },
    variant: {
      id: selectedVariant.id,
      sku: selectedVariant.sku,
      variant_signature: selectedVariant.variant_signature,
      name_suffix: selectedVariant.name_suffix || undefined,
      base_price: basePrice,
      compare_at_price: selectedVariant.compare_at_price ?? null,
      is_available: selectedVariant.is_available !== false,
      available_stock: selectedVariant.available_stock ?? null,
    },
    applied_modifiers: appliedModifiers,
    pricing: {
      variant_base_price: basePrice,
      modifiers_extra_total: modifierExtra,
      final_price: finalPrice,
    },
    base_price: basePrice,
    modifier_extra: modifierExtra,
    unit_price: finalPrice,
  };
}

export function DynamicProductConfigurator({
  open,
  onOpenChange,
  productSlug,
  storeId,
  mode = 'add',
  initialItem = null,
  onAddToCart,
  onBuyNow,
  onUpdate,
}: DynamicProductConfiguratorProps) {
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<PublicProductDetails | null>(null);
  const [selectedVariantValueIds, setSelectedVariantValueIds] = useState<number[]>([]);
  const [selectedModifierValueIds, setSelectedModifierValueIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [resolvedConfig, setResolvedConfig] = useState<ResolvedProductConfiguration | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [configWarning, setConfigWarning] = useState('');

  // 1. Fetch Product details with Schema & Variants
  useEffect(() => {
    if (!open || !productSlug) return;
    let isMounted = true;
    setLoading(true);
    setLoadError('');
    setResolvedConfig(null);

    const loadData = async () => {
      let data: PublicProductDetails | null = null;
      try {
        data = await fetchPublicProductDetails(productSlug, storeId);
      } catch {
        if (storeId) {
          try {
            data = await fetchPublicProductDetails(productSlug);
          } catch {
            data = null;
          }
        }
      }

      if (!data && initialItem?.productId && String(initialItem.productId) !== String(productSlug)) {
        try {
          data = await fetchPublicProductDetails(String(initialItem.productId), storeId);
        } catch {
          try {
            data = await fetchPublicProductDetails(String(initialItem.productId));
          } catch {
            data = null;
          }
        }
      }

      // Fallback to local catalog if API did not find product
      if (!data) {
        const found = fallbackProducts.find(
          (p) =>
            p.slug === productSlug ||
            String(p.id) === productSlug ||
            (initialItem?.productId && String(p.id) === String(initialItem.productId)) ||
            (initialItem?.name && p.name === initialItem.name),
        );
        if (found) {
          data = {
            id: Number(found.id) || 1,
            name: found.name,
            slug: found.slug,
            description: found.desc,
            price: found.price,
            image_url: resolveProductImage(found.slug, found.image),
            category_id: 1,
            fulfillment_lane: 'kitchen' as const,
            stock_mode: 'made_to_order' as const,
            variants: [
              {
                id: Number(found.id) || 1,
                sku: `SKU-${found.slug}-M`,
                variant_signature: 'size_m',
                name_suffix: 'Size M',
                price: found.price,
                compare_at_price: null,
                is_available: true,
                available_stock: null,
              },
              {
                id: (Number(found.id) || 1) + 1000,
                sku: `SKU-${found.slug}-L`,
                variant_signature: 'size_l',
                name_suffix: 'Size L (+10.000₫)',
                price: found.price + 10000,
                compare_at_price: null,
                is_available: true,
                available_stock: null,
              },
            ],
            attributes: [
              {
                id: 101,
                code: 'sugar',
                name: 'Mức Đường',
                role: 'modifier' as const,
                input_type: 'single_select' as const,
                is_required: true,
                min_selections: 1,
                max_selections: 1,
                sort_order: 1,
                is_locked: false,
                values: [
                  { id: 1011, code: '100_sugar', label: '100% (Chuẩn)', price_adjustment: 0, sort_order: 1, is_active: true },
                  { id: 1012, code: '70_sugar', label: '70% Đường', price_adjustment: 0, sort_order: 2, is_active: true },
                  { id: 1013, code: '50_sugar', label: '50% Đường', price_adjustment: 0, sort_order: 3, is_active: true },
                  { id: 1014, code: '0_sugar', label: 'Không đường', price_adjustment: 0, sort_order: 4, is_active: true },
                ],
              },
              {
                id: 102,
                code: 'ice',
                name: 'Mức Đá',
                role: 'modifier' as const,
                input_type: 'single_select' as const,
                is_required: true,
                min_selections: 1,
                max_selections: 1,
                sort_order: 2,
                is_locked: false,
                values: [
                  { id: 1021, code: '100_ice', label: '100% Đá', price_adjustment: 0, sort_order: 1, is_active: true },
                  { id: 1022, code: '70_ice', label: '70% Đá', price_adjustment: 0, sort_order: 2, is_active: true },
                  { id: 1023, code: 'da_rieng', label: 'Đá riêng', price_adjustment: 0, sort_order: 3, is_active: true },
                  { id: 1024, code: '0_ice', label: 'Không đá', price_adjustment: 0, sort_order: 4, is_active: true },
                ],
              },
              {
                id: 103,
                code: 'topping',
                name: 'Topping Thêm',
                role: 'modifier' as const,
                input_type: 'multi_select' as const,
                is_required: false,
                min_selections: 0,
                max_selections: 5,
                sort_order: 3,
                is_locked: false,
                values: [
                  { id: 1031, code: 'trai_cay_dam', label: 'Trái cây dầm tươi', price_adjustment: 10000, sort_order: 1, is_active: true },
                  { id: 1032, code: 'nha_dam', label: 'Thạch nha đam', price_adjustment: 8000, sort_order: 2, is_active: true },
                  { id: 1033, code: 'thach_trai_cay', label: 'Thạch trái cây', price_adjustment: 8000, sort_order: 3, is_active: true },
                  { id: 1034, code: 'tran_chau_trang', label: 'Trân châu trắng', price_adjustment: 7000, sort_order: 4, is_active: true },
                  { id: 1035, code: 'macchiato', label: 'Kem Macchiato Phô Mai', price_adjustment: 12000, sort_order: 5, is_active: true },
                ],
              },
            ],
          };
        }
      }

      if (!isMounted) return;
      if (!data) {
        setLoadError('Không tìm thấy thông tin món');
        setProduct(null);
        setLoading(false);
        return;
      }

      setProduct(data);

      if (initialItem) {
        setQuantity(initialItem.qty || 1);
        const pastModifiers = Array.isArray(initialItem.appliedModifiers) ? initialItem.appliedModifiers : [];
        let hasInvalidOption = false;
        const initialVarValIds: number[] = [];
        const initialModValIds: number[] = [];

        // Helper to normalize string for forgiving matching
        const normalizeStr = (s?: string) =>
          (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        const matchValue = (val: any, target: any) => {
          if (!val || !target || val.is_active === false) return false;
          if (target.id && Number(val.id) === Number(target.id)) return true;

          const targetCode = String(target.value_code || target.code || '').toLowerCase();
          const targetLabel = String(
            target.value_label || target.label || target.name || (typeof target === 'string' ? target : '')
          ).toLowerCase();

          const vCode = String(val.code || '').toLowerCase();
          const vLabel = String(val.label || val.name || '').toLowerCase();

          if (targetCode && vCode && targetCode === vCode) return true;
          if (targetLabel && vLabel && targetLabel === vLabel) return true;

          const normTarget = normalizeStr(targetLabel || targetCode);
          const normV = normalizeStr(vLabel || vCode);

          if (normTarget && normV) {
            if (normTarget === normV) return true;
            if (normTarget.includes(normV) || normV.includes(normTarget)) return true;
            if (normTarget.includes('macchiato') && (normV.includes('macchiato') || vCode.includes('macchiato'))) return true;
          }
          return false;
        };

        // 1. Map past modifiers to attributes & values
        for (const pastMod of pastModifiers) {
          let targetAttr = (data.attributes || []).find(
            (a) =>
              a.code === pastMod.attribute_code ||
              (pastMod.attribute_code === 'toppings' && a.code === 'topping') ||
              (pastMod.attribute_code === 'topping' && a.code === 'toppings') ||
              (pastMod.attribute_name && a.name.toLowerCase() === pastMod.attribute_name.toLowerCase())
          );

          let matchedVal = targetAttr
            ? (targetAttr.values || []).find((v) => matchValue(v, pastMod))
            : null;

          if (!matchedVal) {
            // Search across all attributes in data.attributes
            for (const a of data.attributes || []) {
              const v = (a.values || []).find((val) => matchValue(val, pastMod));
              if (v) {
                targetAttr = a;
                matchedVal = v;
                break;
              }
            }
          }

          if (!matchedVal || !targetAttr) {
            continue;
          }

          if (targetAttr.role === 'variant') {
            if (!initialVarValIds.includes(matchedVal.id)) initialVarValIds.push(matchedVal.id);
          } else {
            if (!initialModValIds.includes(matchedVal.id)) initialModValIds.push(matchedVal.id);
          }
        }

        // Fallback: restore toppings from initialItem.toppings array if present
        if (Array.isArray(initialItem.toppings) && initialItem.toppings.length > 0) {
          for (const top of initialItem.toppings) {
            for (const a of data.attributes || []) {
              if (a.role === 'variant') continue;
              const matchedVal = (a.values || []).find((v) => matchValue(v, top));
              if (matchedVal && !initialModValIds.includes(matchedVal.id)) {
                initialModValIds.push(matchedVal.id);
                break;
              }
            }
          }
        }

        // Fallback: restore sugar if not yet matched
        const sugarAttr = (data.attributes || []).find(
          (a) => a.code === 'sugar' || a.name?.toLowerCase().includes('đường')
        );
        if (sugarAttr && !sugarAttr.values.some((v) => initialModValIds.includes(v.id)) && initialItem.sugar) {
          const matchedVal = sugarAttr.values.find((v) => matchValue(v, initialItem.sugar));
          if (matchedVal) initialModValIds.push(matchedVal.id);
        }

        // Fallback: restore ice if not yet matched
        const iceAttr = (data.attributes || []).find(
          (a) => a.code === 'ice' || a.name?.toLowerCase().includes('đá')
        );
        if (iceAttr && !iceAttr.values.some((v) => initialModValIds.includes(v.id)) && initialItem.ice) {
          const matchedVal = iceAttr.values.find((v) => matchValue(v, initialItem.ice));
          if (matchedVal) initialModValIds.push(matchedVal.id);
        }

        // 2. Check variant matching if variantId, sku or size present and no variant attr matched yet
        if (initialVarValIds.length === 0 && (initialItem.variantId || initialItem.sku || initialItem.size)) {
          const matchedVariant = (data.variants || []).find(
            (v) =>
              (initialItem.variantId && v.id === initialItem.variantId) ||
              (initialItem.sku && v.sku === initialItem.sku)
          );
          if (matchedVariant && matchedVariant.is_available !== false) {
            const varAttr = (data.attributes || []).find((a) => a.role === 'variant');
            if (varAttr) {
              const matchedVal = varAttr.values?.find(
                (v) =>
                  (matchedVariant.variant_signature &&
                    v.code.toLowerCase() === matchedVariant.variant_signature.toLowerCase()) ||
                  (matchedVariant.name_suffix &&
                    v.label.toLowerCase() === matchedVariant.name_suffix.toLowerCase())
              );
              if (matchedVal) {
                initialVarValIds.push(matchedVal.id);
              }
            }
          }
          if (initialVarValIds.length === 0 && initialItem.size) {
            const varAttr = (data.attributes || []).find((a) => a.role === 'variant');
            if (varAttr) {
              const matchedVal = varAttr.values?.find(
                (v) =>
                  v.code.toLowerCase() === `size_${initialItem.size?.toLowerCase()}` ||
                  v.code.toLowerCase() === initialItem.size?.toLowerCase() ||
                  v.label.toLowerCase().includes(initialItem.size?.toLowerCase() || '')
              );
              if (matchedVal) initialVarValIds.push(matchedVal.id);
            }
          }
        }

        // 3. Verify that all required attributes are satisfied
        for (const attr of data.attributes || []) {
          if (attr.is_required) {
            if (attr.role === 'variant') {
              const hasVal = attr.values?.some((v) => initialVarValIds.includes(v.id));
              if (!hasVal) hasInvalidOption = true;
            } else {
              const hasVal = attr.values?.some((v) => initialModValIds.includes(v.id));
              if (!hasVal) hasInvalidOption = true;
            }
          }
        }

        if (hasInvalidOption) {
          setConfigWarning(
            'Một số tuỳ chọn bạn đã chọn trước đây hiện không còn khả dụng tại chi nhánh này. Vui lòng chọn lại.'
          );
          // TUYỆT ĐỐI KHÔNG tự động chọn giá trị mặc định khi cấu hình cũ bị thiếu / không hợp lệ!
        } else {
          setConfigWarning('');
        }

        setSelectedVariantValueIds(initialVarValIds);
        setSelectedModifierValueIds(initialModValIds);
      } else {
        setConfigWarning('');
        setQuantity(1);
        // Pre-select first values for required single_select attributes (new add/buy mode only)
        const initialVarValIds: number[] = [];
        const initialModValIds: number[] = [];

        (data.attributes || []).forEach((attr) => {
          if (attr.input_type === 'single_select' && attr.is_required && attr.values?.length > 0) {
            if (attr.role === 'variant') {
              initialVarValIds.push(attr.values[0].id);
            } else if (attr.role === 'modifier') {
              initialModValIds.push(attr.values[0].id);
            }
          }
        });

        setSelectedVariantValueIds(initialVarValIds);
        setSelectedModifierValueIds(initialModValIds);
      }

      setLoading(false);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [open, productSlug, storeId, initialItem]);

  // 2. Resolve Price & Configuration whenever selections change
  useEffect(() => {
    if (!product || !open) return;
    let isMounted = true;
    setCalculating(true);
    setResolvedConfig(null);

    resolveProductConfiguration({
      store_id: storeId,
      product_slug: product.slug,
      variant_value_ids: selectedVariantValueIds,
      modifier_value_ids: selectedModifierValueIds,
    })
      .then((res) => {
        if (isMounted) setResolvedConfig(res);
      })
      .catch(() => {
        if (!isMounted) return;
        setResolvedConfig(
          buildLocalFallbackConfiguration(product, selectedVariantValueIds, selectedModifierValueIds),
        );
      })
      .finally(() => {
        if (isMounted) setCalculating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [product, selectedVariantValueIds, selectedModifierValueIds, storeId, open]);

  const isConfigurationComplete = useMemo(() => {
    if (!product) return false;
    for (const attr of product.attributes || []) {
      if (attr.is_required) {
        if (attr.role === 'variant') {
          const hasSelected = (attr.values || []).some((v) => selectedVariantValueIds.includes(v.id));
          if (!hasSelected) return false;
        } else {
          const count = (attr.values || []).filter((v) => selectedModifierValueIds.includes(v.id)).length;
          const minReq = attr.min_selections || 1;
          if (count < minReq) return false;
        }
      }
    }
    return true;
  }, [product, selectedVariantValueIds, selectedModifierValueIds]);

  if (!open) return null;

  const handleSelectSingle = (role: 'variant' | 'modifier', attr: PublicProductDetails['attributes'][number], valId: number) => {
    if (attr.is_locked) return;
    const existingValIds = attr.values.map((v) => v.id);
    if (role === 'variant') {
      const filtered = selectedVariantValueIds.filter((id) => !existingValIds.includes(id));
      setSelectedVariantValueIds([...filtered, valId]);
    } else {
      const filtered = selectedModifierValueIds.filter((id) => !existingValIds.includes(id));
      setSelectedModifierValueIds([...filtered, valId]);
    }
  };

  const handleToggleMulti = (attr: PublicProductDetails['attributes'][number], valId: number) => {
    if (attr.is_locked) return;
    if (selectedModifierValueIds.includes(valId)) {
      setSelectedModifierValueIds(selectedModifierValueIds.filter((id) => id !== valId));
    } else {
      setSelectedModifierValueIds([...selectedModifierValueIds, valId]);
    }
  };

  const handleConfirmAction = () => {
    if (!resolvedConfig || !product) return;
    const resolvedProduct = resolvedConfig.product;
    const resolvedVariant = resolvedConfig.variant;

    if (resolvedVariant.is_available === false) {
      toast.error('Biến thể món này hiện đang tạm hết tại chi nhánh');
      return;
    }

    const payload: ConfiguredItemPayload = {
      productId: resolvedProduct.id,
      productName: resolvedProduct.name,
      productSlug: resolvedProduct.slug,
      variantId: resolvedVariant.id,
      sku: resolvedVariant.sku,
      variantName: resolvedVariant.name_suffix || null,
      quantity,
      unitPrice: resolvedConfig.unit_price,
      appliedModifiers: resolvedConfig.applied_modifiers,
      stockMode: resolvedProduct.stock_mode,
      fulfillmentLane: resolvedProduct.fulfillment_lane,
      image: product?.image_url || undefined,
    };

    if (mode === 'edit') {
      onUpdate?.(payload);
      toast.success(`Đã cập nhật món ${resolvedProduct.name}`);
      onOpenChange(false);
      return;
    }

    const session = getCustomerSession();
    if (!session) {
      toast.error(
        mode === 'buy'
          ? 'Vui lòng đăng nhập hoặc đăng ký tài khoản để Mua ngay'
          : 'Vui lòng đăng nhập hoặc đăng ký tài khoản để thêm món vào giỏ hàng'
      );
      openCustomerLoginModal();
      return;
    }

    if (mode === 'buy') {
      onBuyNow?.(payload);
      onOpenChange(false);
      return;
    }

    onAddToCart?.(payload);
    toast.success(`Đã thêm ${quantity}x ${resolvedProduct.name} vào giỏ hàng`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-0">
        {loadError ? (
          <div className="p-12 text-center text-sm text-destructive flex flex-col items-center gap-3">
            <AlertCircle className="size-8 text-destructive/80" />
            <p className="font-semibold">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        ) : loading || !product ? (
          <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="border-b bg-muted/20 p-5 flex gap-4">
              <div className="size-20 shrink-0 rounded-2xl bg-muted" />
              <div className="flex-1 space-y-2.5 py-1">
                <div className="h-5 w-3/4 rounded-md bg-muted" />
                <div className="h-4 w-1/3 rounded-md bg-muted" />
              </div>
            </div>

            {/* Content Options Skeleton */}
            <div className="space-y-6 p-5">
              <div className="space-y-2.5">
                <div className="h-4 w-24 rounded-md bg-muted" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-9 rounded-xl bg-muted" />
                  <div className="h-9 rounded-xl bg-muted" />
                  <div className="h-9 rounded-xl bg-muted" />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="h-4 w-28 rounded-md bg-muted" />
                <div className="grid grid-cols-4 gap-2">
                  <div className="h-9 rounded-xl bg-muted" />
                  <div className="h-9 rounded-xl bg-muted" />
                  <div className="h-9 rounded-xl bg-muted" />
                  <div className="h-9 rounded-xl bg-muted" />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="h-4 w-28 rounded-md bg-muted" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-10 rounded-xl bg-muted" />
                  <div className="h-10 rounded-xl bg-muted" />
                </div>
              </div>
            </div>

            {/* Footer Skeleton */}
            <div className="border-t bg-card p-4 flex items-center justify-between gap-4">
              <div className="h-10 w-28 rounded-xl bg-muted" />
              <div className="h-11 flex-1 rounded-xl bg-muted" />
            </div>
          </div>
        ) : (
          <div>
            {/* Header with image */}
            <div className="relative border-b bg-muted/20 p-5">
              <div className="flex gap-4">
                <img
                  src={resolveProductImage(product.slug, product.image_url, {
                    category: (product as any).category_name,
                    fulfillment_lane: product.fulfillment_lane,
                    name: product.name,
                  })}
                  alt={product.name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = resolveProductImage(product.slug, null, {
                      category: (product as any).category_name,
                      fulfillment_lane: product.fulfillment_lane,
                      name: product.name,
                    });
                  }}
                  className="size-20 shrink-0 rounded-2xl object-cover border"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-lg leading-tight text-foreground truncate">
                    {product.name}
                  </h3>
                  <p className="text-primary font-bold text-base mt-1">
                    {resolvedConfig ? vnd(resolvedConfig.unit_price) : vnd(product.price)}
                  </p>
                </div>
              </div>
            </div>

            {/* Attributes Body */}
            <div className="p-5 space-y-5">
              {configWarning && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-amber-700 dark:text-amber-400 text-xs">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Cấu hình cần chọn lại</p>
                    <p>{configWarning}</p>
                  </div>
                </div>
              )}

              {(product.attributes || []).map((attr) => {
                const isVariant = attr.role === 'variant';
                const isMulti = attr.input_type === 'multi_select';

                return (
                  <div key={attr.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>{attr.name}</span>
                        {attr.is_required && <span className="text-destructive">*</span>}
                        {attr.is_locked && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
                            <Lock className="size-2.5 mr-0.5" /> Cố định
                          </Badge>
                        )}
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        {isMulti ? 'Chọn nhiều' : 'Chọn 1'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(attr.values || []).map((val) => {
                        const isSelected = isVariant
                          ? selectedVariantValueIds.includes(val.id)
                          : selectedModifierValueIds.includes(val.id);

                        return (
                          <button
                            key={val.id}
                            type="button"
                            disabled={attr.is_locked}
                            onClick={() =>
                              isMulti
                                ? handleToggleMulti(attr, val.id)
                                : handleSelectSingle(attr.role, attr, val.id)
                            }
                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                              attr.is_locked
                                ? isSelected
                                  ? 'border-muted-foreground/30 bg-muted text-foreground opacity-90 cursor-not-allowed'
                                  : 'border-border bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed'
                                : isSelected
                                  ? 'border-primary bg-primary text-primary-foreground shadow-glow'
                                  : 'border-border bg-card text-foreground hover:bg-muted/40'
                            }`}
                          >
                            {isSelected && <Check className="size-3.5" />}
                            <span>{val.label}</span>
                            {val.price_adjustment > 0 && (
                              <span
                                className={`text-[10px] ${
                                  isSelected ? 'text-primary-foreground/80' : 'text-primary'
                                }`}
                              >
                                (+{vnd(val.price_adjustment)})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Quantity selector */}
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-xs font-bold text-foreground">Số lượng</span>
                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8 rounded-full"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="font-mono font-bold text-sm min-w-[20px] text-center">
                    {quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8 rounded-full"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              {resolvedConfig?.variant.is_available === false && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-destructive text-xs">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>Sản phẩm hoặc biến thể này hiện không có sẵn tại chi nhánh đang chọn.</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t bg-muted/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Tổng cộng</p>
                <p className="font-display font-bold text-lg text-primary">
                  {resolvedConfig ? vnd(resolvedConfig.unit_price * quantity) : vnd(product.price * quantity)}
                </p>
              </div>

              {mode === 'edit' ? (
                <Button
                  onClick={handleConfirmAction}
                  disabled={
                    calculating ||
                    !resolvedConfig ||
                    !isConfigurationComplete ||
                    resolvedConfig.variant.is_available === false
                  }
                  className="gap-2 px-6 rounded-2xl"
                >
                  <Check className="size-4" />
                  <span>Cập nhật món</span>
                </Button>
              ) : mode === 'buy' ? (
                <Button
                  onClick={handleConfirmAction}
                  disabled={
                    calculating ||
                    !resolvedConfig ||
                    !isConfigurationComplete ||
                    resolvedConfig.variant.is_available === false
                  }
                  variant="hero"
                  className="gap-2 px-6 rounded-2xl"
                >
                  <ShoppingBag className="size-4" />
                  <span>
                    Mua ngay ·{' '}
                    {resolvedConfig ? vnd(resolvedConfig.unit_price * quantity) : vnd(product.price * quantity)}
                  </span>
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmAction}
                  disabled={
                    calculating ||
                    !resolvedConfig ||
                    !isConfigurationComplete ||
                    resolvedConfig.variant.is_available === false
                  }
                  className="gap-2 px-6 rounded-2xl"
                >
                  <ShoppingBag className="size-4" />
                  <span>Thêm vào giỏ</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
