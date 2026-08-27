import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Minus, ShoppingBag, Store, AlertCircle } from 'lucide-react';
import { fetchPublicProductDetails, resolveProductConfiguration } from '@/lib/api';
import { vnd } from '@/lib/data';
import { toast } from 'sonner';

export interface DynamicProductConfiguratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productSlug: string;
  storeId?: number | string;
  onAddToCart: (configuredItem: {
    productId: number;
    productName: string;
    productSlug: string;
    variantId: number | null;
    sku: string;
    variantName?: string | null;
    quantity: number;
    unitPrice: number;
    appliedModifiers: any[];
    image?: string;
  }) => void;
}

export function DynamicProductConfigurator({
  open,
  onOpenChange,
  productSlug,
  storeId,
  onAddToCart,
}: DynamicProductConfiguratorProps) {
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any | null>(null);
  const [selectedVariantValueIds, setSelectedVariantValueIds] = useState<number[]>([]);
  const [selectedModifierValueIds, setSelectedModifierValueIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [resolvedConfig, setResolvedConfig] = useState<any | null>(null);
  const [calculating, setCalculating] = useState(false);

  // 1. Fetch Product details with Schema & Variants
  useEffect(() => {
    if (!open || !productSlug) return;
    let isMounted = true;
    setLoading(true);

    fetchPublicProductDetails(productSlug, storeId)
      .then((data) => {
        if (!isMounted) return;
        setProduct(data);
        setQuantity(1);

        // Pre-select first values for required single_select attributes
        const initialVarValIds: number[] = [];
        const initialModValIds: number[] = [];

        (data.attributes || []).forEach((attr: any) => {
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
      })
      .catch((err) => {
        toast.error('Không thể tải thông tin tùy chọn món');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, productSlug, storeId]);

  // 2. Resolve Price & Configuration whenever selections change
  useEffect(() => {
    if (!product || !open) return;
    let isMounted = true;
    setCalculating(true);

    resolveProductConfiguration({
      store_id: storeId,
      product_slug: product.slug,
      variant_value_ids: selectedVariantValueIds,
      modifier_value_ids: selectedModifierValueIds,
    })
      .then((res) => {
        if (isMounted) setResolvedConfig(res);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setCalculating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [product, selectedVariantValueIds, selectedModifierValueIds, storeId, open]);

  if (!open) return null;

  const handleSelectSingle = (role: 'variant' | 'modifier', attr: any, valId: number) => {
    const existingValIds = attr.values.map((v: any) => v.id);
    if (role === 'variant') {
      const filtered = selectedVariantValueIds.filter((id) => !existingValIds.includes(id));
      setSelectedVariantValueIds([...filtered, valId]);
    } else {
      const filtered = selectedModifierValueIds.filter((id) => !existingValIds.includes(id));
      setSelectedModifierValueIds([...filtered, valId]);
    }
  };

  const handleToggleMulti = (valId: number) => {
    if (selectedModifierValueIds.includes(valId)) {
      setSelectedModifierValueIds(selectedModifierValueIds.filter((id) => id !== valId));
    } else {
      setSelectedModifierValueIds([...selectedModifierValueIds, valId]);
    }
  };

  const handleConfirmAddToCart = () => {
    if (!resolvedConfig) return;
    if (resolvedConfig.is_available === false) {
      toast.error('Biến thể món này hiện đang tạm hết tại chi nhánh');
      return;
    }
    if (
      resolvedConfig.stock_mode === 'tracked' &&
      resolvedConfig.available_stock !== null &&
      resolvedConfig.available_stock < quantity
    ) {
      toast.error(`Chỉ còn ${resolvedConfig.available_stock} sản phẩm khả dụng trong kho`);
      return;
    }

    onAddToCart({
      productId: resolvedConfig.product_id,
      productName: resolvedConfig.product_name,
      productSlug: resolvedConfig.product_slug,
      variantId: resolvedConfig.variant_id,
      sku: resolvedConfig.sku,
      variantName: resolvedConfig.variant_name,
      quantity,
      unitPrice: resolvedConfig.unit_price,
      appliedModifiers: resolvedConfig.applied_modifiers,
      image: product?.image_url,
    });

    toast.success(`Đã thêm ${quantity}x ${resolvedConfig.product_name} vào giỏ hàng`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-0">
        {loading || !product ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Đang tải tùy chọn...</div>
        ) : (
          <div>
            {/* Header with image */}
            <div className="relative border-b bg-muted/20 p-5">
              <div className="flex gap-4">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="size-20 shrink-0 rounded-2xl object-cover border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="text-[10px] mb-1 font-mono">
                    {product.category_name}
                  </Badge>
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
              {(product.attributes || []).map((attr: any) => {
                const isVariant = attr.role === 'variant';
                const isMulti = attr.input_type === 'multi_select';

                return (
                  <div key={attr.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground">
                        {attr.name} {attr.is_required && <span className="text-destructive">*</span>}
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        {isMulti ? 'Chọn nhiều' : 'Chọn 1'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(attr.values || []).map((val: any) => {
                        const isSelected = isVariant
                          ? selectedVariantValueIds.includes(val.id)
                          : selectedModifierValueIds.includes(val.id);

                        return (
                          <button
                            key={val.id}
                            type="button"
                            onClick={() =>
                              isMulti
                                ? handleToggleMulti(val.id)
                                : handleSelectSingle(attr.role, attr, val.id)
                            }
                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                              isSelected
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

              {resolvedConfig?.is_available === false && (
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

              <Button
                onClick={handleConfirmAddToCart}
                disabled={calculating || resolvedConfig?.is_available === false}
                className="gap-2 px-6 rounded-2xl"
              >
                <ShoppingBag className="size-4" />
                <span>Thêm vào giỏ</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
