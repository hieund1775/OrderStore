import { Layers, Plus } from 'lucide-react';
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
};

export function CatalogRootSelector({
  roots,
  totalCategories,
  value,
  onValueChange,
  canCreateRoot,
  onCreateRoot,
}: CatalogRootSelectorProps) {
  return (
    <div className="bg-muted/40 border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
          <Layers className="size-4 text-primary" /> Danh mục gốc:
        </Label>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="w-[240px] font-semibold h-9 text-sm bg-background">
            <SelectValue placeholder="Chọn danh mục gốc" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-semibold">
              Tất cả danh mục ({totalCategories})
            </SelectItem>
            {roots.map((root) => (
              <SelectItem key={root.id} value={String(root.id)}>
                {root.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canCreateRoot && (
        <Button variant="hero" size="sm" onClick={onCreateRoot} className="h-9 font-semibold text-xs">
          <Plus className="size-4 mr-1.5" /> Tạo danh mục gốc
        </Button>
      )}
    </div>
  );
}
