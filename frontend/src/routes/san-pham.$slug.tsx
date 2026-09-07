import { useState, useEffect } from 'react';
import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { Star, ArrowLeft, ShoppingBag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductReviews } from '@/components/reviews/ProductReviews';
import { apiGet } from '@/lib/api';
import { vnd } from '@/lib/data';

export const Route = createFileRoute('/san-pham/$slug')({
  head: ({ params }) => ({
    meta: [
      { title: `Sản phẩm — ${params.slug} — Trà Trái Cây Tô` },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    loadProduct();
  }, [slug]);

  async function loadProduct() {
    try {
      setLoading(true);
      const data = await apiGet<any>(`/catalog/products/${slug}`);
      setProduct(data);
    } catch (err) {
      setError('Không thể tải thông tin sản phẩm');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-2 h-64 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-gray-500">{error || 'Không tìm thấy sản phẩm'}</p>
        <Link to="/menu" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Quay lại menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          to="/menu"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Menu
        </Link>
      </div>

      {/* Product Header */}
      <div className="mb-6 flex flex-col gap-6 sm:flex-row">
        <div className="flex h-64 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 sm:w-64">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <ShoppingBag className="h-16 w-16 text-amber-300" />
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          {product.description && (
            <p className="mt-2 text-sm text-gray-600">{product.description}</p>
          )}

          <div className="mt-4 flex items-center gap-4">
            {product.rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-medium">{Number(product.rating).toFixed(1)}</span>
                <span className="text-sm text-gray-400">
                  ({product.review_count || 0} đánh giá)
                </span>
              </div>
            )}
            {product.calories > 0 && (
              <Badge variant="secondary" className="text-xs">
                {product.calories} cal
              </Badge>
            )}
          </div>

          <div className="mt-4">
            <span className="text-2xl font-bold text-amber-600">
              {vnd(product.price_range?.min || product.price || 0)}
            </span>
            {product.price_range?.max && product.price_range.max !== product.price_range.min && (
              <span className="ml-1 text-sm text-gray-400">
                — {vnd(product.price_range.max)}
              </span>
            )}
          </div>

          <div className="mt-4">
            <Link to="/menu">
              <Button>
                <ShoppingBag className="mr-1 h-4 w-4" />
                Đặt món ngay
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs: Info & Reviews */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="reviews">
            Đánh giá
            {product.review_count > 0 && (
              <Badge variant="secondary" className="ml-2">
                {product.review_count}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="rounded-lg border bg-white p-6">
            {product.description ? (
              <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
            ) : (
              <p className="text-sm text-gray-400">Chưa có thông tin chi tiết</p>
            )}

            {product.fruit_group && (
              <div className="mt-4">
                <span className="text-xs font-medium text-gray-500">Nhóm trái cây:</span>
                <Badge variant="outline" className="ml-2">{product.fruit_group}</Badge>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <ProductReviews productId={product.id} apiGet={apiGet} />
        </TabsContent>
      </Tabs>
    </div>
  );
}