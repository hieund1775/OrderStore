import { Layers, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CatalogCategoryLike } from '@/lib/catalog-navigation';

type CatalogRootSelectorProps = {
  roots: CatalogCategoryLike[];
  totalCategories: number;
  value: string;
  onValueChange: (value: string) => void;
  canCreateRoot: boolean;
  onCreateRoot: () => void;
  onEditRoot?: (root: CatalogCategoryLike) => void;
  onDeleteRoot?: (root: CatalogCategoryLike) => void;
};

export function CatalogRootSelector({
  roots,
  totalCategories,
  value,
  onValueChange,
  canCreateRoot,
  onCreateRoot,
  onEditRoot,
  onDeleteRoot,
}: CatalogRootSelectorProps) {
  const currentSelectedRoot = value !== 'all' ? roots.find((r) => String(r.id) === value) : null;

  return (
    <div className="bg-muted/40 border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
          <Layers className="size-4 text-primary" /> Ngành hàng gốc:
        </Label>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="w-[240px] font-semibold h-9 text-sm bg-background">
            <SelectValue placeholder="Chọn danh mục gốc" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-semibold">
              Tất cả ngành hàng ({totalCategories})
            </SelectItem>
            {roots.map((root) => (
              <SelectItem key={root.id} value={String(root.id)}>
                {root.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentSelectedRoot && canCreateRoot && (
          <div className="flex items-center gap-1.5 pl-1">
            {onEditRoot && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2.5 bg-background"
                onClick={() => onEditRoot(currentSelectedRoot)}
                title="Đổi tên ngành hàng gốc"
              >
                <Edit2 className="size-3.5 mr-1" /> Sửa tên ngành
              </Button>
            )}
            {onDeleteRoot && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2.5 text-destructive hover:bg-destructive/10"
                onClick={() => onDeleteRoot(currentSelectedRoot)}
                title="Xóa ngành hàng gốc"
              >
                <Trash2 className="size-3.5 mr-1" /> Xóa ngành
              </Button>
            )}
          </div>
        )}
      </div>

      {canCreateRoot && (
        <Button variant="hero" size="sm" onClick={onCreateRoot} className="h-9 font-semibold text-xs">
          <Plus className="size-4 mr-1.5" /> Tạo ngành hàng gốc
        </Button>
      )}
    </div>
  );
}
