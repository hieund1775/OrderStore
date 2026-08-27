import React, { useState } from 'react';
import {
  Sparkles,
  Barcode,
  CheckCircle,
  AlertTriangle,
  Layers,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { previewVariants, createVariant } from '@/lib/api';
import { toast } from 'sonner';

export type GeneratedVariantPreview = {
  sku: string;
  variant_signature: string;
  name_suffix: string;
  attribute_values: {
    attribute_definition_id: number;
    attribute_code: string;
    attribute_name: string;
    attribute_value_id: number;
    value_code: string;
    value_label: string;
  }[];
};

interface VariantGeneratorProps {
  productId: number;
  productSlug: string;
  schemaAttributes: any[];
  existingVariants: any[];
  onSuccess: () => void;
  isSuperAdmin: boolean;
}

export function VariantGenerator({
  productId,
  productSlug,
  schemaAttributes,
  existingVariants,
  onSuccess,
  isSuperAdmin,
}: VariantGeneratorProps) {
  const [previews, setPreviews] = useState<GeneratedVariantPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  const variantAttrs = schemaAttributes.filter((a) => a.role === 'variant');

  const handleGeneratePreview = async () => {
    setLoadingPreview(true);
    try {
      const generated = await previewVariants({
        attributes: schemaAttributes,
        product_slug: productSlug,
      });
      setPreviews(generated);
      toast.success(`Đã tạo bản xem trước ${generated.length} tổ hợp biến thể SKU`);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tạo bản xem trước biến thể');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreateAllVariants = async () => {
    if (previews.length === 0) return;
    setGenerating(true);
    try {
      let createdCount = 0;
      for (const preview of previews) {
        // Skip if already exists
        const exists = existingVariants.some(
          (v) => v.sku === preview.sku || v.variant_signature === preview.variant_signature,
        );
        if (!exists) {
          await createVariant(productId, {
            sku: preview.sku,
            name_suffix: preview.name_suffix,
            status: 'active',
            attribute_values: preview.attribute_values.map((av) => ({
              attribute_definition_id: av.attribute_definition_id,
              attribute_value_id: av.attribute_value_id,
            })),
          });
          createdCount++;
        }
      }
      toast.success(`Đã thêm thành công ${createdCount} biến thể SKU vào sản phẩm!`);
      setPreviews([]);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo biến thể');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h4 className="font-bold text-sm">Bộ Sinh Biến Thể SKU Tự Động (Cartesian Product)</h4>
          </div>
          <p className="text-muted-foreground text-xs mt-0.5">
            Tự động tổ hợp tất cả các giá trị của {variantAttrs.length} thuộc tính Variant (VD: Size × Màu sắc) thành các mã SKU duy nhất.
          </p>
        </div>

        {isSuperAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleGeneratePreview}
            disabled={loadingPreview}
          >
            {loadingPreview ? 'Đang tính toán...' : 'Xem trước tổ hợp SKU'}
          </Button>
        )}
      </div>

      {previews.length > 0 && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary">
              Tìm thấy {previews.length} tổ hợp SKU khả dụng:
            </span>
            {isSuperAdmin && (
              <Button
                size="sm"
                onClick={handleCreateAllVariants}
                disabled={generating}
                className="bg-emerald-600 hover:bg-emerald-700 h-8"
              >
                <CheckCircle className="size-3.5 mr-1" />
                {generating ? 'Đang lưu...' : 'Xác nhận tạo toàn bộ SKU'}
              </Button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-xl border bg-muted/20 p-2">
            {previews.map((p, idx) => {
              const alreadyExists = existingVariants.some(
                (v) => v.sku === p.sku || v.variant_signature === p.variant_signature,
              );
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-lg bg-card p-2 text-xs border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Barcode className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono font-bold text-primary">{p.sku}</span>
                    <span className="text-muted-foreground">({p.name_suffix})</span>
                  </div>

                  <div>
                    {alreadyExists ? (
                      <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-[10px]">
                        Đã tồn tại
                      </span>
                    ) : (
                      <span className="text-emerald-600 bg-emerald-500/10 rounded px-2 py-0.5 text-[10px] font-semibold">
                        Mới
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
