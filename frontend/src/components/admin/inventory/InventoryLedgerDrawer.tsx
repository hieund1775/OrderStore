import React, { useState, useEffect } from 'react';
import {
  History,
  Barcode,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { fetchInventoryMovements } from '@/lib/api';
import { fmtDateTime } from '@/lib/data';
import { toast } from 'sonner';

interface InventoryLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId?: number | null;
  sku?: string;
  storeId?: number | string;
}

export function InventoryLedgerDrawer({
  open,
  onOpenChange,
  variantId,
  sku,
  storeId,
}: InventoryLedgerDrawerProps) {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMovements = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const rows = await fetchInventoryMovements({
        store_id: storeId,
        variant_id: variantId || undefined,
        limit: 50,
      });
      setMovements(rows);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải lịch sử biến động tồn kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadMovements();
    }
  }, [open, variantId, storeId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              <span>Sổ Cái Biến Động Tồn Kho (Audit Ledger)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={loadMovements} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </SheetTitle>
        </SheetHeader>

        {sku && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-xs">
            <Barcode className="size-4 text-primary" />
            <span>Mã SKU:</span>
            <span className="font-mono font-bold text-primary">{sku}</span>
          </div>
        )}

        <div className="space-y-3 py-4">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Đang tải lịch sử...</div>
          ) : movements.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Chưa có giao dịch biến động tồn kho nào.</div>
          ) : (
            movements.map((m) => {
              const isPositive = m.quantity > 0;
              return (
                <div
                  key={m.id}
                  className="rounded-2xl border bg-card p-3 text-xs space-y-1.5 transition-all hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {m.movement_type.toUpperCase()} ({isPositive ? `+${m.quantity}` : m.quantity})
                      </span>

                      <span className="font-mono font-bold text-foreground">
                        {m.sku}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{fmtDateTime(m.created_at)}</span>
                    </div>
                  </div>

                  <p className="text-foreground font-medium text-xs">
                    Lý do: <span className="text-muted-foreground">{m.reason || '(Không ghi chú)'}</span>
                  </p>

                  <div className="flex items-center justify-between border-t pt-1.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span>Tồn: {m.before_on_hand} ➔ <b>{m.after_on_hand}</b></span>
                      {m.before_reserved !== m.after_reserved && (
                        <span>Giữ đơn: {m.before_reserved} ➔ <b>{m.after_reserved}</b></span>
                      )}
                    </div>

                    {m.created_by_name && (
                      <div className="flex items-center gap-1">
                        <User className="size-3" />
                        <span>{m.created_by_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
