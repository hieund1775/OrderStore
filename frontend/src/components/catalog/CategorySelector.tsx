import React from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Layers, Sparkles } from 'lucide-react';
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
  // Find current active category in tree
  const findCategory = (nodes: PublicCategoryNode[], slug: string): { node: PublicCategoryNode; parent: PublicCategoryNode | null } | null => {
    for (const node of nodes) {
      if (node.slug === slug) return { node, parent: null };
      if (node.children) {
        for (const child of node.children) {
          if (child.slug === slug) return { node: child, parent: node };
          if (child.children) {
            for (const grand of child.children) {
              if (grand.slug === slug) return { node: grand, parent: child };
            }
          }
        }
      }
    }
    return null;
  };

  const activeInfo = activeCategorySlug ? findCategory(categoryTree, activeCategorySlug) : null;
  const activeNode = activeInfo?.node;
  const activeParent = activeInfo?.parent;

  return (
    <div className="space-y-3">
      {/* Breadcrumb if inside a category */}
      {activeNode && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <Link
            to="/menu"
            search={{ ...searchParams, category: undefined }}
            className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
          >
            <Layers className="size-3.5" /> Tất cả danh mục
          </Link>
          {activeParent && (
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

      {/* Category Pills / Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <Link
          to="/menu"
          search={{ ...searchParams, category: undefined }}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
            !activeCategorySlug
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
          }`}
        >
          🌐 Tất cả
        </Link>

        {categoryTree.map((root) => {
          const isActive = activeCategorySlug === root.slug;
          return (
            <Link
              key={root.id}
              to="/menu"
              search={{ ...searchParams, category: root.slug }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
              }`}
            >
              📁 {root.name}
            </Link>
          );
        })}
      </div>

      {/* Sub-categories row if active node has children */}
      {activeNode?.children && activeNode.children.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pl-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
            Nhóm con:
          </span>
          {activeNode.children.map((child) => (
            <Link
              key={child.id}
              to="/menu"
              search={{ ...searchParams, category: child.slug }}
              className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/80 hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
export default CategorySelector;
