import React from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Layers, Sparkles, FolderTree } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  const activeNode = activeInfo?.node;
  const activeRoot = activeInfo?.root;
  const activeParent = activeInfo?.parent;

  // Danh mục con của root đang chọn
  const activeRootSubcategories = activeRoot?.children || [];

  return (
    <div className="space-y-3 w-full">
      {/* Breadcrumb if inside a category */}
      {activeNode && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <Link
            to="/menu"
            search={{ ...searchParams, category: undefined }}
            className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
          >
            <Layers className="size-3.5" /> Tất cả ngành
          </Link>
          {activeRoot && activeRoot.slug !== activeNode.slug && (
            <>
              <ChevronRight className="size-3 text-muted-foreground/60" />
              <Link
                to="/menu"
                search={{ ...searchParams, category: activeRoot.slug }}
                className="hover:text-primary transition-colors font-medium"
              >
                {activeRoot.name}
              </Link>
            </>
          )}
          {activeParent && activeParent.slug !== activeRoot?.slug && activeParent.slug !== activeNode.slug && (
            <>
              <ChevronRight className="size-3 text-muted-foreground/60" />
              <Link
                to="/menu"
                search={{ ...searchParams, category: activeParent.slug }}
                className="hover:text-primary transition-colors font-medium"
              >
                {activeParent.name}
              </Link>
            </>
          )}
          <ChevronRight className="size-3 text-muted-foreground/60" />
          <span className="font-bold text-foreground">{activeNode.name}</span>
        </div>
      )}

      {/* ROW 1: DANH MỤC GỐC (ROOT CATEGORIES) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Sparkles className="size-3 text-primary" /> Ngành hàng:
        </span>

        <Link
          to="/menu"
          search={{ ...searchParams, category: undefined }}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
            !activeCategorySlug
              ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
              : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
          }`}
        >
          🌐 Tất cả món
        </Link>

        {categoryTree.map((root) => {
          const isRootActive = activeRoot?.id === root.id;
          const isExactActive = activeCategorySlug === root.slug;

          return (
            <Link
              key={root.id}
              to="/menu"
              search={{ ...searchParams, category: root.slug }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                isExactActive || (!activeCategorySlug && false)
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                  : isRootActive
                  ? 'bg-primary/10 text-primary border-primary/40 font-bold'
                  : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
              }`}
            >
              <span>{root.name}</span>
            </Link>
          );
        })}
      </div>

      {/* ROW 2: DANH MỤC CON CỦA NGÀNH ĐANG CHỌN (SUB-CATEGORIES) */}
      {activeRootSubcategories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pl-1 bg-muted/40 p-2 rounded-xl border">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <FolderTree className="size-3 text-primary" /> Danh mục con:
          </span>

          <Link
            to="/menu"
            search={{ ...searchParams, category: activeRoot?.slug }}
            className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeCategorySlug === activeRoot?.slug
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            }`}
          >
            Tất cả {activeRoot?.name}
          </Link>

          {activeRootSubcategories.map((child) => {
            const isChildActive = activeCategorySlug === child.slug;

            return (
              <Link
                key={child.id}
                to="/menu"
                search={{ ...searchParams, category: child.slug }}
                className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  isChildActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background'
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
}
export default CategorySelector;
