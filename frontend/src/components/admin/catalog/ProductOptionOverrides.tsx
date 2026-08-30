import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  deleteProductOptionOverride,
  fetchProductOptionOverrides,
  updateProductOptionOverride,
} from '@/lib/api';
import type { SchemaDetails } from './SchemaAttributeEditor';

type ProductOverride = {
  attribute_definition_id: number;
  is_enabled: boolean;
};

export function ProductOptionOverrides({
  productId,
  schema,
  editable,
}: {
  productId: number;
  schema: SchemaDetails;
  editable: boolean;
}) {
  const [overrides, setOverrides] = useState<ProductOverride[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load() {
    try {
      const rows = await fetchProductOptionOverrides(productId);
      setOverrides(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được ghi đè tùy chọn');
    }
  }

  useEffect(() => {
    void load();
  }, [productId]);

  const byAttribute = useMemo(
    () => new Map(overrides.map((item) => [Number(item.attribute_definition_id), item])),
    [overrides],
  );

  async function setMode(attribute: SchemaDetails['attributes'][number], mode: 'inherit' | 'on' | 'off') {
    if (!editable || updatingId) return;
    setUpdatingId(attribute.id);
    try {
      if (mode === 'inherit') {
        await deleteProductOptionOverride(productId, attribute.id);
      } else {
        await updateProductOptionOverride(productId, {
          attribute_definition_id: attribute.id,
          is_enabled: mode === 'on',
          sort_order: attribute.sort_order || 0,
          is_required: attribute.is_required,
          min_selected: attribute.min_selections,
          max_selected: attribute.max_selections,
        });
      }
      await load();
      toast.success(`Đã cập nhật ${attribute.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cập nhật ghi đè thất bại');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="text-primary size-4" />
        <div>
          <h4 className="text-sm font-bold">Tùy chọn riêng của sản phẩm</h4>
          <p className="text-muted-foreground text-[11px]">Mặc định kế thừa từ cây danh mục; chỉ ghi đè khi sản phẩm này khác biệt.</p>
        </div>
      </div>
      <div className="space-y-2">
        {schema.attributes.map((attribute) => {
          const override = byAttribute.get(Number(attribute.id));
          const mode = !override ? 'inherit' : override.is_enabled ? 'on' : 'off';
          return (
            <div key={attribute.id} className="bg-background flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
              <span className="min-w-[120px] flex-1 text-xs font-semibold">{attribute.name}</span>
              {(['inherit', 'on', 'off'] as const).map((candidate) => (
                <Button
                  key={candidate}
                  type="button"
                  size="sm"
                  variant={mode === candidate ? 'default' : 'outline'}
                  className="h-7 px-2 text-[11px]"
                  disabled={!editable || updatingId === attribute.id}
                  onClick={() => setMode(attribute, candidate)}
                >
                  {candidate === 'inherit' ? 'Kế thừa' : candidate === 'on' ? 'Bật' : 'Tắt'}
                </Button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
