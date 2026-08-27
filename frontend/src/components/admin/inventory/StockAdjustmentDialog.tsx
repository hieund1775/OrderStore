import React, { useState } from 'react';
import {
  PackagePlus,
  PackageMinus,
  SlidersHorizontal,
  Barcode,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { adjustVariantStock } from '@/lib/api';
import { toast } from 'sonner';

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: {
    variant_id: number;
    sku: string;
    product_name: string;
    name_suffix?: string;
    on_hand: number;
    reserved: number;
  } | null;
  storeId?: number | string;
  onSuccess: () => void;
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  variant,
  storeId,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const [movementType, setMovementType] = useState<'receive' | 'adjust'>('receive');
  const [quantity, setQuantity] = useState<number>(10);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!variant) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || quantity === 0) {
      toast.error('Vui lòng nhập số lượng khác 0');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do biến động tồn kho');
      return;
    }

    setSubmitting(true);
    try {
      await adjustVariantStock({
        store_id: storeId,
        variant_id: variant.variant_id,
        movement_type: movementType,
        quantity: Number(quantity),
        reason: reason.trim(),
      });
      toast.success('Đã cập nhật tồn kho và ghi sổ nhật ký thành công!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật tồn kho');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Nhập Kho / Điều Chỉnh Tồn SKU</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Barcode className="size-4 text-primary" />
              <span className="font-mono font-bold text-sm">{variant.sku}</span>
            </div>
            <p className="font-semibold text-xs">{variant.product_name} {variant.name_suffix && `(${variant.name_suffix})`}</p>
            <div className="flex items-center gap-4 text-xs pt-1">
              <span>Tồn thực tế: <b>{variant.on_hand}</b></span>
              <span>Đang giữ đơn: <b className="text-amber-600">{variant.reserved}</b></span>
              <span>Khả dụng bán: <b className="text-emerald-600">{variant.on_hand - variant.reserved}</b></span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Loại biến động tồn kho *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={movementType === 'receive' ? 'default' : 'outline'}
                className="justify-start text-xs h-9"
                onClick={() => setMovementType('receive')}
              >
                <PackagePlus className="size-3.5 mr-1.5 text-emerald-500" />
                Nhập kho mới (+)
              </Button>
              <Button
                type="button"
                variant={movementType === 'adjust' ? 'default' : 'outline'}
                className="justify-start text-xs h-9"
                onClick={() => setMovementType('adjust')}
              >
                <SlidersHorizontal className="size-3.5 mr-1.5 text-blue-500" />
                Kiểm kê / Bù trừ (±)
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Số lượng {movementType === 'receive' ? 'nhập thêm' : 'điều chỉnh (âm hoặc dương)'} *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              placeholder="VD: 10 hoặc -2"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Lý do điều chỉnh (Ghi vào sổ cái) *</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Nhập hàng từ xưởng may, Hàng lỗi đổi trả, Kiểm kê cuối tuần..."
              required
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Đang lưu sổ...' : 'Lưu biến động'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
