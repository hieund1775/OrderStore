import React, { useState } from 'react';
import {
  Barcode,
  Store,
  Layers,
  Edit2,
  PackagePlus,
  History,
  CheckCircle2,
  XCircle,
  Search,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  updateBranchOffer,
  batchSetBranchAvailability,
} from '@/lib/api';
import { StockAdjustmentDialog } from '../inventory/StockAdjustmentDialog';
import { InventoryLedgerDrawer } from '../inventory/InventoryLedgerDrawer';
import { toast } from 'sonner';

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

interface BranchOfferTableProps {
  offers: BranchOfferRow[];
  storeId?: number | string;
  onRefresh: () => void;
}

export function BranchOfferTable({
  offers,
  storeId,
  onRefresh,
}: BranchOfferTableProps) {
  const [search, setSearch] = useState('');
  const [editingPriceVariantId, setEditingPriceVariantId] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Stock adjustment modal & ledger drawer state
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedVariantForStock, setSelectedVariantForStock] = useState<any | null>(null);
  const [ledgerDrawerOpen, setLedgerDrawerOpen] = useState(false);
  const [selectedVariantForLedger, setSelectedVariantForLedger] = useState<{ id: number; sku: string } | null>(null);

  const filtered = offers.filter((o) => {
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

  const handleStartEditPrice = (offer: BranchOfferRow) => {
    setEditingPriceVariantId(offer.variant_id);
    setEditPriceValue(String(offer.price !== null ? offer.price : offer.base_price));
  };

  const handleSavePrice = async (offer: BranchOfferRow) => {
    const numPrice = Number(editPriceValue);
    if (!Number.isInteger(numPrice) || numPrice < 0) {
      toast.error('Giá bán phải là số nguyên không âm');
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

  const handleOpenStockAdjustment = (offer: BranchOfferRow) => {
    setSelectedVariantForStock({
      variant_id: offer.variant_id,
      sku: offer.sku,
      product_name: offer.product_name,
      name_suffix: offer.name_suffix,
      on_hand: offer.on_hand,
      reserved: offer.reserved,
    });
    setStockModalOpen(true);
  };

  const handleOpenLedger = (offer: BranchOfferRow) => {
    setSelectedVariantForLedger({ id: offer.variant_id, sku: offer.sku });
    setLedgerDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                <th className="py-3 px-3">Tồn kho SKU</th>
                <th className="py-3 px-3 text-center">Bật bán</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Không tìm thấy SKU phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((offer) => {
                  const isEditingPrice = editingPriceVariantId === offer.variant_id;
                  const displayPrice =
                    offer.price !== null ? offer.price : offer.base_price;
                  const isTracked = offer.stock_mode === 'tracked';

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
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="1000"
                              value={editPriceValue}
                              onChange={(e) => setEditPriceValue(e.target.value)}
                              className="h-7 w-24 text-xs"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleSavePrice(offer)}
                              disabled={savingPrice}
                            >
                              <Check className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEditPrice(offer)}
                            className="group flex items-center gap-1 cursor-pointer"
                            title="Click để đổi giá chi nhánh"
                          >
                            <span className="font-bold text-foreground">
                              {displayPrice.toLocaleString('vi-VN')}₫
                            </span>
                            <Edit2 className="size-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {isTracked ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span>Tồn: <b>{offer.on_hand}</b></span>
                              <span className="text-emerald-600 font-semibold">
                                (Bán: {offer.available_quantity})
                              </span>
                            </div>
                            {offer.reserved > 0 && (
                              <span className="text-amber-600 text-[10px]">
                                Đang giữ {offer.reserved} đơn
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">
                            Pha chế theo order
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

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isTracked && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenStockAdjustment(offer)}
                                className="h-7 px-2 text-xs"
                              >
                                <PackagePlus className="size-3.5 mr-1 text-emerald-600" />
                                Nhập / Điều chỉnh
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenLedger(offer)}
                                className="h-7 w-7 p-0"
                                title="Xem sổ cái biến động"
                              >
                                <History className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StockAdjustmentDialog
        open={stockModalOpen}
        onOpenChange={setStockModalOpen}
        variant={selectedVariantForStock}
        storeId={storeId}
        onSuccess={onRefresh}
      />

      <InventoryLedgerDrawer
        open={ledgerDrawerOpen}
        onOpenChange={setLedgerDrawerOpen}
        variantId={selectedVariantForLedger?.id}
        sku={selectedVariantForLedger?.sku}
        storeId={storeId}
      />
    </div>
  );
}
