import { createFileRoute } from '@tanstack/react-router';
import { AdminCatalogPage } from './admin.catalog';

export const Route = createFileRoute('/admin/catalog/packing')({
  component: () => <AdminCatalogPage lane="packing" />,
});
