import React, { useState } from 'react';
import {
  Barcode,
  Pencil,
  Check,
  X,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  updateBranchOffer,
} from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type BranchOfferRow = {
  variant_id: number;
  sku: string;
  name_suffix?: string;
  variant_signature: string;
  product_id: number;
  product_name: string;
  product_slug: string;
  base_price: number;
  image_url: string | null;
  stock_mode: 'tracked' | 'made_to_order';
  fulfillment_lane: 'kitchen' | 'packing';
  category_id: number;
  category_name: string;
  offer_id: number | null;
  price: number | null;
  compare_at_price: number | null;
  is_available: boolean;
  version: number | null;
  updated_at: string | null;
  on_hand: number;
  reserved: number;
  available_quantity: number;
};

export const isBranchOfferPriceValid = (val: string) => {
  const trimmed = val.trim();
  if (!trimmed) return false;
  const num = Number(trimmed);
  return Number.isInteger(num) && num >= 1000;
};

interface BranchOfferTableProps {
  offers: BranchOfferRow[];
  storeId?: number | string;
  visibleCategoryIds?: number[];
  search?: string;
  onSearchChange?: (term: string) => void;
  onRefresh: () => void;
}

export function BranchOfferTable({
  offers,
  storeId,
  visibleCategoryIds,
  search: externalSearch,
  onSearchChange: externalOnSearchChange,
  onRefresh,
}: BranchOfferTableProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const isControlledSearch = typeof externalOnSearchChange === 'function';
  const search = isControlledSearch ? (externalSearch ?? '') : internalSearch;
  const [editingPriceVariantId, setEditingPriceVariantId] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [savingPrice, setSavingPrice] = useState(false);

  const handleSearchChange = (val: string) => {
    if (isControlledSearch) {
      externalOnSearchChange(val);
    } else {
      setInternalSearch(val);
    }
  };

  const filtered = offers.filter((o) => {
    if (visibleCategoryIds && !visibleCategoryIds.includes(Number(o.category_id))) return false;
    if (isControlledSearch) return true;
    const term = search.toLowerCase();
    return (
      o.product_name.toLowerCase().includes(term) ||
      o.sku.toLowerCase().includes(term) ||
      o.category_name.toLowerCase().includes(term)
    );
  });

  const handleToggleAvailable = async (offer: BranchOfferRow) => {
    try {
      const currentPrice = offer.price !== null ? offer.price : offer.base_price;
      await updateBranchOffer(offer.variant_id, {
        store_id: storeId,
        price: currentPrice,
        is_available: !offer.is_available,
      });
      toast.success(
        `Đã ${!offer.is_available ? 'bật bán' : 'tắt bán'} SKU ${offer.sku} tại chi nhánh`,
      );
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đổi trạng thái bán');
    }
  };

  const isPriceValid = isBranchOfferPriceValid;

  const handleStartEditPrice = (offer: BranchOfferRow) => {
    setEditingPriceVariantId(offer.variant_id);
    setEditPriceValue(String(offer.price !== null ? offer.price : offer.base_price));
  };

  const handleSavePrice = async (offer: BranchOfferRow) => {
    const trimmed = editPriceValue.trim();
    if (!trimmed) {
      toast.error('Giá bán chi nhánh không được để trống');
      return;
    }
    const numPrice = Number(trimmed);
    if (!Number.isInteger(numPrice) || numPrice < 1000) {
      toast.error('Giá bán chi nhánh phải là số nguyên từ 1.000đ trở lên');
      return;
    }

    setSavingPrice(true);
    try {
      await updateBranchOffer(offer.variant_id, {
        store_id: storeId,
        price: numPrice,
        is_available: offer.is_available,
      });
      toast.success(`Đã cập nhật giá bán SKU ${offer.sku}`);
      setEditingPriceVariantId(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật giá');
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm theo tên sản phẩm, mã SKU, danh mục..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b font-semibold text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Sản phẩm & Biến thể SKU</th>
                <th className="py-3 px-3">Danh mục</th>
                <th className="py-3 px-3">Giá bán chi nhánh</th>
                <th className="py-3 px-3">Khu vực thực hiện</th>
                <th className="py-3 px-3 text-center">Bật bán</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Không tìm thấy SKU phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((offer) => {
                  const isEditingPrice = editingPriceVariantId === offer.variant_id;
                  const displayPrice =
                    offer.price !== null ? offer.price : offer.base_price;

                  return (
                    <tr key={offer.variant_id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground text-sm">
                              {offer.product_name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Barcode className="size-3.5 text-primary shrink-0" />
                              <span className="font-mono font-semibold text-primary">
                                {offer.sku}
                              </span>
                              {offer.name_suffix && (
                                <span className="text-muted-foreground">
                                  · {offer.name_suffix}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-medium">
                          {offer.category_name}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {isEditingPrice ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="1000"
                                step="1000"
                                value={editPriceValue}
                                onChange={(e) => setEditPriceValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSavePrice(offer);
                                  if (e.key === 'Escape') setEditingPriceVariantId(null);
                                }}
                                className={cn(
                                  "h-7 w-24 text-xs font-mono",
                                  !isPriceValid(editPriceValue) && "border-destructive focus-visible:ring-destructive text-destructive"
                                )}
                                autoFocus
                                aria-label="Nhập giá bán chi nhánh"
                              />
                              <Button
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleSavePrice(offer)}
                                disabled={savingPrice || !isPriceValid(editPriceValue)}
                                title={isPriceValid(editPriceValue) ? "Lưu giá" : "Vui lòng nhập giá từ 1.000đ trở lên"}
                                aria-label="Xác nhận lưu giá bán"
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => setEditingPriceVariantId(null)}
                                disabled={savingPrice}
                                title="Hủy"
                                aria-label="Hủy sửa giá"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                            {!isPriceValid(editPriceValue) && (
                              <span className="text-[10px] text-destructive font-medium">
                                {editPriceValue.trim() === '' ? 'Không để trống' : 'Tối thiểu 1.000đ'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground font-mono">
                              {displayPrice.toLocaleString('vi-VN')}₫
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              onClick={() => handleStartEditPrice(offer)}
                              title="Sửa giá bán chi nhánh"
                              aria-label={`Sửa giá bán SKU ${offer.sku}`}
                            >
                              <Pencil className="size-3" />
                            </Button>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {offer.fulfillment_lane === 'packing' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Đóng gói
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Bếp pha chế
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Switch
                          checked={offer.is_available}
                          onCheckedChange={() => handleToggleAvailable(offer)}
                          aria-label={`Bật bán SKU ${offer.sku}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
