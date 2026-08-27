import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ShoppingCart,
  Trash2,
  Edit2,
  Clock,
  Store,
  ChevronRight,
  CheckSquare,
  Square,
  AlertCircle,
  Barcode,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useCart, type CartItem } from '@/lib/cart';
import { vnd } from '@/lib/data';
import { DynamicProductConfigurator } from '@/components/catalog/DynamicProductConfigurator';

function formatAddedTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Vừa mới thêm';
    if (diffMins < 60) return `Thêm ${diffMins} phút trước`;

    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');

    if (d.toDateString() === now.toDateString()) {
      return `Thêm lúc ${hours}:${mins} hôm nay`;
    }
    return `Thêm ${hours}:${mins} ngày ${day}/${month}`;
  } catch {
    return '';
  }
}

export function SmartCartDrawer({ children }: { children?: React.ReactNode }) {
  const {
    items,
    groups,
    count,
    subtotal,
    selectedItems,
    selectedCount,
    selectedSubtotal,
    allSelected,
    setQty,
    removeItem,
    updateItem,
    toggleSelect,
    toggleSelectStore,
    toggleSelectAll,
  } = useCart();

  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  const handleEditClick = (item: CartItem) => {
    setEditingItem(item);
  };

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
      size: configured.appliedModifiers?.find((m: any) => m.attribute_code === 'size')?.value_code?.toUpperCase() || editingItem.size,
      base: configured.appliedModifiers?.find((m: any) => m.attribute_code === 'base')?.value_label || editingItem.base,
      sugar: configured.appliedModifiers?.find((m: any) => m.attribute_code === 'sugar')?.value_label || editingItem.sugar,
      ice: configured.appliedModifiers?.find((m: any) => m.attribute_code === 'ice')?.value_label || editingItem.ice,
      toppings: configured.appliedModifiers
        ?.filter((m: any) => m.attribute_code === 'toppings')
        .map((m: any) => m.value_code) || editingItem.toppings,
      appliedModifiers: configured.appliedModifiers || [],
      unitPrice: configured.unitPrice,
      qty: configured.quantity,
      selected: editingItem.selected,
      note: editingItem.note,
    });

    setEditingItem(null);
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          {children || (
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="size-5" />
              {count > 0 && (
                <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold shadow-sm">
                  {count}
                </span>
              )}
            </Button>
          )}
        </SheetTrigger>

        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          {/* Header */}
          <SheetHeader className="border-b px-5 py-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-display flex items-center gap-2 text-lg">
                <ShoppingCart className="size-5 text-primary" />
                <span>Giỏ Hàng ({count} món)</span>
              </SheetTitle>
              {items.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                  />
                  <span>Chọn tất cả</span>
                </label>
              )}
            </div>
          </SheetHeader>

          {/* Cart Groups / Sections */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                  <ShoppingCart className="size-8" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Giỏ hàng của bạn đang trống.
                </p>
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/menu">Khám phá Thực Đơn</Link>
                </Button>
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.storeId}
                  className="rounded-2xl border bg-card shadow-sm overflow-hidden"
                >
                  {/* Branch Group Header */}
                  <div className="flex items-center justify-between border-b bg-muted/40 px-3.5 py-2.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                      <Checkbox
                        checked={group.allSelected}
                        onCheckedChange={(checked) =>
                          toggleSelectStore(group.storeId, Boolean(checked))
                        }
                      />
                      <Store className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">{group.storeName}</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {group.items.length} món
                    </span>
                  </div>

                  {/* Group Items */}
                  <div className="divide-y p-1">
                    {group.items.map((item) => {
                      const isSelected = item.selected !== false;
                      const hasModifiers =
                        item.appliedModifiers && item.appliedModifiers.length > 0;

                      return (
                        <div
                          key={item.key}
                          className={`flex gap-3 p-3 transition-colors rounded-xl ${
                            isSelected ? 'bg-background' : 'opacity-70 bg-muted/20'
                          }`}
                        >
                          <div className="flex items-center pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleSelect(item.key, Boolean(checked))
                              }
                            />
                          </div>

                          <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            className="size-16 rounded-xl object-cover border shrink-0"
                          />

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <p className="truncate text-xs sm:text-sm font-bold text-foreground">
                                {item.name}
                              </p>
                              <button
                                onClick={() => handleEditClick(item)}
                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors shrink-0"
                                title="Chỉnh sửa size, đường, đá, topping..."
                              >
                                <Edit2 className="size-3" />
                                <span>Sửa</span>
                              </button>
                            </div>

                            {/* SKU / Variant indicator */}
                            {item.sku && item.sku !== 'default' && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                                <Barcode className="size-3 text-primary" />
                                <span>{item.sku}</span>
                                {item.variantName && <span>({item.variantName})</span>}
                              </div>
                            )}

                            {/* Modifiers Display */}
                            {hasModifiers ? (
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {item.appliedModifiers
                                  ?.map(
                                    (m) =>
                                      `${m.value_label}${
                                        m.price_adjustment > 0
                                          ? ` (+${vnd(m.price_adjustment)})`
                                          : ''
                                      }`,
                                  )
                                  .join(' · ')}
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">
                                {item.size} · {item.sugar} đường · {item.ice} đá
                                {item.toppings && item.toppings.length > 0 && (
                                  <span> · +{item.toppings.join(', ')}</span>
                                )}
                              </p>
                            )}

                            {/* Added time tag */}
                            {item.addedAt && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 pt-0.5">
                                <Clock className="size-2.5" />
                                <span>{formatAddedTime(item.addedAt)}</span>
                              </div>
                            )}

                            {/* Price & Quantity */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1 rounded-full border bg-muted/30 px-1 py-0.5">
                                <button
                                  className="size-5 grid place-items-center rounded-full hover:bg-muted text-xs"
                                  onClick={() => setQty(item.key, item.qty - 1)}
                                >
                                  −
                                </button>
                                <span className="w-5 text-center text-xs font-mono font-bold">
                                  {item.qty}
                                </span>
                                <button
                                  className="size-5 grid place-items-center rounded-full hover:bg-muted text-xs"
                                  onClick={() => setQty(item.key, item.qty + 1)}
                                >
                                  +
                                </button>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-display text-xs sm:text-sm font-bold text-primary">
                                  {vnd(item.unitPrice * item.qty)}
                                </span>
                                <button
                                  onClick={() => removeItem(item.key)}
                                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                  aria-label="Xóa món"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout Bar */}
          {items.length > 0 && (
            <div className="space-y-3 border-t bg-card p-4 shadow-lg">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">
                  Đã chọn: <b className="text-foreground">{selectedCount}</b> / {count} món
                </span>
                <div className="text-right">
                  <span className="text-muted-foreground text-xs mr-2">Tổng thanh toán</span>
                  <span className="font-display text-base sm:text-lg font-bold text-primary">
                    {vnd(selectedSubtotal)}
                  </span>
                </div>
              </div>

              <Button
                asChild
                variant="hero"
                className="w-full h-11 rounded-xl font-bold shadow-glow"
                disabled={selectedCount === 0}
              >
                <Link to="/thanh-toan">
                  <span>Mua Hàng ({selectedCount})</span>
                  <ChevronRight className="size-4 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Configurator Modal */}
      {editingItem && (
        <DynamicProductConfigurator
          open={Boolean(editingItem)}
          onOpenChange={(open) => !open && setEditingItem(null)}
          productSlug={editingItem.productSlug || editingItem.productId}
          storeId={editingItem.storeId}
          onAddToCart={handleSaveEdit}
        />
      )}
    </>
  );
}
