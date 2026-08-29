import { useMemo, useState } from 'react';
import { Heart, Settings2, ShoppingCart, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useBranch } from '@/lib/branch';
import { DynamicProductConfigurator } from '@/components/catalog/DynamicProductConfigurator';
import {
  baseOptions,
  iceOptions,
  sizeOptions,
  sugarOptions,
  tagLabel,
  toppingOptions,
  vnd,
  type Product,
} from '@/lib/data';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { isFavorite, isPending, setFavorite } = useWishlist();
  const { selectedStore } = useBranch();
  const [open, setOpen] = useState(false);
  const liked = isFavorite(product.id);
  const pending = isPending(product.id);

  return (
    <>
      <article className="group bg-card flex flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-card-soft">
        <div className="relative aspect-square overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            width={640}
            height={640}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
            {product.tags.map((t) => (
              <Badge key={t} className="bg-card text-foreground rounded-full text-[10px] shadow-sm">
                {tagLabel[t]}
              </Badge>
            ))}
          </div>
          <button
            onClick={() => setFavorite(product, !liked)}
            disabled={pending}
            aria-label={liked ? `Bỏ ${product.name} khỏi yêu thích` : `Thêm ${product.name} vào yêu thích`}
            className="bg-card/90 disabled:opacity-50 absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full shadow-sm transition-transform active:scale-95"
          >
            <Heart
              className={`size-4 ${liked ? 'fill-berry text-berry' : 'text-muted-foreground'}`}
            />
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5 pt-2 sm:pt-2.5">
          <div className="space-y-1">
            {/* Row 1: Product Name */}
            <h3
              title={product.name}
              className="font-display line-clamp-2 text-sm sm:text-base font-bold leading-snug break-words"
            >
              {product.name}
            </h3>

            {/* Row 2: Base tea */}
            <p className="text-muted-foreground text-xs truncate">
              {product.base}
            </p>

            {/* Row 3: Rating & Reviews */}
            {(product.rating > 0 || product.reviews > 0) && (
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <Star className="fill-primary text-primary size-3.5 shrink-0" />
                <span className="text-foreground font-semibold">{product.rating}</span>
                <span className="truncate">· {Number(product.reviews || 0).toLocaleString('vi-VN')} đánh giá</span>
              </div>
            )}

            {/* Row 4: Price */}
            <p className="text-primary text-base sm:text-lg font-bold">
              {vnd(product.price)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-3 flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="soft"
              size="sm"
              aria-label="Thêm nhanh vào giỏ"
              className="h-9 px-2.5 sm:px-3 sm:flex-1 shrink-0 flex items-center justify-center gap-1.5"
              onClick={() => {
                if (product.slug) {
                  setOpen(true);
                  return;
                }
                const added = addItem({
                  storeId: selectedStore?.id,
                  storeName: selectedStore?.name,
                  storeDistrict: selectedStore?.district,
                  productId: product.id,
                  name: product.name,
                  image: product.image,
                  size: 'M',
                  base: product.base,
                  sugar: '100%',
                  ice: '100%',
                  toppings: [],
                  unitPrice: product.price,
                  qty: 1,
                });
                if (added) {
                  toast.success('Đã thêm vào giỏ', { description: product.name });
                }
              }}
            >
              <ShoppingCart className="size-4 shrink-0" />
              <span className="hidden sm:inline text-xs sm:text-sm">Thêm nhanh</span>
            </Button>
            <Button
              variant="hero"
              size="sm"
              className="h-9 flex-1 min-w-0 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5"
              onClick={() => setOpen(true)}
            >
              <Settings2 className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Tùy chọn</span>
            </Button>
          </div>
        </div>
      </article>

      {product.slug ? (
        <DynamicProductConfigurator
          productSlug={product.slug}
          storeId={selectedStore?.id}
          open={open}
          onOpenChange={setOpen}
          onAddToCart={(configured) => {
            addItem({
              storeId: selectedStore?.id,
              storeName: selectedStore?.name,
              storeDistrict: selectedStore?.district,
              productId: String(configured.productId),
              productSlug: configured.productSlug,
              name: configured.productName,
              image: configured.image || product.image,
              variantId: configured.variantId,
              sku: configured.sku,
              variantName: configured.variantName,
              stockMode: configured.stockMode,
              fulfillmentLane: configured.fulfillmentLane,
              size: configured.appliedModifiers.find((m) => m.attribute_code === 'size')?.value_code?.toUpperCase() || 'M',
              base: configured.appliedModifiers.find((m) => m.attribute_code === 'base')?.value_label || product.base,
              sugar: configured.appliedModifiers.find((m) => m.attribute_code === 'sugar')?.value_label || '100%',
              ice: configured.appliedModifiers.find((m) => m.attribute_code === 'ice')?.value_label || '100%',
              toppings: configured.appliedModifiers
                .filter((m) => m.attribute_code === 'toppings')
                .map((m) => m.value_label),
              appliedModifiers: configured.appliedModifiers,
              unitPrice: configured.unitPrice,
              qty: configured.quantity,
            });
          }}
        />
      ) : (
        <CustomizeDialog product={product} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}

function CustomizeDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { addItem } = useCart();
  const { selectedStore } = useBranch();
  const [size, setSize] = useState('M');
  const [base, setBase] = useState(baseOptions[0]);
  const [sugar, setSugar] = useState(sugarOptions[4]);
  const [ice, setIce] = useState(iceOptions[4]);
  const [toppings, setToppings] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);

  const unitPrice = useMemo(() => {
    const sizeExtra = sizeOptions.find((s) => s.id === size)?.extra ?? 0;
    const topExtra = toppingOptions
      .filter((t) => toppings.includes(t.id))
      .reduce((s, t) => s + t.price, 0);
    return product.price + sizeExtra + topExtra;
  }, [size, toppings, product.price]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="bg-accent/50 relative hidden md:block">
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="size-full object-cover"
            />
          </div>

          <div className="flex max-h-[92vh] flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-5 p-5">
                <div>
                  <h2 className="font-display text-xl font-bold">{product.name}</h2>
                  <p className="text-muted-foreground text-sm">{product.base}</p>
                  <p className="mt-2 text-sm leading-relaxed">{product.desc}</p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    ≈ {product.calories} kcal / ly size M
                  </p>
                </div>

                <OptionBlock title="Chọn size">
                  <RadioGroup
                    value={size}
                    onValueChange={setSize}
                    className="grid grid-cols-2 gap-2"
                  >
                    {sizeOptions.map((s) => (
                      <OptionRow key={s.id} value={s.id} id={`size-${s.id}`} label={s.label}>
                        {s.extra > 0 ? `+${vnd(s.extra)}` : 'Giá gốc'}
                      </OptionRow>
                    ))}
                  </RadioGroup>
                </OptionBlock>

                <OptionBlock title="Cốt trà nền">
                  <RadioGroup
                    value={base}
                    onValueChange={setBase}
                    className="grid gap-2 sm:grid-cols-3"
                  >
                    {baseOptions.map((b) => (
                      <OptionRow key={b} value={b} id={`base-${b}`} label={b} />
                    ))}
                  </RadioGroup>
                </OptionBlock>

                <OptionBlock title="Mức ngọt">
                  <RadioGroup
                    value={sugar}
                    onValueChange={setSugar}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {sugarOptions.map((s) => (
                      <OptionRow key={s} value={s} id={`sugar-${s}`} label={s} />
                    ))}
                  </RadioGroup>
                </OptionBlock>

                <OptionBlock title="Mức đá">
                  <RadioGroup
                    value={ice}
                    onValueChange={setIce}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {iceOptions.map((s) => (
                      <OptionRow key={s} value={s} id={`ice-${s}`} label={s} />
                    ))}
                  </RadioGroup>
                </OptionBlock>

                <OptionBlock title="Topping trái cây & thạch">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {toppingOptions.map((t) => (
                      <label
                        key={t.id}
                        htmlFor={`top-${t.id}`}
                        className="hover:border-primary flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm"
                      >
                        <Checkbox
                          id={`top-${t.id}`}
                          checked={toppings.includes(t.id)}
                          onCheckedChange={(c) =>
                            setToppings((prev) =>
                              c ? [...prev, t.id] : prev.filter((x) => x !== t.id),
                            )
                          }
                        />
                        <span className="flex-1">{t.label}</span>
                        <span className="text-muted-foreground text-xs">+{vnd(t.price)}</span>
                      </label>
                    ))}
                  </div>
                </OptionBlock>

                <OptionBlock title="Ghi chú cho barista">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="VD: Cho nhiều đá hơn một chút, nhiều tép cam…"
                    rows={2}
                  />
                </OptionBlock>
              </div>
            </ScrollArea>

            <div className="flex items-center gap-3 border-t p-4">
              <div className="flex items-center gap-1 rounded-full border px-2 py-1.5">
                <button className="px-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="w-6 text-center text-sm font-bold">{qty}</span>
                <button className="px-2" onClick={() => setQty((q) => q + 1)}>
                  +
                </button>
              </div>
              <Button
                variant="hero"
                className="flex-1"
                onClick={() => {
                  const added = addItem({
                    storeId: selectedStore?.id,
                    storeName: selectedStore?.name,
                    storeDistrict: selectedStore?.district,
                    productId: product.id,
                    name: product.name,
                    image: product.image,
                    size,
                    base,
                    sugar,
                    ice,
                    toppings: toppingOptions
                      .filter((t) => toppings.includes(t.id))
                      .map((t) => t.label),
                    note,
                    unitPrice,
                    qty,
                  });
                  if (added) {
                    toast.success('Đã thêm vào giỏ', { description: `${product.name} · ${size}` });
                    onOpenChange(false);
                  }
                }}
              >
                Thêm vào giỏ · {vnd(unitPrice * qty)}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OptionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-bold">{title}</h4>
      {children}
    </section>
  );
}

function OptionRow({
  value,
  id,
  label,
  children,
}: {
  value: string;
  id: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="hover:border-primary flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm"
    >
      <RadioGroupItem value={value} id={id} />
      <span className="flex-1">{label}</span>
      {children && <span className="text-muted-foreground text-xs">{children}</span>}
    </label>
  );
}
