import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
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
import { toast } from 'sonner';
import {
  createCategoryOptionGroup,
  fetchCategoryOptionAssignments,
  updateCategoryOptionAssignment,
  deleteCategoryOptionAssignment,
  type CategoryOptionAssignment,
} from '@/lib/api';
import type { SchemaDetails, AttributeDefinition } from './SchemaAttributeEditor';
import type { ProductV2 } from './ProductEditor';

interface CatalogOption3BlocksEditorProps {
  categoryId: number;
  categoryName: string;
  schema: SchemaDetails | null;
  categoryProducts: ProductV2[];
  onRefresh: () => Promise<void>;
}

export function CatalogOption3BlocksEditor({
  categoryId,
  categoryName,
  schema,
  categoryProducts,
  onRefresh,
}: CatalogOption3BlocksEditorProps) {
  const [assignments, setAssignments] = useState<CategoryOptionAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog Tạo Nhóm Tùy Chọn (Block 1 hoặc Block 2)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'free' | 'paid'>('free');
  const [groupName, setGroupName] = useState('');
  const [groupValuesStr, setGroupValuesStr] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const generateCode = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  };

  const loadAssignments = async () => {
    if (!categoryId) return;
    try {
      setLoading(true);
      const data = await fetchCategoryOptionAssignments(categoryId);
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải cấu hình tùy chọn của danh mục');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignments();
  }, [categoryId]);

  const rawAttributes = schema?.attributes || [];

  // Phân loại thuộc tính từ Schema thật
  // Preserve the administrator's intended block when all values temporarily
  // cost 0. A Block 2 multi-select group must not move into Block 1 on reload.
  const freeAttributes = rawAttributes.filter((attr) => (
    attr.role === 'modifier' && attr.input_type === 'single_select'
  ));
  const paidAttributes = rawAttributes.filter((attr) => !freeAttributes.includes(attr));

  const isAttrAssigned = (attrId: number) => {
    if (assignments.length === 0) return false;
    const found = assignments.find((a) => Number(a.attribute_definition_id) === Number(attrId));
    return found ? Boolean(found.is_enabled) : false;
  };

  const handleToggleAssignment = async (attr: AttributeDefinition) => {
    const currentlyAssigned = isAttrAssigned(attr.id);
    try {
      if (currentlyAssigned) {
        await deleteCategoryOptionAssignment(categoryId, attr.id);
        toast.success(`Đã tắt nhóm "${attr.name}" cho danh mục ${categoryName}`);
      } else {
        await updateCategoryOptionAssignment(categoryId, {
          attribute_definition_id: attr.id,
          is_enabled: true,
          inherit_to_descendants: true,
          is_required: attr.is_required,
          min_selected: attr.min_selections,
          max_selected: attr.max_selections,
          sort_order: attr.sort_order || 0,
        });
        toast.success(`Đã bật nhóm "${attr.name}" cho danh mục ${categoryName}`);
      }
      await loadAssignments();
    } catch (err: any) {
      toast.error(err.message || `Lỗi cập nhật nhóm "${attr.name}"`);
    }
  };

  const handleOpenCreateModal = (type: 'free' | 'paid') => {
    setModalType(type);
    setGroupName('');
    if (type === 'free') {
      setGroupValuesStr('100% Đá, 70% Đá, 50% Đá, Không Đá');
    } else {
      setGroupValuesStr('Trân châu đen: 5000, Thạch củ năng: 3000, Pudding trứng: 8000');
    }
    setCreateModalOpen(true);
  };

  const handleSaveOptionGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm tùy chọn');
      return;
    }
    if (!schema?.id) {
      toast.error('Chưa có thông tin schema ngành để thêm nhóm tùy chọn');
      return;
    }

    try {
      setModalSaving(true);
      const isFree = modalType === 'free';
      const valuePairs = groupValuesStr.split(',').map((s) => s.trim()).filter(Boolean);
      const values = valuePairs.map((valuePair, index) => {
        let label = valuePair;
        let price = 0;
        if (valuePair.includes(':')) {
          const parts = valuePair.split(':');
          label = parts[0].trim();
          price = Number(parts[1].replace(/[^0-9]/g, '')) || 0;
        }
        return {
          code: generateCode(label || `opt_${index}`),
          label: label || `Lựa chọn ${index + 1}`,
          price_adjustment: isFree ? 0 : price,
          sort_order: index + 1,
          is_active: true,
        };
      });

      await createCategoryOptionGroup(categoryId, {
        schema_id: schema.id,
        code: generateCode(groupName),
        name: groupName.trim(),
        role: 'modifier',
        input_type: isFree ? 'single_select' : 'multi_select',
        is_required: isFree,
        min_selections: isFree ? 1 : 0,
        max_selections: isFree ? 1 : null,
        sort_order: (rawAttributes.length || 0) + 1,
        values,
        is_enabled: true,
        inherit_to_descendants: true,
      });

      toast.success(`Đã tạo nhóm tùy chọn "${groupName}" thành công!`);
      setCreateModalOpen(false);
      await onRefresh();
      await loadAssignments();
    } catch (err: any) {
      toast.error(err.message || `Lỗi khi lưu nhóm tùy chọn "${groupName}"`);
    } finally {
      setModalSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 2 BLOCKS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ======================================================= */}
        {/* BLOCK 1: TÙY CHỌN KHÔNG TIỀN (CHỌN 1 TRONG NHÓM) */}
        {/* ======================================================= */}
        <div className="bg-card rounded-xl border p-4 space-y-3.5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  🧊
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Block 1: Tùy Chọn Không Tiền
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Chọn 1 trong nhóm (+0đ): Đường, Đá...</p>
                </div>
              </div>
            </div>

            {/* List free attributes */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {freeAttributes.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  Chưa có nhóm tùy chọn không tiền nào. Bấm nút bên dưới để tạo mới.
                </div>
              ) : (
                freeAttributes.map((attr) => {
                  const assigned = isAttrAssigned(attr.id);
                  return (
                    <div
                      key={attr.id}
                      className={`p-3 rounded-lg border transition-all ${
                        assigned ? 'bg-background border-primary/40 shadow-xs' : 'bg-muted/30 border-dashed opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                            {attr.name}
                            <span className="text-[10px] text-muted-foreground font-normal">({attr.code})</span>
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {attr.values?.map((v) => (
                              <span
                                key={v.id}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-medium"
                              >
                                {v.label || (v as any).value_label}
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant={assigned ? 'default' : 'outline'}
                          className={`h-7 text-[11px] font-semibold px-2.5 ${
                            assigned ? 'bg-primary text-primary-foreground' : ''
                          }`}
                          onClick={() => void handleToggleAssignment(attr)}
                        >
                          {assigned ? '✓ Đang bật' : '+ Bật áp dụng'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs font-semibold h-8 border-dashed"
            onClick={() => handleOpenCreateModal('free')}
          >
            <Plus className="size-3.5 mr-1" /> Thêm Nhóm Không Tiền (Đá, Đường...)
          </Button>
        </div>

        {/* ======================================================= */}
        {/* BLOCK 2: TÙY CHỌN CÓ TIỀN (CHỌN NHIỀU, TÍNH PHỤ THU) */}
        {/* ======================================================= */}
        <div className="bg-card rounded-xl border p-4 space-y-3.5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  💰
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Block 2: Tùy Chọn Có Tiền
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Chọn nhiều (+tiền): Topping, Size, Thêm...</p>
                </div>
              </div>
            </div>

            {/* List paid attributes */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {paidAttributes.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  Chưa có nhóm tùy chọn có tiền nào. Bấm nút bên dưới để tạo mới.
                </div>
              ) : (
                paidAttributes.map((attr) => {
                  const assigned = isAttrAssigned(attr.id);
                  return (
                    <div
                      key={attr.id}
                      className={`p-3 rounded-lg border transition-all ${
                        assigned ? 'bg-background border-primary/40 shadow-xs' : 'bg-muted/30 border-dashed opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                            {attr.name}
                            <span className="text-[10px] text-muted-foreground font-normal">({attr.code})</span>
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {attr.values?.map((v) => (
                              <span
                                key={v.id}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 font-medium"
                              >
                                {v.label || (v as any).value_label}{' '}
                                {Number(v.price_adjustment || 0) > 0
                                  ? `(+${Number(v.price_adjustment).toLocaleString('vi-VN')}đ)`
                                  : ''}
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant={assigned ? 'default' : 'outline'}
                          className={`h-7 text-[11px] font-semibold px-2.5 ${
                            assigned ? 'bg-primary text-primary-foreground' : ''
                          }`}
                          onClick={() => void handleToggleAssignment(attr)}
                        >
                          {assigned ? '✓ Đang bật' : '+ Bật áp dụng'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs font-semibold h-8 border-dashed"
            onClick={() => handleOpenCreateModal('paid')}
          >
            <Plus className="size-3.5 mr-1" /> Thêm Nhóm Có Tiền (Topping, Size...)
          </Button>
        </div>
      </div>

      {/* MODAL TẠO NHÓM TÙY CHỌN (BLOCK 1 HOẶC BLOCK 2) */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveOptionGroup}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <span>{modalType === 'free' ? '🧊 Tạo Nhóm Tùy Chọn Không Tiền' : '💰 Tạo Nhóm Tùy Chọn Có Tiền'}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-2.5 rounded-lg bg-muted text-xs text-muted-foreground">
                Áp dụng cho danh mục: <b className="text-foreground">{categoryName}</b>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-group-name" className="text-xs font-semibold">
                  Tên nhóm tùy chọn <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="modal-group-name"
                  placeholder={modalType === 'free' ? 'Ví dụ: Mức Đá, Mức Đường, Nhiệt Độ...' : 'Ví dụ: Topping Thêm, Size Nâng Cấp...'}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-group-values" className="text-xs font-semibold">
                  {modalType === 'free'
                    ? 'Danh sách các mức lựa chọn (cách nhau bằng dấu phẩy)'
                    : 'Danh sách món & giá (Tên:Giá, cách nhau bằng dấu phẩy)'}
                </Label>
                <Input
                  id="modal-group-values"
                  placeholder={modalType === 'free' ? '100% Đá, 70% Đá, 50% Đá, Không Đá' : 'Trân châu: 5000, Thạch: 3000, Pudding: 8000'}
                  value={groupValuesStr}
                  onChange={(e) => setGroupValuesStr(e.target.value)}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  {modalType === 'free'
                    ? 'Khách chỉ được chọn 1 mức duy nhất trong nhóm này (VD: 100% Đá).'
                    : 'Khách có thể chọn nhiều món cùng lúc, mỗi món có giá phụ thu riêng.'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)} disabled={modalSaving}>
                Hủy
              </Button>
              <Button type="submit" variant="hero" disabled={modalSaving}>
                {modalSaving ? 'Đang tạo...' : 'Tạo và bật áp dụng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
