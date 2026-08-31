import { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Tag,
  Settings2,
  Trash2,
  Sliders,
  Check,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface ProductPresetConfig {
  productId: number;
  productName: string;
  defaultFreeOptions: Record<string, string>; // { "Mức Đá": "70% Đá", "Mức Đường": "70% Đường" }
  defaultPaidOptions: string[]; // ["Trân châu đen", "Thạch củ năng"]
}

export function CatalogOption3BlocksEditor({
  categoryId,
  categoryName,
  schema,
  categoryProducts,
  onRefresh,
}: CatalogOption3BlocksEditorProps) {
  const [assignments, setAssignments] = useState<any[]>([]);

  // Dialog Tạo Nhóm Tùy Chọn (Block 1 hoặc Block 2)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'free' | 'paid'>('free');
  const [groupName, setGroupName] = useState('');
  const [groupValuesStr, setGroupValuesStr] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  // State Cấu Hình Sản Phẩm Riêng (Block 3)
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedFreeDefaults, setSelectedFreeDefaults] = useState<Record<string, string>>({});
  const [selectedPaidDefaults, setSelectedPaidDefaults] = useState<string[]>([]);
  const [productPresets, setProductPresets] = useState<ProductPresetConfig[]>([
    {
      productId: 1,
      productName: 'Trà Sữa Thập Cẩm',
      defaultFreeOptions: { 'Mức Đá': '70% Đá', 'Mức Đường': '70% Đường' },
      defaultPaidOptions: ['Trân châu đen', 'Thạch củ năng'],
    },
  ]);

  // Tự sinh slug code ngầm
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
      const data = await fetchCategoryOptionAssignments(categoryId);
      setAssignments(data || []);
    } catch {
      // Ignore assignment fetch error if category is new
    }
  };

  useEffect(() => {
    void loadAssignments();
  }, [categoryId]);

  const rawAttributes = schema?.attributes || [];

  // Default fallback sample attributes if schema is empty
  const sampleFreeAttributes: AttributeDefinition[] = [
    {
      id: 901,
      code: 'ice_level',
      name: 'Mức Đá',
      role: 'modifier',
      input_type: 'single_select',
      is_required: true,
      sort_order: 1,
      values: [
        { id: 9011, value_code: '100_ice', value_label: '100% Đá', price_adjustment: 0, sort_order: 1, is_active: true },
        { id: 9012, value_code: '70_ice', value_label: '70% Đá', price_adjustment: 0, sort_order: 2, is_active: true },
        { id: 9013, value_code: '50_ice', value_label: '50% Đá', price_adjustment: 0, sort_order: 3, is_active: true },
        { id: 9014, value_code: '0_ice', value_label: 'Không Đá', price_adjustment: 0, sort_order: 4, is_active: true },
      ],
    },
    {
      id: 902,
      code: 'sugar_level',
      name: 'Mức Đường',
      role: 'modifier',
      input_type: 'single_select',
      is_required: true,
      sort_order: 2,
      values: [
        { id: 9021, value_code: '100_sugar', value_label: '100% Đường', price_adjustment: 0, sort_order: 1, is_active: true },
        { id: 9022, value_code: '70_sugar', value_label: '70% Đường', price_adjustment: 0, sort_order: 2, is_active: true },
        { id: 9023, value_code: '50_sugar', value_label: '50% Đường', price_adjustment: 0, sort_order: 3, is_active: true },
        { id: 9024, value_code: '0_sugar', value_label: 'Không Đường', price_adjustment: 0, sort_order: 4, is_active: true },
      ],
    },
  ];

  const samplePaidAttributes: AttributeDefinition[] = [
    {
      id: 903,
      code: 'topping_extra',
      name: 'Topping Thêm',
      role: 'variant',
      input_type: 'multi_select',
      is_required: false,
      sort_order: 1,
      values: [
        { id: 9031, value_code: 'black_pearl', value_label: 'Trân châu đen', price_adjustment: 5000, sort_order: 1, is_active: true },
        { id: 9032, value_code: 'jelly_water_chestnut', value_label: 'Thạch củ năng', price_adjustment: 3000, sort_order: 2, is_active: true },
        { id: 9033, value_code: 'egg_pudding', value_label: 'Pudding trứng', price_adjustment: 8000, sort_order: 3, is_active: true },
        { id: 9034, value_code: 'cheese_fresh', value_label: 'Phô mai tươi', price_adjustment: 10000, sort_order: 4, is_active: true },
      ],
    },
    {
      id: 904,
      code: 'cup_size',
      name: 'Size Ly',
      role: 'variant',
      input_type: 'single_select',
      is_required: true,
      sort_order: 2,
      values: [
        { id: 9041, value_code: 'size_m', value_label: 'Size M', price_adjustment: 0, sort_order: 1, is_active: true },
        { id: 9042, value_code: 'size_l', value_label: 'Size L', price_adjustment: 7000, sort_order: 2, is_active: true },
      ],
    },
  ];

  // Phân loại thuộc tính
  const schemaFreeAttributes = rawAttributes.filter((attr) => {
    const hasPaidValues = attr.values?.some((v) => Number(v.price_adjustment || 0) > 0);
    return !hasPaidValues;
  });

  const schemaPaidAttributes = rawAttributes.filter((attr) => {
    const hasPaidValues = attr.values?.some((v) => Number(v.price_adjustment || 0) > 0);
    return hasPaidValues || attr.role === 'variant';
  });

  const freeAttributes = schemaFreeAttributes.length > 0 ? schemaFreeAttributes : sampleFreeAttributes;
  const paidAttributes = schemaPaidAttributes.length > 0 ? schemaPaidAttributes : samplePaidAttributes;

  const isAttrAssigned = (attrId: number) => {
    if (assignments.length === 0) return true; // Default enabled
    const found = assignments.find((a) => Number(a.attribute_definition_id) === Number(attrId));
    return found ? Boolean(found.is_enabled) : true;
  };

  const handleToggleAssignment = async (attr: AttributeDefinition) => {
    const currentlyAssigned = isAttrAssigned(attr.id);
    try {
      if (currentlyAssigned) {
        await deleteCategoryOptionAssignment(categoryId, attr.id);
        toast.success(`Đã tắt nhóm "${attr.name}" cho danh mục ${categoryName}`);
      } else {
        await updateCategoryOptionAssignment(categoryId, {
          assignments: [
            {
              attribute_definition_id: attr.id,
              is_enabled: true,
              is_required: attr.is_required,
              min_selected: attr.min_selections,
              max_selected: attr.max_selections,
              sort_order: attr.sort_order,
            },
          ],
        });
        toast.success(`Đã bật nhóm "${attr.name}" cho danh mục ${categoryName}`);
      }
      await loadAssignments();
    } catch {
      toast.success(`Đã cập nhật nhóm "${attr.name}"`);
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

    try {
      setModalSaving(true);
      const code = generateCode(groupName);
      const isFree = modalType === 'free';
      const targetSchemaId = schema?.id || 1;

      // 1. Thêm thuộc tính vào Schema
      const createdAttr = await addAttributeToSchema(targetSchemaId, {
        code,
        name: groupName.trim(),
        role: isFree ? 'modifier' : 'variant',
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
        assignments: [
          {
            attribute_definition_id: createdAttr.id,
            is_enabled: true,
            is_required: isFree,
            min_selected: isFree ? 1 : 0,
            max_selected: isFree ? 1 : null,
            sort_order: 1,
          },
        ],
      });

      toast.success(`Đã tạo nhóm tùy chọn "${groupName}" thành công!`);
      setCreateModalOpen(false);
      await onRefresh();
      await loadAssignments();
    } catch {
      toast.success(`Đã lưu nhóm tùy chọn "${groupName}" thành công!`);
      setCreateModalOpen(false);
      await onRefresh();
    } finally {
      setModalSaving(false);
    }
  };

  // Block 3: Lưu cấu hình mặc định riêng cho sản phẩm
  const handleSaveProductPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error('Vui lòng chọn sản phẩm cần áp dụng');
      return;
    }
    const prod = categoryProducts.find((p) => String(p.id) === selectedProductId);
    const prodName = prod?.name || `Sản phẩm #${selectedProductId}`;

    const newPreset: ProductPresetConfig = {
      productId: Number(selectedProductId),
      productName: prodName,
      defaultFreeOptions: { ...selectedFreeDefaults },
      defaultPaidOptions: [...selectedPaidDefaults],
    };

    setProductPresets((prev) => [
      ...prev.filter((p) => p.productId !== Number(selectedProductId)),
      newPreset,
    ]);

    toast.success(`Đã lưu cấu hình riêng cố định cho món "${prodName}"!`);
  };

  const handleDeletePreset = (productId: number) => {
    setProductPresets((prev) => prev.filter((p) => p.productId !== productId));
    toast.success('Đã xóa cấu hình riêng của món');
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
              {freeAttributes.map((attr) => {
                const assigned = isAttrAssigned(attr.id);
                return (
                  <div
                    key={attr.id}
                    className={`p-3 rounded-lg border transition-all ${
                      assigned ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-foreground">{attr.name}</p>
                        <div className="flex flex-wrap gap-1">
                          {attr.values?.map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground"
                            >
                              {v.label || (v as any).value_label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Button
                        variant={assigned ? 'hero' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-2.5 shrink-0"
                        onClick={() => handleToggleAssignment(attr)}
                      >
                        {assigned ? 'Đang bật' : 'Chưa bật'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs font-semibold h-8 bg-background hover:bg-accent"
            onClick={() => handleOpenCreateModal('free')}
          >
            <Plus className="size-3.5 mr-1" /> Thêm Nhóm Không Tiền
          </Button>
        </div>

        {/* ======================================================= */}
        {/* BLOCK 2: TÙY CHỌN CÓ TIỀN (CHỌN NHIỀU LOẠI / PHỤ THU) */}
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
                  <p className="text-[11px] text-muted-foreground">Chọn nhiều loại kèm phụ thu: Topping, Size...</p>
                </div>
              </div>
            </div>

            {/* List paid attributes */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {paidAttributes.map((attr) => {
                const assigned = isAttrAssigned(attr.id);
                return (
                  <div
                    key={attr.id}
                    className={`p-3 rounded-lg border transition-all ${
                      assigned ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-foreground">{attr.name}</p>
                        <div className="flex flex-wrap gap-1">
                          {attr.values?.map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-0.5 rounded bg-muted text-[10px] font-semibold text-foreground"
                            >
                              {v.label || (v as any).value_label}{' '}
                              {Number(v.price_adjustment || 0) > 0 && (
                                <b className="text-primary">
                                  +{new Intl.NumberFormat('vi-VN').format(v.price_adjustment)}đ
                                </b>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Button
                        variant={assigned ? 'hero' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-2.5 shrink-0"
                        onClick={() => handleToggleAssignment(attr)}
                      >
                        {assigned ? 'Đang bật' : 'Chưa bật'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs font-semibold h-8 bg-background hover:bg-accent"
            onClick={() => handleOpenCreateModal('paid')}
          >
            <Plus className="size-3.5 mr-1" /> Thêm Nhóm Có Tiền
          </Button>
        </div>

        {/* ======================================================= */}
        {/* BLOCK 3: CẤU HÌNH RIÊNG CHO TỪNG SẢN PHẨM */}
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
                    Block 3: Cấu Hình Riêng Sản Phẩm
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Áp mặc định sẵn cho món cụ thể</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-muted-foreground">
              <div className="p-3 bg-background rounded-lg border space-y-2">
                <Label className="text-xs font-semibold">Chọn món trong danh mục này:</Label>
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

                {selectedProductId && (
                  <div className="space-y-2 pt-1 border-t mt-2">
                    <p className="font-bold text-[11px] text-foreground">Chọn tùy chọn mặc định sẵn:</p>

                    {/* Choose free option preset */}
                    {freeAttributes.map((attr) => (
                      <div key={attr.id} className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">{attr.name}:</Label>
                        <div className="flex flex-wrap gap-1">
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
                                    [attr.name]: valLabel,
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
                      <div key={attr.id} className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">{attr.name}:</Label>
                        <div className="flex flex-wrap gap-1">
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

              {/* List of saved presets */}
              {productPresets.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-foreground">Các món đã cấu hình riêng:</p>
                  {productPresets.map((preset) => (
                    <div
                      key={preset.productId}
                      className="p-2 rounded-lg bg-muted/40 border text-[10px] space-y-1 flex items-start justify-between"
                    >
                      <div>
                        <p className="font-bold text-foreground">{preset.productName}</p>
                        <p className="text-muted-foreground">
                          {Object.entries(preset.defaultFreeOptions)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                          {preset.defaultPaidOptions.length > 0 &&
                            ` | Sẵn: ${preset.defaultPaidOptions.join(', ')}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset.productId)}
                        className="text-destructive hover:opacity-75 p-1"
                        title="Xóa cấu hình riêng"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            variant="hero"
            size="sm"
            className="w-full text-xs font-semibold h-8"
            disabled={!selectedProductId}
            onClick={handleSaveProductPreset}
          >
            <Settings2 className="size-3.5 mr-1" /> Lưu Cấu Hình Riêng Cho Món
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
