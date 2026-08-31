import { useNavigate } from '@tanstack/react-router';
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

  const handleSelectRoot = (rootSlug?: string) => {
    navigate({
      to: '/menu',
      search: {
        ...searchParams,
        category: rootSlug || undefined,
        page: undefined,
      },
    });
  };

  const isAllActive = !activeCategorySlug;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-full">
      <button
        type="button"
        onClick={() => handleSelectRoot(undefined)}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
          isAllActive
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        Tất cả sản phẩm
      </button>
      {categoryTree.map((root) => {
        const isSelected = activeCategorySlug === root.slug;
        return (
          <button
            key={root.id}
            type="button"
            onClick={() => handleSelectRoot(root.slug)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              isSelected
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {root.name}
          </button>
        );
      })}
    </div>
  );
}

export default CategorySelector;
