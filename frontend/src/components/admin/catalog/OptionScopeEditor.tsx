import { useEffect, useMemo, useState } from 'react';
import { GitBranch, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  deleteCategoryOptionAssignment,
  fetchCategoryOptionAssignments,
  updateCategoryOptionAssignment,
} from '@/lib/api';
import type { SchemaDetails } from './SchemaAttributeEditor';

type CategoryAssignment = {
  attribute_definition_id: number;
  is_enabled: boolean;
  inherit_to_descendants: boolean;
  sort_order: number;
  is_required: boolean | null;
  min_selected: number | null;
  max_selected: number | null;
};

export function OptionScopeEditor({
  categoryId,
  categoryName,
  schema,
}: {
  categoryId: number;
  categoryName: string;
  schema: SchemaDetails;
}) {
  const [assignments, setAssignments] = useState<CategoryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCategoryOptionAssignments(categoryId)
      .then((rows) => {
        if (active) setAssignments(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : 'Không tải được phạm vi tùy chọn');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [categoryId]);

  const assignmentByAttribute = useMemo(
    () => new Map(assignments.map((item) => [Number(item.attribute_definition_id), item])),
    [assignments],
  );

  async function toggleAttribute(attribute: SchemaDetails['attributes'][number]) {
    if (updatingId) return;
    const existing = assignmentByAttribute.get(Number(attribute.id));
    setUpdatingId(attribute.id);
    try {
      if (existing) {
        await deleteCategoryOptionAssignment(categoryId, attribute.id);
        setAssignments((current) => current.filter(
          (item) => Number(item.attribute_definition_id) !== Number(attribute.id),
        ));
      } else {
        const saved = await updateCategoryOptionAssignment(categoryId, {
          attribute_definition_id: attribute.id,
          is_enabled: true,
          inherit_to_descendants: true,
          sort_order: attribute.sort_order || 0,
          is_required: attribute.is_required,
          min_selected: attribute.min_selections,
          max_selected: attribute.max_selections,
        });
        setAssignments((current) => [...current, saved]);
      }
      toast.success(existing ? `Đã gỡ ${attribute.name}` : `Đã áp dụng ${attribute.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cập nhật phạm vi tùy chọn thất bại');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="bg-primary/10 text-primary rounded-lg p-2">
          <GitBranch className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Áp dụng tùy chọn cho “{categoryName}”</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Tùy chọn được bật tại danh mục gốc sẽ kế thừa xuống các danh mục con. Sản phẩm có thể ghi đè riêng khi cần.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-4 text-xs">
          <Loader2 className="size-4 animate-spin" /> Đang tải…
        </div>
      ) : schema.attributes.length === 0 ? (
        <p className="text-muted-foreground py-4 text-xs">Schema này chưa có tùy chọn nào.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {schema.attributes.map((attribute) => {
            const enabled = assignmentByAttribute.has(Number(attribute.id));
            return (
              <div key={attribute.id} className="bg-muted/40 flex items-center gap-3 rounded-lg px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-semibold">{attribute.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {attribute.role === 'variant' ? 'Biến thể' : 'Tùy chọn'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                    {attribute.values?.length || 0} giá trị · {enabled ? 'Đang kế thừa xuống danh mục con' : 'Chưa áp dụng'}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={updatingId === attribute.id}
                  onCheckedChange={() => toggleAttribute(attribute)}
                  aria-label={`${enabled ? 'Gỡ' : 'Áp dụng'} ${attribute.name}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
