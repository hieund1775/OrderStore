import React, { useState, useEffect } from 'react';
import {
  Plus,
  Settings2,
  Trash2,
  Lock,
  Layers,
  Sparkles,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  addAttributeToSchema,
  addAttributeValue,
  fetchCategoryOptionAssignments,
  updateCategoryOptionAssignment,
  deleteCategoryOptionAssignment,
  fetchCatalogPresets,
  saveCatalogPreset,
  deleteCatalogPreset,
  type CategoryOptionAssignment,
  type CatalogOptionPreset,
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

  // State Cấu Hình Block 3 (Preset cho Danh Mục Con hoặc Sản Phẩm Riêng)
  const [presetTargetType, setPresetTargetType] = useState<'category' | 'product'>('category');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedFreeDefaults, setSelectedFreeDefaults] = useState<Record<string, string>>({});
  const [selectedPaidDefaults, setSelectedPaidDefaults] = useState<string[]>([]);
  const [lockedByAttr, setLockedByAttr] = useState<Record<number, boolean>>({});
  const [categoryPresets, setCategoryPresets] = useState<CatalogOptionPreset[]>([]);
  const [productPresets, setProductPresets] = useState<CatalogOptionPreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);

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

  const loadPresets = async () => {
    if (!categoryId) return;
    try {
      // 1. Load category presets
      const catPresets = await fetchCatalogPresets('category', categoryId);
      setCategoryPresets(Array.isArray(catPresets) ? catPresets : []);

      // 2. Load product presets for each product in this category
      if (categoryProducts && categoryProducts.length > 0) {
        const allProdPresets: CatalogOptionPreset[] = [];
        for (const prod of categoryProducts) {
          const presets = await fetchCatalogPresets('product', prod.id);
          if (Array.isArray(presets)) {
            allProdPresets.push(...presets);
          }
        }
        setProductPresets(allProdPresets);
      } else {
        setProductPresets([]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadAssignments();
    void loadPresets();
  }, [categoryId, categoryProducts]);

  const rawAttributes = schema?.attributes || [];

  // Phân loại thuộc tính từ Schema thật
  const freeAttributes = rawAttributes.filter((attr) => {
    const hasPaidValues = attr.values?.some((v) => Number(v.price_adjustment || 0) > 0);
    return !hasPaidValues;
  });

  const paidAttributes = rawAttributes.filter((attr) => {
    const hasPaidValues = attr.values?.some((v) => Number(v.price_adjustment || 0) > 0);
    return hasPaidValues || attr.role === 'variant';
  });

  // Khi thay đổi target (category hoặc product cụ thể), load lại form defaults
  useEffect(() => {
    const activePresets =
      presetTargetType === 'category'
        ? categoryPresets
        : selectedProductId
          ? productPresets.filter((p) => Number(p.target_id) === Number(selectedProductId))
          : [];

    const freeDefs: Record<string, string> = {};
    const paidDefs: string[] = [];
    const locks: Record<number, boolean> = {};

    for (const preset of activePresets) {
      locks[Number(preset.attribute_definition_id)] = Boolean(preset.is_locked);
      const attr = rawAttributes.find((a) => Number(a.id) === Number(preset.attribute_definition_id));
      if (!attr) continue;

      for (const valId of preset.attribute_value_ids || []) {
        const val = attr.values?.find((v) => Number(v.id) === Number(valId));
        if (val) {
          const valLabel = val.label || (val as any).value_label;
          const isFree = !attr.values?.some((v) => Number(v.price_adjustment || 0) > 0);
          if (isFree) {
            freeDefs[attr.name] = valLabel;
          } else {
            paidDefs.push(valLabel);
          }
        }
      }
    }
    setSelectedFreeDefaults(freeDefs);
    setSelectedPaidDefaults(paidDefs);
    setLockedByAttr(locks);
  }, [presetTargetType, selectedProductId, categoryPresets, productPresets, rawAttributes]);

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
      const code = generateCode(groupName);
      const isFree = modalType === 'free';

      // 1. Thêm thuộc tính vào Schema
      const createdAttr = await addAttributeToSchema(schema.id, {
        code,
        name: groupName.trim(),
        role: 'modifier',
        input_type: isFree ? 'single_select' : 'multi_select',
        is_required: isFree,
        min_selections: isFree ? 1 : 0,
        max_selections: isFree ? 1 : null,
        sort_order: (rawAttributes.length || 0) + 1,
      });

      // 2. Thêm danh sách giá trị
      const valuePairs = groupValuesStr.split(',').map((s) => s.trim()).filter(Boolean);
      for (let i = 0; i < valuePairs.length; i++) {
        let label = valuePairs[i];
        let price = 0;
        if (valuePairs[i].includes(':')) {
          const parts = valuePairs[i].split(':');
          label = parts[0].trim();
          price = Number(parts[1].replace(/[^0-9]/g, '')) || 0;
        }
        const valCode = generateCode(label || `opt_${i}`);
        await addAttributeValue(createdAttr.id, {
          code: valCode,
          label: label || `Lựa chọn ${i + 1}`,
          price_adjustment: isFree ? 0 : price,
          sort_order: i + 1,
          is_active: true,
        });
      }

      // 3. Tự động bật gán cho danh mục này
      await updateCategoryOptionAssignment(categoryId, {
        attribute_definition_id: createdAttr.id,
        is_enabled: true,
        inherit_to_descendants: true,
        is_required: isFree,
        min_selected: isFree ? 1 : 0,
        max_selected: isFree ? 1 : null,
        sort_order: 1,
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

  // Block 3: Lưu snapshot cấu hình mặc định (ghi đè hoàn toàn & xóa nhóm bỏ chọn)
  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetType = presetTargetType;
    const targetId = targetType === 'category' ? categoryId : Number(selectedProductId);

    if (targetType === 'product' && !selectedProductId) {
      toast.error('Vui lòng chọn sản phẩm cần áp dụng');
      return;
    }

    const targetLabel =
      targetType === 'category'
        ? `danh mục "${categoryName}"`
        : `món "${categoryProducts.find((p) => String(p.id) === selectedProductId)?.name || selectedProductId}"`;

    try {
      setSavingPreset(true);

      // 1. Process free attributes (Single select)
      for (const attr of freeAttributes) {
        const selectedValLabel = selectedFreeDefaults[attr.name];
        if (selectedValLabel) {
          const val = attr.values?.find((v) => (v.label || (v as any).value_label) === selectedValLabel);
          if (val) {
            await saveCatalogPreset({
              target_type: targetType,
              target_id: targetId,
              attribute_definition_id: attr.id,
              attribute_value_ids: [val.id],
              is_locked: Boolean(lockedByAttr[attr.id]),
            });
          }
        } else {
          // If deselected/empty, delete old preset from DB
          await deleteCatalogPreset(targetType, targetId, attr.id);
        }
      }

      // 2. Process paid attributes (Multi select)
      for (const attr of paidAttributes) {
        const selectedValIds = (attr.values || [])
          .filter((v) => selectedPaidDefaults.includes(v.label || (v as any).value_label))
          .map((v) => v.id);

        if (selectedValIds.length > 0) {
          await saveCatalogPreset({
            target_type: targetType,
            target_id: targetId,
            attribute_definition_id: attr.id,
            attribute_value_ids: selectedValIds,
            is_locked: Boolean(lockedByAttr[attr.id]),
          });
        } else {
          // If deselected/empty, delete old preset from DB
          await deleteCatalogPreset(targetType, targetId, attr.id);
        }
      }

      toast.success(`Đã lưu cấu hình preset cho ${targetLabel} vào CSDL!`);
      await loadPresets();
    } catch (err: any) {
      toast.error(err.message || `Lỗi khi lưu cấu hình cho ${targetLabel}`);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (targetType: 'category' | 'product', targetId: number, attrId: number) => {
    try {
      await deleteCatalogPreset(targetType, targetId, attrId);
      toast.success(`Đã xóa cấu hình preset (${targetType === 'category' ? 'danh mục' : 'món'})`);
      await loadPresets();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa cấu hình');
    }
  };

  return (
    <div className="space-y-6">
      {/* 3 BLOCKS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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

        {/* ======================================================= */}
        {/* BLOCK 3: CẤU HÌNH PRESET DANH MỤC & MÓN (CÓ KHÓA CÔNG THỨC) */}
        {/* ======================================================= */}
        <div className="bg-card rounded-xl border p-4 space-y-3.5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  🎯
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Block 3: Cấu Hình Preset & Khóa
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Áp mặc định sẵn cho Danh mục con hoặc Từng món</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-muted-foreground">
              {/* Preset Scope Selector: Category or Product */}
              <div className="p-3 bg-background rounded-lg border space-y-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPresetTargetType('category')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      presetTargetType === 'category'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Layers className="size-3" /> Cả danh mục con
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetTargetType('product')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      presetTargetType === 'product'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Sparkles className="size-3" /> Từng món riêng lẻ
                  </button>
                </div>

                {presetTargetType === 'product' && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px] font-semibold">Chọn món cụ thể:</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Chọn món để thiết lập riêng" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryProducts.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(presetTargetType === 'category' || selectedProductId) && (
                  <div className="space-y-3 pt-1 border-t mt-2">
                    <p className="font-bold text-[11px] text-foreground">
                      {presetTargetType === 'category' ? `Preset mặc định ${categoryName}:` : 'Preset cho món đã chọn:'}
                    </p>

                    {/* Choose free option preset */}
                    {freeAttributes.map((attr) => (
                      <div key={attr.id} className="space-y-1 p-2 rounded-lg bg-muted/20 border">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-foreground font-semibold">{attr.name}:</Label>
                          <label className="flex items-center gap-1 text-[10px] text-amber-600 cursor-pointer font-semibold">
                            <input
                              type="checkbox"
                              checked={Boolean(lockedByAttr[attr.id])}
                              onChange={(e) =>
                                setLockedByAttr((prev) => ({
                                  ...prev,
                                  [attr.id]: e.target.checked,
                                }))
                              }
                              className="rounded border-amber-400 text-amber-600 size-3"
                            />
                            <Lock className="size-2.5" /> Khóa
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {attr.values?.map((v) => {
                            const valLabel = v.label || (v as any).value_label;
                            const isSelected = selectedFreeDefaults[attr.name] === valLabel;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() =>
                                  setSelectedFreeDefaults((prev) => ({
                                    ...prev,
                                    [attr.name]: isSelected ? '' : valLabel,
                                  }))
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary font-bold'
                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {valLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Choose paid option preset */}
                    {paidAttributes.map((attr) => (
                      <div key={attr.id} className="space-y-1 p-2 rounded-lg bg-muted/20 border">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-foreground font-semibold">{attr.name}:</Label>
                          <label className="flex items-center gap-1 text-[10px] text-amber-600 cursor-pointer font-semibold">
                            <input
                              type="checkbox"
                              checked={Boolean(lockedByAttr[attr.id])}
                              onChange={(e) =>
                                setLockedByAttr((prev) => ({
                                  ...prev,
                                  [attr.id]: e.target.checked,
                                }))
                              }
                              className="rounded border-amber-400 text-amber-600 size-3"
                            />
                            <Lock className="size-2.5" /> Khóa
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {attr.values?.map((v) => {
                            const valLabel = v.label || (v as any).value_label;
                            const isSelected = selectedPaidDefaults.includes(valLabel);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() =>
                                  setSelectedPaidDefaults((prev) =>
                                    isSelected
                                      ? prev.filter((item) => item !== valLabel)
                                      : [...prev, valLabel],
                                  )
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {isSelected ? '✓ ' : '+ '}
                                {valLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* List of saved presets from DB */}
              {(categoryPresets.length > 0 || productPresets.length > 0) && (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {/* Category Presets */}
                  {categoryPresets.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-foreground">Preset Danh Mục Con ({categoryName}):</p>
                      {categoryPresets.map((preset) => (
                        <div
                          key={`cat-${preset.id}`}
                          className="p-1.5 rounded-lg bg-blue-500/5 border text-[10px] space-y-0.5 flex items-start justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-foreground">{preset.attribute_name}</span>
                              {preset.is_locked && (
                                <span className="px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 text-[8px] font-semibold flex items-center gap-0.5">
                                  <Lock className="size-2" /> Khóa
                                </span>
                              )}
                            </div>
                            <p className="text-muted-foreground">
                              {preset.values?.map((v) => v.label).join(', ') || 'Chưa gán giá trị'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeletePreset('category', categoryId, preset.attribute_definition_id)}
                            className="text-destructive hover:opacity-75 p-1"
                            title="Xóa preset danh mục"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Product Presets */}
                  {productPresets.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-foreground">Preset Ghi Đè Riêng Cho Từng Món:</p>
                      {productPresets.map((preset) => {
                        const prod = categoryProducts.find((p) => Number(p.id) === Number(preset.target_id));
                        return (
                          <div
                            key={`prod-${preset.id}`}
                            className="p-1.5 rounded-lg bg-muted/40 border text-[10px] space-y-0.5 flex items-start justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-foreground">{prod?.name || `Món #${preset.target_id}`}</span>
                                <span className="text-muted-foreground font-normal">({preset.attribute_name})</span>
                                {preset.is_locked && (
                                  <span className="px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 text-[8px] font-semibold flex items-center gap-0.5">
                                    <Lock className="size-2" /> Khóa
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground">
                                {preset.values?.map((v) => v.label).join(', ') || 'Chưa gán giá trị'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeletePreset('product', preset.target_id, preset.attribute_definition_id)}
                              className="text-destructive hover:opacity-75 p-1"
                              title="Xóa preset món"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <Button
            variant="hero"
            size="sm"
            className="w-full text-xs font-semibold h-8"
            disabled={(presetTargetType === 'product' && !selectedProductId) || savingPreset}
            onClick={handleSavePreset}
          >
            <Settings2 className="size-3.5 mr-1" />
            {savingPreset
              ? 'Đang lưu vào DB...'
              : presetTargetType === 'category'
                ? 'Lưu Preset Cho Toàn Danh Mục Con'
                : 'Lưu Cấu Hình Riêng Cho Món'}
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
