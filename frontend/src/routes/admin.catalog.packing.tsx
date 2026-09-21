import { createFileRoute } from '@tanstack/react-router';
import { AdminCatalogPage } from './admin.catalog';

export const Route = createFileRoute('/admin/catalog/packing')({
  validateSearch: (search: Record<string, unknown>) => ({
    rootId: typeof search.rootId === 'string' ? search.rootId : undefined,
  }),
  component: () => <AdminCatalogPage lane="packing" />,
});
