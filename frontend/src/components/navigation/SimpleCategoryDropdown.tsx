import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { PublicCategoryNode } from '@/lib/api';
import { getRootCategories, isCategoryActive } from '@/lib/catalog-navigation';

interface SimpleCategoryDropdownProps {
  categoryTree: PublicCategoryNode[];
  currentCategorySlug?: string;
  onClose?: () => void;
}

export function SimpleCategoryDropdown({
  categoryTree,
  currentCategorySlug,
  onClose,
}: SimpleCategoryDropdownProps) {
  const rootCategories = getRootCategories(categoryTree);
  const isAllActive = !currentCategorySlug;

  return (
    <div
      role="menu"
      aria-label="Menu danh mục sản phẩm"
      className="w-60 rounded-xl border border-border/80 bg-popover/98 p-1.5 text-popover-foreground shadow-xl backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-1 duration-150"
    >
      {/* Tất cả sản phẩm */}
      <Link
        to="/menu"
        search={(prev) => ({ ...prev, category: undefined, page: undefined })}
        onClick={onClose}
        className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
          isAllActive
            ? 'bg-primary/10 text-primary font-bold'
            : 'font-semibold text-foreground hover:bg-muted/70 hover:text-primary'
        }`}
      >
        <span>Tất cả sản phẩm</span>
        <ChevronRight className="size-3.5 opacity-60" />
      </Link>

      {rootCategories.length > 0 && <div className="h-px bg-border/60 my-1" />}

      {/* Root categories only */}
      <div className="flex flex-col space-y-0.5">
        {rootCategories.map((root) => {
          const isActive = isCategoryActive(root.slug, currentCategorySlug);
          return (
            <Link
              key={root.id}
              to="/menu"
              search={(prev) => ({ ...prev, category: root.slug, page: undefined })}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'font-medium text-foreground/90 hover:bg-muted/70 hover:text-primary'
              }`}
            >
              <span className="truncate">{root.name}</span>
              <ChevronRight className="size-3 opacity-40" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
