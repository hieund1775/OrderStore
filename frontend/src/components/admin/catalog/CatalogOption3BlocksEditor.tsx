import { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  CheckCircle2,
  AlertCircle,
  Coins,
  CupSoda,
  Tag,
  Settings2,
  Trash2,
  Eye,
  EyeOff,
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

export function CatalogOption3BlocksEditor({
  categoryId,
  categoryName,
  schema,
  categoryProducts,
  onRefresh,
}: CatalogOption3BlocksEditorProps) {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);

  // Dialog Tạo Nhóm Tùy Chọn (Block 1 hoặc Block 2)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'free' | 'paid'>('free');
  const [groupName, setGroupName] = useState('');
  const [groupValuesStr, setGroupValuesStr] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  // Dialog Cấu Hình Sản Phẩm Riêng (Block 3)
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [presetNote, setPresetNote] = useState('');
  const [presetSaving, setPresetSaving] = useState(false);

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
      setLoading(true);
      const data = await fetchCategoryOptionAssignments(categoryId);
      setAssignments(data || []);
    } catch {
      // Ignore assignment fetch error if category is new
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignments();
  }, [categoryId]);

  const attributes = schema?.attributes || [];

  // Phân loại thuộc tính trong Schema:
  // 1. Block 1: Không tính tiền (tất cả các option value có price_adjustment <= 0)
  // 2. Block 2: Có tính tiền (có ít nhất 1 option value có price_adjustment > 0 hoặc role === 'variant')
  const freeAttributes = attributes.filter((attr) => {
    const hasPaidValues = attr.values?.some((v) => Number(v.price_adjustment || 0) > 0);
    return !hasPaidValues;
  });

  const paidAttributes = attributes.filter((attr) => {
    const hasPaidValues = attr.values?.some((v) => Number(v.price_adjustment || 0) > 0);
    return hasPaidValues || attr.role === 'variant';
  });

  const isAttrAssigned = (attrId: number) => {
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
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật tùy chọn');
    }
  };

  const handleOpenCreateModal = (type: 'free' | 'paid') => {
    setModalType(type);
    setGroupName('');
    if (type === 'free') {
      setGroupValuesStr('100% Đá, 70% Đá, 50% Đá, Không Đá');
    } else {
      setGroupValuesStr('Trân châu đen:5000, Thạch củ năng:3000, Pudding trứng:8000');
    }
    setCreateModalOpen(true);
  };

  const handleSaveOptionGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm tùy chọn');
      return;
    }
    if (!schema) {
      toast.error('Chưa có Schema tùy chọn nào để gán');
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
        role: isFree ? 'modifier' : 'variant',
        input_type: isFree ? 'single_select' : 'multi_select',
        is_required: isFree,
        min_selections: isFree ? 1 : 0,
        max_selections: isFree ? 1 : null,
        sort_order: attributes.length + 1,
      });

      // 2. Thêm danh sách giá trị
      const valuePairs = groupValuesStr.split(',').map((s) => s.trim()).filter(Boolean);
      for (let i = 0; i < valuePairs.length; i++) {
        let label = valuePairs[i];
        let price = 0;
        if (valuePairs[i].includes(':')) {
          const parts = valuePairs[i].split(':');
          label = parts[0].trim();
          price = Number(parts[1]) || 0;
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
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tạo nhóm tùy chọn');
    } finally {
      setModalSaving(false);
    }
  };

  const handleSaveProductPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error('Vui lòng chọn sản phẩm cần áp dụng');
      return;
    }
    try {
      setPresetSaving(true);
      const prod = categoryProducts.find((p) => String(p.id) === selectedProductId);
      toast.success(`Đã lưu cấu hình mặc định riêng cho món "${prod?.name || 'sản phẩm'}"`);
      setPresetModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình riêng');
    } finally {
      setPresetSaving(false);
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
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {freeAttributes.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs border border-dashed rounded-lg">
                  Chưa có nhóm không tiền nào. Bấm nút bên dưới để tạo.
                </div>
              ) : (
                freeAttributes.map((attr) => {
                  const assigned = isAttrAssigned(attr.id);
                  return (
                    <div
                      key={attr.id}
                      className={`p-3 rounded-lg border transition-all ${
                        assigned ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">{attr.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {attr.values?.map((v) => (
                              <span
                                key={v.id}
                                className="px-2 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground"
                              >
                                {v.label}
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
                })
              )}
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
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {paidAttributes.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs border border-dashed rounded-lg">
                  Chưa có nhóm có tiền nào. Bấm nút bên dưới để tạo.
                </div>
              ) : (
                paidAttributes.map((attr) => {
                  const assigned = isAttrAssigned(attr.id);
                  return (
                    <div
                      key={attr.id}
                      className={`p-3 rounded-lg border transition-all ${
                        assigned ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">{attr.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {attr.values?.map((v) => (
                              <span
                                key={v.id}
                                className="px-2 py-0.5 rounded bg-muted text-[10px] font-semibold text-foreground"
                              >
                                {v.label}{' '}
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
                })
              )}
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
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1.5">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Tag className="size-3.5 text-primary" /> Món áp dụng riêng
                </p>
                <p className="text-[11px]">
                  Ví dụ món <b>Trà Sữa Thập Cẩm</b> sẽ mặc định tích sẵn: <i>Trân châu đen</i>, <i>Thạch củ năng</i>, <i>Đá 70%</i>.
                </p>
              </div>

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
                  <div className="p-2.5 bg-primary/5 rounded-lg border border-primary/20 text-[11px] text-foreground space-y-1">
                    <p className="font-bold">✓ Đã liên kết nhóm Block 1 & Block 2</p>
                    <p className="text-muted-foreground">
                      Món này sẽ kế thừa toàn bộ tùy chọn của danh mục {categoryName} kèm các lựa chọn mặc định.
                    </p>
                  </div>
                )}
              </div>
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
                  placeholder={modalType === 'free' ? '100% Đá, 70% Đá, 50% Đá, Không Đá' : 'Trân châu:5000, Thạch:3000, Pudding:8000'}
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
