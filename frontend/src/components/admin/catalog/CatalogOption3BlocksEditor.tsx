import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
  updateCategoryOptionGroup,
  deleteCategoryOptionGroup,
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

interface OptionRowItem {
  id?: number;
  code?: string;
  label: string;
  price: number;
}

export function CatalogOption3BlocksEditor({
  categoryId,
  categoryName,
  schema,
  categoryProducts: _categoryProducts,
  onRefresh,
}: CatalogOption3BlocksEditorProps) {
  const [assignments, setAssignments] = useState<CategoryOptionAssignment[]>([]);
  const [_loading, setLoading] = useState(false);

  // Dialog Tạo / Sửa Nhóm Tùy Chọn
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalType, setModalType] = useState<'free' | 'paid'>('free');
  const [editingAttribute, setEditingAttribute] = useState<AttributeDefinition | null>(null);
  const [groupName, setGroupName] = useState('');
  const [optionsList, setOptionsList] = useState<OptionRowItem[]>([]);
  const [modalSaving, setModalSaving] = useState(false);

  // Dialog Xác Nhận Xóa
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAttribute, setDeletingAttribute] = useState<AttributeDefinition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Phân loại thuộc tính từ Schema
  const freeAttributes = rawAttributes.filter((attr) => (
    attr.role === 'modifier' && attr.input_type === 'single_select'
  ));
  const paidAttributes = rawAttributes.filter((attr) => (
    attr.role === 'modifier' && !freeAttributes.includes(attr)
  ));

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
    setModalMode('create');
    setModalType(type);
    setEditingAttribute(null);
    setGroupName('');
    if (type === 'free') {
      setOptionsList([
        { label: '100% Đá', price: 0 },
        { label: '70% Đá', price: 0 },
        { label: '50% Đá', price: 0 },
        { label: 'Không Đá', price: 0 },
      ]);
    } else {
      setOptionsList([
        { label: 'Trân châu đen', price: 5000 },
        { label: 'Thạch củ năng', price: 3000 },
        { label: 'Pudding trứng', price: 8000 },
      ]);
    }
    setModalOpen(true);
  };

  const handleOpenEditModal = (attr: AttributeDefinition, type: 'free' | 'paid') => {
    setModalMode('edit');
    setModalType(type);
    setEditingAttribute(attr);
    setGroupName(attr.name);
    const existingValues: OptionRowItem[] = (attr.values || []).map((v) => ({
      id: v.id,
      code: v.code,
      label: v.label || (v as any).value_label || '',
      price: Number(v.price_adjustment) || 0,
    }));
    setOptionsList(existingValues.length > 0 ? existingValues : [{ label: '', price: 0 }]);
    setModalOpen(true);
  };

  const handleOpenDeleteDialog = (attr: AttributeDefinition) => {
    setDeletingAttribute(attr);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAttribute) return;
    try {
      setIsDeleting(true);
      await deleteCategoryOptionGroup(categoryId, deletingAttribute.id);
      toast.success(`Đã xóa nhóm tùy chọn "${deletingAttribute.name}"`);
      setDeleteDialogOpen(false);
      setDeletingAttribute(null);
      await onRefresh();
      await loadAssignments();
    } catch (err: any) {
      toast.error(err.message || `Lỗi khi xóa nhóm "${deletingAttribute.name}"`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddOptionRow = () => {
    setOptionsList((prev) => [...prev, { label: '', price: 0 }]);
  };

  const handleRemoveOptionRow = (index: number) => {
    setOptionsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionLabelChange = (index: number, val: string) => {
    setOptionsList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], label: val };
      return next;
    });
  };

  const handleOptionPriceChange = (index: number, val: number) => {
    setOptionsList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], price: Math.max(0, val) };
      return next;
    });
  };

  const handleSaveOptionGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm tùy chọn');
      return;
    }
    const cleanOptions = optionsList.filter((o) => o.label.trim().length > 0);
    if (cleanOptions.length === 0) {
      toast.error('Vui lòng thêm ít nhất một lựa chọn có tên');
      return;
    }
    if (!schema?.id) {
      toast.error('Chưa có thông tin schema ngành để lưu nhóm tùy chọn');
      return;
    }

    try {
      setModalSaving(true);
      const isFree = modalType === 'free';
      const values = cleanOptions.map((opt, index) => {
        const code = opt.code || generateCode(opt.label || `opt_${index}`);
        return {
          id: opt.id,
          code,
          label: opt.label.trim(),
          price_adjustment: isFree ? 0 : Number(opt.price) || 0,
          sort_order: index + 1,
          is_active: true,
        };
      });

      if (modalMode === 'edit' && editingAttribute) {
        await updateCategoryOptionGroup(categoryId, editingAttribute.id, {
          name: groupName.trim(),
          values,
        });
        toast.success(`Đã cập nhật nhóm tùy chọn "${groupName}" thành công!`);
      } else {
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
      }

      setModalOpen(false);
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-foreground flex items-center gap-1.5 truncate">
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

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Chỉnh sửa nhóm"
                            onClick={() => handleOpenEditModal(attr, 'free')}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            title="Xóa nhóm"
                            onClick={() => handleOpenDeleteDialog(attr)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-foreground flex items-center gap-1.5 truncate">
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

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Chỉnh sửa nhóm"
                            onClick={() => handleOpenEditModal(attr, 'paid')}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            title="Xóa nhóm"
                            onClick={() => handleOpenDeleteDialog(attr)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
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

      {/* MODAL TẠO / SỬA NHÓM TÙY CHỌN (BLOCK 1 HOẶC BLOCK 2) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <form onSubmit={handleSaveOptionGroup} className="flex flex-col h-full overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <span>
                  {modalType === 'free'
                    ? modalMode === 'edit'
                      ? '✏️ Sửa Nhóm Tùy Chọn Không Tiền'
                      : '🧊 Tạo Nhóm Tùy Chọn Không Tiền'
                    : modalMode === 'edit'
                    ? '✏️ Sửa Nhóm Tùy Chọn Có Tiền'
                    : '💰 Tạo Nhóm Tùy Chọn Có Tiền'}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 overflow-y-auto pr-1 flex-1">
              <div className="p-2.5 rounded-lg bg-muted text-xs text-muted-foreground">
                Áp dụng cho danh mục: <b className="text-foreground">{categoryName}</b>
              </div>

              {/* Tên nhóm */}
              <div className="space-y-1.5">
                <Label htmlFor="modal-group-name" className="text-xs font-semibold">
                  Tên nhóm tùy chọn <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="modal-group-name"
                  placeholder={
                    modalType === 'free'
                      ? 'Ví dụ: Mức Đá, Mức Đường, Nhiệt Độ...'
                      : 'Ví dụ: Topping Thêm, Size Nâng Cấp...'
                  }
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              {/* Danh sách các lựa chọn động (Repeater) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Danh sách lựa chọn <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {modalType === 'free'
                      ? 'Chọn 1 trong nhóm (+0đ)'
                      : 'Chọn nhiều, mỗi món có giá riêng'}
                  </span>
                </div>

                <div className="border rounded-lg p-2.5 bg-muted/20 space-y-2">
                  {/* Table Header */}
                  <div className="flex items-center gap-2 px-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex-1">Tên lựa chọn</span>
                    {modalType === 'paid' && <span className="w-28 text-right pr-2">Giá tiền (đ)</span>}
                    <span className="w-7 text-center">Xóa</span>
                  </div>

                  {/* Rows */}
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
                    {optionsList.map((opt, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder={modalType === 'free' ? 'VD: 100% Đá, 50% Đá...' : 'VD: Trân châu đen, Thạch...'}
                          value={opt.label}
                          onChange={(e) => handleOptionLabelChange(index, e.target.value)}
                          className="h-8 text-xs flex-1 bg-background"
                          required={index === 0}
                        />
                        {modalType === 'paid' && (
                          <Input
                            type="number"
                            min="0"
                            step="500"
                            placeholder="0"
                            value={opt.price}
                            onChange={(e) => handleOptionPriceChange(index, Number(e.target.value))}
                            className="h-8 text-xs w-28 text-right bg-background"
                          />
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => handleRemoveOptionRow(index)}
                          disabled={optionsList.length <= 1}
                          title="Xóa lựa chọn này"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Nút + Thêm Lựa Chọn */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-semibold h-8 border-dashed mt-2"
                    onClick={handleAddOptionRow}
                  >
                    <Plus className="size-3.5 mr-1" /> Thêm lựa chọn
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={modalSaving}>
                Hủy
              </Button>
              <Button type="submit" variant="hero" disabled={modalSaving}>
                {modalSaving
                  ? 'Đang lưu...'
                  : modalMode === 'edit'
                  ? 'Lưu thay đổi'
                  : 'Tạo và bật áp dụng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG XÁC NHẬN XÓA */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-destructive flex items-center gap-2">
              <Trash2 className="size-4" /> Xác nhận xóa nhóm tùy chọn
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-muted-foreground space-y-2">
            <p>
              Bạn có chắc chắn muốn xóa nhóm tùy chọn{' '}
              <b className="text-foreground">{deletingAttribute?.name}</b> không?
            </p>
            <p className="text-destructive/80">
              Hành động này sẽ gỡ bỏ nhóm tùy chọn cùng toàn bộ các giá trị của nhóm khỏi hệ thống và danh mục.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
