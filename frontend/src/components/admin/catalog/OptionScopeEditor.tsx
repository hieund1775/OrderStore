import { useEffect, useMemo, useState } from 'react';
import { Sliders, Loader2, Sparkles, Check, Bookmark } from 'lucide-react';
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

  // Phân chia thành 2 nhóm: Mặc định (Bắt buộc) & Sở thích (Tùy chọn thêm)
  const defaultAttributes = useMemo(() => {
    return schema.attributes.filter(
      (attr) => attr.role === 'variant' || attr.is_required === true,
    );
  }, [schema.attributes]);

  const preferenceAttributes = useMemo(() => {
    return schema.attributes.filter(
      (attr) => attr.role !== 'variant' && attr.is_required !== true,
    );
  }, [schema.attributes]);

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
      toast.success(existing ? `Đã gỡ tùy chọn "${attribute.name}"` : `Đã bật tùy chọn "${attribute.name}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cập nhật phạm vi tùy chọn thất bại');
    } finally {
      setUpdatingId(null);
    }
  }

  const renderAttributeItem = (attribute: SchemaDetails['attributes'][number]) => {
    const enabled = assignmentByAttribute.has(Number(attribute.id));
    const isRequired = attribute.role === 'variant' || attribute.is_required === true;

    return (
      <div
        key={attribute.id}
        className={`p-3 rounded-lg border transition-all ${
          enabled
            ? 'bg-card border-primary/40 shadow-xs'
            : 'bg-muted/30 border-border opacity-70 hover:opacity-100'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground">{attribute.name}</span>
              <Badge
                variant={isRequired ? 'default' : 'secondary'}
                className="text-[9px] px-1.5 py-0 h-4 font-semibold"
              >
                {isRequired ? 'Bắt buộc' : 'Tùy biến'}
              </Badge>
            </div>

            <p className="text-[10px] text-muted-foreground mt-0.5">
              {enabled ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="size-3" /> Đang áp dụng cho danh mục này
                </span>
              ) : (
                'Chưa kích hoạt'
              )}
            </p>
          </div>

          <Switch
            checked={enabled}
            disabled={updatingId === attribute.id}
            onCheckedChange={() => toggleAttribute(attribute)}
            aria-label={`${enabled ? 'Gỡ' : 'Áp dụng'} ${attribute.name}`}
          />
        </div>

        {/* Value chips preview */}
        {attribute.values && attribute.values.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {attribute.values.map((val) => (
              <span
                key={val.id}
                className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-medium"
              >
                {val.value_label}
                {val.price_adjustment && val.price_adjustment > 0
                  ? ` (+${new Intl.NumberFormat('vi-VN').format(val.price_adjustment)}đ)`
                  : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-xs">
          <Loader2 className="size-4 animate-spin text-primary" /> Đang nạp cấu hình tùy chọn…
        </div>
      ) : schema.attributes.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          Chưa có nhóm tùy chọn nào trong ngành này.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Group 1: Tùy chọn Mặc định */}
          {defaultAttributes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Bookmark className="size-3.5 text-primary" />
                <span>1. Tùy chọn Mặc định (Bắt buộc chọn)</span>
              </div>
              <div className="space-y-2">
                {defaultAttributes.map(renderAttributeItem)}
              </div>
            </div>
          )}

          {/* Group 2: Tùy chọn Sở thích */}
          {preferenceAttributes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sparkles className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>2. Tùy chọn Sở thích (Tùy biến thêm)</span>
              </div>
              <div className="space-y-2">
                {preferenceAttributes.map(renderAttributeItem)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
