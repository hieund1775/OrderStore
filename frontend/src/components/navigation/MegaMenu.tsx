import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import type { PublicCategoryNode } from '@/lib/api';
import { getRootCategories, getChildrenByParentId, isCategoryActive } from '@/lib/catalog-navigation';
import { MegaMenuGroup } from './MegaMenuGroup';

interface MegaMenuProps {
  categoryTree: PublicCategoryNode[];
  currentCategorySlug?: string;
  onClose?: () => void;
}

export function MegaMenu({
  categoryTree,
  currentCategorySlug,
  onClose,
}: MegaMenuProps) {
  const rootCategories = getRootCategories(categoryTree);
  const isAllActive = !currentCategorySlug;

  return (
    <div
      role="region"
      aria-label="Mega menu danh mục sản phẩm"
      className="w-[720px] max-w-[90vw] lg:w-[840px] xl:w-[920px] rounded-2xl border border-border/80 bg-popover/98 p-6 text-popover-foreground shadow-2xl backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-1 duration-200"
    >
      {/* Top Banner / Standalone "Tất cả sản phẩm" */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-5">
        <Link
          to="/menu"
          search={(prev) => ({ ...prev, category: undefined, page: undefined })}
          onClick={onClose}
          className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider rounded-lg px-3 py-1.5 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
            isAllActive
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/80 text-foreground hover:bg-muted hover:text-primary'
          }`}
        >
          <span>Tất cả sản phẩm</span>
          <ArrowRight className="size-3.5" />
        </Link>
        <span className="text-[11px] font-medium text-muted-foreground">
          {rootCategories.length} nhóm thực đơn
        </span>
      </div>

      {/* Responsive Columns Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-h-[65vh] overflow-y-auto pr-1">
        {rootCategories.map((root) => {
          const subcategories =
            root.children && root.children.length > 0
              ? root.children
              : getChildrenByParentId(categoryTree, root.id);

          return (
            <MegaMenuGroup
              key={root.id}
              root={root}
              subcategories={subcategories}
              currentCategorySlug={currentCategorySlug}
              onItemClick={onClose}
            />
          );
        })}
      </div>
    </div>
  );
}
