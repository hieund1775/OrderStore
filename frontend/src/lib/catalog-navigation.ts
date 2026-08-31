import { useQuery } from '@tanstack/react-query';
import { fetchPublicCategoryTree, type PublicCategoryNode } from '@/lib/api';

export const publicCategoryTreeQueryKey = ['public-catalog', 'category-tree'] as const;

export function usePublicCategoryTree(storeId?: number | string | null) {
  return useQuery<PublicCategoryNode[], Error>({
    queryKey: ['public-catalog', 'category-tree', storeId ? String(storeId) : 'all'],
    queryFn: () => fetchPublicCategoryTree(storeId),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount) => failureCount < 2,
  });
}

export type CatalogCategoryLike = {
  id: number;
  name: string;
  parent_id: number | null;
  depth: number;
};

export function getRootCategories<T extends CatalogCategoryLike>(categories: T[]): T[] {
  return categories.filter((category) => category.parent_id == null && Number(category.depth || 0) === 0);
}

export function getChildrenByParentId(
  categories: PublicCategoryNode[],
  parentId: number,
): PublicCategoryNode[] {
  const directMatch = categories.filter((cat) => Number(cat.parent_id) === Number(parentId));
  if (directMatch.length > 0) return directMatch;
  const parentNode = categories.find((cat) => Number(cat.id) === Number(parentId));
  if (parentNode?.children && parentNode.children.length > 0) {
    return parentNode.children;
  }
  return [];
}

export function shouldUseMegaMenu(categories: PublicCategoryNode[]): boolean {
  if (!Array.isArray(categories) || categories.length === 0) return false;
  const roots = getRootCategories(categories);
  if (roots.length < 3) return false;

  const rootsWithChildren = roots.filter((root) => {
    if (Array.isArray(root.children) && root.children.length > 0) {
      return true;
    }
    return getChildrenByParentId(categories, root.id).length > 0;
  });

  return roots.length >= 3 && rootsWithChildren.length >= 2;
}

export function isCategoryActive(slug: string, currentCategorySlug?: string): boolean {
  if (!currentCategorySlug || !slug) return false;
  return slug.trim().toLowerCase() === currentCategorySlug.trim().toLowerCase();
}

export function isRootCategoryActive(root: PublicCategoryNode, currentCategorySlug?: string): boolean {
  if (!currentCategorySlug) return false;
  if (isCategoryActive(root.slug, currentCategorySlug)) return true;
  if (root.children && root.children.length > 0) {
    return root.children.some((child) => isCategoryActive(child.slug, currentCategorySlug));
  }
  return false;
}


export function collectCategorySubtreeIds<T extends CatalogCategoryLike>(
  categories: T[],
  rootId: number,
): Set<number> {
  const ids = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (
        category.parent_id != null &&
        ids.has(Number(category.parent_id)) &&
        !ids.has(Number(category.id))
      ) {
        ids.add(Number(category.id));
        changed = true;
      }
    }
  }
  return ids;
}

export function getLeafCategories<T extends CatalogCategoryLike>(categories: T[]): T[] {
  const parentIds = new Set(
    categories
      .map((category) => category.parent_id)
      .filter((parentId): parentId is number => parentId != null)
      .map(Number),
  );
  return categories.filter((category) => !parentIds.has(Number(category.id)));
}

export function buildCategoryBreadcrumb<T extends CatalogCategoryLike>(
  categories: T[],
  categoryId: number,
): string {
  const byId = new Map(categories.map((category) => [Number(category.id), category]));
  const labels: string[] = [];
  const visited = new Set<number>();
  let current = byId.get(Number(categoryId));

  while (current && !visited.has(Number(current.id))) {
    visited.add(Number(current.id));
    labels.unshift(current.name);
    current = current.parent_id == null ? undefined : byId.get(Number(current.parent_id));
  }

  return labels.join(' / ');
}
