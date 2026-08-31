import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown, RefreshCw } from 'lucide-react';
import type { PublicCategoryNode } from '@/lib/api';
import {
  getRootCategories,
  getChildrenByParentId,
  isCategoryActive,
  isRootCategoryActive,
} from '@/lib/catalog-navigation';

interface MobileCategoryMenuProps {
  categoryTree: PublicCategoryNode[];
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => void;
  currentCategorySlug?: string;
  onNavigate?: () => void;
}

export function MobileCategoryMenu({
  categoryTree,
  isLoading,
  isError,
  refetch,
  currentCategorySlug,
  onNavigate,
}: MobileCategoryMenuProps) {
  // Set of expanded root category IDs in accordion
  const [expandedRootIds, setExpandedRootIds] = useState<Set<number>>(() => {
    // Auto-expand the root that contains the active category if any
    const initial = new Set<number>();
    if (currentCategorySlug) {
      const roots = getRootCategories(categoryTree);
      for (const root of roots) {
        if (isRootCategoryActive(root, currentCategorySlug)) {
          initial.add(root.id);
        }
      }
    }
    return initial;
  });

  const toggleRootAccordion = (rootId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedRootIds((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) {
        next.delete(rootId);
      } else {
        next.add(rootId);
      }
      return next;
    });
  };

  const rootCategories = getRootCategories(categoryTree);
  const isAllActive = !currentCategorySlug;

  if (isLoading) {
    return <p className="py-2 text-xs text-muted-foreground">Đang tải danh mục…</p>;
  }

  if (isError) {
    return (
      <div className="py-2 space-y-1">
        <p className="text-xs text-destructive font-medium">Không thể tải danh mục.</p>
        {refetch && (
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            onClick={() => refetch()}
          >
            <RefreshCw className="size-3" /> Thử lại
          </button>
        )}
      </div>
    );
  }

  if (rootCategories.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">Chưa có danh mục công khai.</p>;
  }

  return (
    <div className="space-y-1 py-1" role="navigation" aria-label="Danh mục thực đơn di động">
      {/* Tất cả sản phẩm */}
      <Link
        to="/menu"
        search={(prev) => ({ ...prev, category: undefined, page: undefined })}
        onClick={onNavigate}
        className={`flex items-center min-h-[40px] px-2 rounded-lg text-xs font-bold transition-colors ${
          isAllActive
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-muted hover:text-primary'
        }`}
      >
        Tất cả sản phẩm
      </Link>

      {/* Root categories */}
      {rootCategories.map((root) => {
        const subcategories =
          root.children && root.children.length > 0
            ? root.children
            : getChildrenByParentId(categoryTree, root.id);

        const hasSubcategories = subcategories.length > 0;
        const isExpanded = expandedRootIds.has(root.id);
        const isRootActive = isRootCategoryActive(root, currentCategorySlug);
        const isSelfActive = isCategoryActive(root.slug, currentCategorySlug);

        if (!hasSubcategories) {
          return (
            <Link
              key={root.id}
              to="/menu"
              search={(prev) => ({ ...prev, category: root.slug, page: undefined })}
              onClick={onNavigate}
              className={`flex items-center min-h-[40px] px-2 rounded-lg text-xs font-semibold transition-colors ${
                isSelfActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted hover:text-primary'
              }`}
            >
              {root.name}
            </Link>
          );
        }

        return (
          <div key={root.id} className="rounded-lg overflow-hidden">
            {/* Split Root Row: Category text link on left, Chevron button on right */}
            <div
              className={`flex items-center justify-between rounded-lg transition-colors ${
                isRootActive ? 'bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <Link
                to="/menu"
                search={(prev) => ({ ...prev, category: root.slug, page: undefined })}
                onClick={onNavigate}
                className={`flex-1 flex items-center min-h-[40px] px-2 text-xs font-semibold ${
                  isSelfActive
                    ? 'text-primary font-bold'
                    : isRootActive
                    ? 'text-primary'
                    : 'text-foreground hover:text-primary'
                }`}
              >
                {root.name}
              </Link>

              {/* Dedicated Chevron toggle button with min 40x40px touch target */}
              <button
                type="button"
                onClick={(e) => toggleRootAccordion(root.id, e)}
                aria-label={`Mở rộng danh mục ${root.name}`}
                aria-expanded={isExpanded}
                aria-controls={`mobile-subcategories-${root.id}`}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-md"
              >
                <ChevronDown
                  className={`size-4 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>
            </div>

            {/* Accordion Subcategories List */}
            {isExpanded && (
              <div
                id={`mobile-subcategories-${root.id}`}
                className="pl-3 pr-1 py-1 space-y-0.5 border-l-2 border-primary/20 ml-3 my-1"
              >
                {subcategories.map((child) => {
                  const isChildActive = isCategoryActive(child.slug, currentCategorySlug);
                  return (
                    <Link
                      key={child.id}
                      to="/menu"
                      search={(prev) => ({ ...prev, category: child.slug, page: undefined })}
                      onClick={onNavigate}
                      className={`flex items-center min-h-[38px] px-2.5 rounded-md text-xs transition-colors ${
                        isChildActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }`}
                    >
                      {child.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
