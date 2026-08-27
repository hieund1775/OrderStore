import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  CheckCircle,
  Tag,
  ShieldAlert,
  ArrowRight,
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
import { addAttributeToSchema, addAttributeValue, publishSchema } from '@/lib/api';
import { toast } from 'sonner';

export type AttributeValue = {
  id: number;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  price_adjustment: number;
};

export type AttributeDef = {
  id: number;
  code: string;
  name: string;
  role: 'variant' | 'modifier';
  input_type: 'single_select' | 'multi_select' | 'text' | 'number';
  is_required: boolean;
  is_filterable: boolean;
  sort_order: number;
  min_selections: number;
  max_selections: number | null;
  values: AttributeValue[];
};

export type SchemaDetails = {
  id: number;
  product_type_id: number;
  product_type_code: string;
  product_type_name: string;
  version: number;
  status: 'draft' | 'published' | 'retired';
  attributes: AttributeDef[];
};

interface SchemaAttributeEditorProps {
  schema: SchemaDetails;
  onRefresh: () => void;
  isSuperAdmin: boolean;
}

export function SchemaAttributeEditor({
  schema,
  onRefresh,
  isSuperAdmin,
}: SchemaAttributeEditorProps) {
  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const [valModalOpen, setValModalOpen] = useState(false);
  const [selectedAttrId, setSelectedAttrId] = useState<number | null>(null);

  const [attrForm, setAttrForm] = useState({
    code: '',
    name: '',
    role: 'variant' as 'variant' | 'modifier',
    input_type: 'single_select' as 'single_select' | 'multi_select' | 'text' | 'number',
    is_required: false,
    is_filterable: true,
  });

  const [valForm, setValForm] = useState({
    code: '',
    label: '',
    price_adjustment: 0,
  });

  const [submitting, setSubmitting] = useState(false);

  const isImmutable = schema.status === 'published' || schema.status === 'retired';

  const handlePublish = async () => {
    if (!confirm('Sau khi xuất bản (Publish), schema này sẽ bất biến và không thể xóa/sửa trực tiếp thuộc tính. Bạn có chắc muốn xuất bản?')) {
      return;
    }

    try {
      await publishSchema(schema.id);
      toast.success('Đã xuất bản schema thành công!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xuất bản schema');
    }
  };

  const handleAddAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attrForm.code.trim() || !attrForm.name.trim()) {
      toast.error('Vui lòng nhập mã và tên thuộc tính');
      return;
    }

    setSubmitting(true);
    try {
      await addAttributeToSchema(schema.id, {
        code: attrForm.code.trim().toLowerCase(),
        name: attrForm.name.trim(),
        role: attrForm.role,
        input_type: attrForm.input_type,
        is_required: attrForm.is_required,
        is_filterable: attrForm.is_filterable,
      });
      toast.success('Đã thêm thuộc tính vào schema');
      setAttrModalOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thêm thuộc tính');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttrId || !valForm.code.trim() || !valForm.label.trim()) {
      toast.error('Vui lòng nhập mã và nhãn giá trị');
      return;
    }

    setSubmitting(true);
    try {
      await addAttributeValue(selectedAttrId, {
        code: valForm.code.trim().toLowerCase(),
        label: valForm.label.trim(),
        price_adjustment: Number(valForm.price_adjustment) || 0,
      });
      toast.success('Đã thêm giá trị thuộc tính');
      setValModalOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thêm giá trị');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-display font-bold text-base">
              Schema: {schema.product_type_name} (v{schema.version})
            </h4>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                schema.status === 'published'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : schema.status === 'draft'
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {schema.status === 'published' ? 'Đã xuất bản (Bất biến)' : schema.status === 'draft' ? 'Bản nháp (Đang sửa)' : 'Đã lưu trữ'}
            </span>
          </div>
          <p className="text-muted-foreground text-xs mt-1">
            Định nghĩa thuộc tính SKU (Variant) và tùy chọn đơn hàng (Modifier) cho ngành hàng này.
          </p>
        </div>

        {isSuperAdmin && schema.status === 'draft' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAttrModalOpen(true)}>
              <Plus className="size-4 mr-1" /> Thêm thuộc tính
            </Button>
            <Button size="sm" onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="size-4 mr-1.5" /> Xuất bản Schema
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {schema.attributes.map((attr) => (
          <div key={attr.id} className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{attr.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">({attr.code})</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      attr.role === 'variant'
                        ? 'bg-indigo-500/10 text-indigo-600'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {attr.role === 'variant' ? 'Tạo SKU Biến thể' : 'Modifier (Tùy chọn)'}
                  </span>
                  <span className="text-muted-foreground text-[11px] font-mono">
                    {attr.input_type}
                  </span>
                  {attr.is_required && (
                    <span className="text-destructive text-[11px] font-semibold">* Bắt buộc</span>
                  )}
                </div>
              </div>

              {!isImmutable && isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedAttrId(attr.id);
                    setValForm({ code: '', label: '', price_adjustment: 0 });
                    setValModalOpen(true);
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <Plus className="size-3.5 mr-1" /> Thêm giá trị
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium">Danh sách giá trị tùy chọn:</p>
              <div className="flex flex-wrap gap-1.5">
                {attr.values.length === 0 ? (
                  <span className="text-muted-foreground text-xs italic">Chưa có giá trị nào.</span>
                ) : (
                  attr.values.map((val) => (
                    <span
                      key={val.id}
                      className="bg-muted inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                    >
                      <Tag className="size-3 text-muted-foreground" />
                      <span className="font-medium">{val.label}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">({val.code})</span>
                      {val.price_adjustment > 0 && (
                        <span className="text-primary font-semibold text-[11px]">
                          +{val.price_adjustment.toLocaleString('vi-VN')}₫
                        </span>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Thêm Thuộc Tính */}
      <Dialog open={attrModalOpen} onOpenChange={setAttrModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Thêm Thuộc Tính Mới</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddAttribute} className="space-y-4">
            <div className="space-y-2">
              <Label>Tên thuộc tính *</Label>
              <Input
                value={attrForm.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setAttrForm((prev) => ({
                    ...prev,
                    name: val,
                    code: prev.code || val.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                  }));
                }}
                placeholder="VD: Kích cỡ, Màu sắc, Độ ngọt, Topping..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Mã thuộc tính (Code snake_case) *</Label>
              <Input
                value={attrForm.code}
                onChange={(e) => setAttrForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="VD: size, color, sugar_level"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Vai trò thuộc tính (Role) *</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={attrForm.role}
                onChange={(e) => {
                  const role = e.target.value as 'variant' | 'modifier';
                  setAttrForm((prev) => ({
                    ...prev,
                    role,
                    input_type: role === 'variant' ? 'single_select' : prev.input_type,
                  }));
                }}
              >
                <option value="variant">Biến thể SKU (Variant - Size, Màu sắc tạo mã hàng riêng)</option>
                <option value="modifier">Tùy biến món (Modifier - Đường, Đá, Topping pha chế theo yêu cầu)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Kiểu nhập liệu</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={attrForm.input_type}
                disabled={attrForm.role === 'variant'}
                onChange={(e) => setAttrForm((prev) => ({ ...prev, input_type: e.target.value as any }))}
              >
                <option value="single_select">Chọn 1 (Single Select)</option>
                <option value="multi_select">Chọn nhiều (Multi Select)</option>
                <option value="text">Nhập văn bản tự do (Text)</option>
                <option value="number">Nhập số (Number)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_required"
                checked={attrForm.is_required}
                onChange={(e) => setAttrForm((prev) => ({ ...prev, is_required: e.target.checked }))}
              />
              <Label htmlFor="is_required">Bắt buộc khách hàng/nhân viên phải chọn khi đặt</Label>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAttrModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang thêm...' : 'Thêm thuộc tính'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Thêm Giá Trị */}
      <Dialog open={valModalOpen} onOpenChange={setValModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Thêm Giá Trị Tùy Chọn</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddValue} className="space-y-4">
            <div className="space-y-2">
              <Label>Nhãn hiển thị *</Label>
              <Input
                value={valForm.label}
                onChange={(e) => {
                  const val = e.target.value;
                  setValForm((prev) => ({
                    ...prev,
                    label: val,
                    code: prev.code || val.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                  }));
                }}
                placeholder="VD: Size L, Đỏ Ruby, 50% Đường, Trân châu trắng..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Mã giá trị (Code) *</Label>
              <Input
                value={valForm.code}
                onChange={(e) => setValForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="VD: size_l, red, sugar_50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Phụ thu giá cộng thêm (VNĐ)</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={valForm.price_adjustment}
                onChange={(e) => setValForm((prev) => ({ ...prev, price_adjustment: Number(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setValModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang thêm...' : 'Thêm giá trị'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
