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

  // Tìm kiếm thông tin category đang chọn trong cây phân cấp
  const findCategory = (
    nodes: PublicCategoryNode[],
    slug: string,
  ): { node: PublicCategoryNode; root: PublicCategoryNode; parent: PublicCategoryNode | null } | null => {
    for (const root of nodes) {
      if (root.slug === slug) return { node: root, root, parent: null };
      if (root.children) {
        for (const child of root.children) {
          if (child.slug === slug) return { node: child, root, parent: root };
          if (child.children) {
            for (const grand of child.children) {
              if (grand.slug === slug) return { node: grand, root, parent: child };
            }
          }
        }
      }
    }
    return null;
  };

  const activeInfo = activeCategorySlug ? findCategory(categoryTree, activeCategorySlug) : null;
  const activeRoot = activeInfo?.root || null;
  const activeRootSubcategories = activeRoot?.children || [];

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

  const handleSelectSubcategory = (subcatSlug: string) => {
    if (subcatSlug === 'all-root') {
      navigate({
        to: '/menu',
        search: { ...searchParams, category: activeRoot?.slug, page: undefined },
      });
    } else {
      navigate({
        to: '/menu',
        search: { ...searchParams, category: subcatSlug, page: undefined },
      });
    }
  };

  const selectedRootValue = activeRoot ? activeRoot.slug : 'all';
  const selectedSubcatValue = activeInfo?.node && activeInfo.node.slug !== activeRoot?.slug
    ? activeInfo.node.slug
    : 'all-root';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* FILTER 1: DANH MỤC GỐC */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Danh mục:</span>
        <Select value={selectedRootValue} onValueChange={handleSelectRoot}>
          <SelectTrigger className="w-[180px] sm:w-[200px] h-9 text-xs font-semibold bg-background">
            <SelectValue placeholder="Chọn danh mục" />
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

      {/* FILTER 2: DANH SÁCH DANH MỤC CON (NẾU CÓ) */}
      {activeRootSubcategories.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Danh sách danh mục:</span>
          <Select value={selectedSubcatValue} onValueChange={handleSelectSubcategory}>
            <SelectTrigger className="w-[180px] sm:w-[200px] h-9 text-xs font-semibold bg-background">
              <SelectValue placeholder="Tất cả trong danh mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-root" className="text-xs font-semibold">
                Tất cả {activeRoot?.name}
              </SelectItem>
              {activeRootSubcategories.map((child) => (
                <SelectItem key={child.id} value={child.slug} className="text-xs font-semibold">
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export default CategorySelector;
