import { useNavigate } from '@tanstack/react-router';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PublicCategoryNode } from '@/lib/api';

interface CategorySelectorProps {
  categoryTree: PublicCategoryNode[];
  activeCategorySlug?: string;
  searchParams: { store_id?: string; table_id?: string };
}

export function CategorySelector({
  categoryTree,
  activeCategorySlug,
  searchParams,
}: CategorySelectorProps) {
  const navigate = useNavigate();

  // Tìm kiếm root category đang chọn
  const activeRoot = categoryTree.find(
    (root) =>
      root.slug === activeCategorySlug ||
      root.children?.some((c) => c.slug === activeCategorySlug),
  );

  const handleSelectRoot = (rootSlug: string) => {
    if (rootSlug === 'all') {
      navigate({
        to: '/menu',
        search: { ...searchParams, category: undefined, page: undefined },
      });
    } else {
      navigate({
        to: '/menu',
        search: { ...searchParams, category: rootSlug, page: undefined },
      });
    }
  };

  const selectedRootValue = activeRoot ? activeRoot.slug : (activeCategorySlug || 'all');

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Danh mục:</span>
      <Select value={selectedRootValue} onValueChange={handleSelectRoot}>
        <SelectTrigger className="w-[190px] sm:w-[220px] h-9 text-xs font-semibold bg-background shadow-2xs">
          <SelectValue placeholder="Tất cả danh mục" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs font-semibold">
            Tất cả danh mục
          </SelectItem>
          {categoryTree.map((root) => (
            <SelectItem key={root.id} value={root.slug} className="text-xs font-semibold">
              {root.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default CategorySelector;
