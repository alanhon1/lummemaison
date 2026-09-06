'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useProductCap } from '@/lib/cap-store';
import { useCurrencyStore, formatPrice } from '@/lib/currency-store';
import { getLocalizedSpecification, getGroupRange, purchaseBlockReason, purchaseBlockLabel, type Product } from '@/lib/products';
import { localePath } from '@/lib/i18n';
import ProductImage from './ProductImage';
import RequestModal from './RequestModal';

interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'list';
  variantCount?: number;
  isBundle?: boolean;
  /** Active catalogue search query — when it matches a product tag, that tag is shown as a gold #chip. */
  searchQuery?: string;
}

// Tags whose text contains the (de-#'d, de-spaced) search query — surfaced as gold #chips.
function matchedTags(tags: string[] | undefined, query: string | undefined): string[] {
  if (!query || !tags?.length) return [];
  const q = query.toLowerCase().replace(/#/g, '').replace(/\s+/g, '');
  if (!q) return [];
  return tags.filter(t => t.toLowerCase().replace(/\s+/g, '').includes(q)).slice(0, 4);
}

function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {tags.map(t => (
        <span
          key={t}
          className="text-[10px] leading-none text-gold bg-gold/10 border border-gold/30 rounded-full px-2 py-0.5"
        >
          #{t.replace(/\s+/g, '')}
        </span>
      ))}
    </div>
  );
}

// Integer percent off, or 0 when there's no valid discount. The real `price` is
// always what the customer pays; `originalPrice` is the higher struck-through "was".
function discountPct(product: Pick<Product, 'price' | 'originalPrice'>): number {
  const o = product.originalPrice;
  if (typeof o !== 'number' || o <= product.price || product.price <= 0) return 0;
  return Math.round((o - product.price) / o * 100);
}

// Struck-through "was" price next to the current price. The percent-off is shown
// separately as the corner badge on the image.
function WasPrice({ price, originalPrice, currency }: { price: number; originalPrice?: number; currency: Parameters<typeof formatPrice>[1] }) {
  if (!(typeof originalPrice === 'number') || originalPrice <= price || price <= 0) return null;
  return (
    <span className="text-xs text-mist line-through ml-1.5">
      {formatPrice(originalPrice, currency)}
    </span>
  );
}

function rememberCatalogueUrl() {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.includes('/catalogue')) return;
  try {
    sessionStorage.setItem('catalogue:lastUrl', window.location.pathname + window.location.search);
  } catch {
    // sessionStorage can throw in private mode — ignore.
  }
}

export default function ProductCard({ product, layout = 'grid', variantCount = 1, isBundle = false, searchQuery }: ProductCardProps) {
  const t = useTranslations('catalogue');
  const tProduct = useTranslations('product');
  const locale = useLocale();
  const { addItem, items } = useCartStore();
  const { currency } = useCurrencyStore();
  const [requestOpen, setRequestOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [perOrderHit, setPerOrderHit] = useState(false);
  // Purchase is gated by the "Not for sale" flag, the "Available for order"
  // switch (purchaseBlockReason), AND availability. A single product with
  // nothing available is out of stock — the quick-add becomes "Make a request"
  // instead. Group cards aggregate variants so we don't stock-gate them here.
  const blockReason = purchaseBlockReason(product);
  const tagChips = matchedTags(product.tags, searchQuery);
  const pct = discountPct(product);

  const isGroup = variantCount > 1;
  const displayName = isGroup && product.groupName ? product.groupName : product.name;
  const displayImage = isGroup && product.groupImage ? product.groupImage : product.image;
  const range = isGroup && product.groupId ? getGroupRange(product.groupId) : null;
  const displayId =
    range && range.max !== range.min
      ? (range.max - range.min > 50 ? `#${range.min}+` : `#${range.min}-${range.max}`)
      : `#${product.id}`;

  // Cart already holds this many of the (option-less) quick-add line. The
  // detail page and cart cap their steppers; without this the card's + could
  // be tapped past the stock count.
  const inCart = items.find(i => i.id === product.id && !i.option)?.quantity ?? 0;

  // Purchase limits, quantity-relative and free of any stock number: the server
  // answers "may one more be added?" and which constraint binds, never how many
  // are left. `undefined` while loading — treated as "allow", since createOrder
  // is the authoritative guard.
  const cap = useProductCap(product.id, '', inCart);
  const atLimit = cap ? !cap.canAdd : false;
  const perOrderBinding = cap?.limitReason === 'perOrder';
  const outOfStock = !blockReason && !isGroup && (cap?.outOfStock ?? false);
  const cannotBuy = blockReason !== null || outOfStock;
  const blockLabel = blockReason ? purchaseBlockLabel(blockReason) : outOfStock ? 'Out of stock' : '';

  // Banners are DERIVED, not set from an effect: `justAdded` is flipped by the
  // click (an event), the refreshed cap answer arrives a moment later, and the
  // message shows only while both hold. That way we never need the stock number
  // to know the customer just took the last unit we allow.
  const showLastOne = justAdded && atLimit && !perOrderBinding;
  const showPerOrderHit = perOrderHit || (justAdded && atLimit && perOrderBinding);

  function handleAddToCart(e: React.MouseEvent) {
    // Products with purchase options (e.g. needle length) can't be quick-added
    // from the card — let the click fall through to the card link so the
    // customer picks the option on the product page.
    if (product.options && product.options.length > 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (blockReason) return; // not for sale / unavailable — no action
    if (outOfStock) { setRequestOpen(true); return; } // out of stock → request demand
    if (atLimit) {
      // Cart already holds all we allow for this line.
      if (perOrderBinding) { setPerOrderHit(true); setTimeout(() => setPerOrderHit(false), 4000); return; }
      setRequestOpen(true); // stock-limited → request more
      return;
    }
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      specification: product.specification,
    });
    // The refreshed cap answer (the hook refetches as `inCart` changes) decides
    // whether that was the last unit we allow; this just opens the window in
    // which such a message may show.
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 4000);
  }

  if (layout === 'list') {
    return (
      <>
      <Link
        href={localePath(locale, `/product/${product.id}`)}
        onClick={rememberCatalogueUrl}
        className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-bone rounded-md hover:border-gold transition-all duration-300 group"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 relative overflow-hidden">
          <ProductImage
            src={displayImage}
            alt={displayName}
            productId={product.id}
            categoryId={product.categoryId}
            fill
            sizes="(max-width: 640px) 64px, 80px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex gap-1.5 mb-1.5">
                {isBundle && <span className="badge-bundle">BUNDLE</span>}
                {pct > 0 && <span className="badge-discount">−{pct}%</span>}
                {product.isNew && <span className="badge-new">{tProduct('tags.new')}</span>}
                {product.isBestSeller && <span className="badge-best">{tProduct('tags.bestSeller')}</span>}
              </div>
              <h3 className="text-sm font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight">
                {displayId} {displayName}
              </h3>
              {variantCount > 1 && (
                <p className="text-[10px] text-gold/80 font-medium tracking-wide mt-0.5">
                  {variantCount} options
                </p>
              )}
              {product.specification && (
                <p className="text-sm text-mist mt-1 line-clamp-1">{getLocalizedSpecification(product, locale)}</p>
              )}
              {tagChips.length > 0 && <div className="mt-1.5"><TagChips tags={tagChips} /></div>}
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="font-display text-lg font-light text-charcoal">
                {formatPrice(product.price, currency)}
              </div>
              <WasPrice price={product.price} originalPrice={product.originalPrice} currency={currency} />
              {product.moq > 1 && (
                <div className="text-xs text-mist">MOQ: {product.moq}</div>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={blockReason !== null}
          className="self-center flex-shrink-0 w-9 h-9 border border-bone rounded-md flex items-center justify-center hover:border-gold hover:text-gold text-charcoal transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-bone disabled:hover:text-charcoal"
          aria-label={blockReason ? blockLabel : outOfStock ? 'Make a request' : t('addToCart')}
        >
          <ShoppingBag size={16} />
        </button>
      </Link>
      {requestOpen && (
        <RequestModal productId={product.id} productName={product.name} onClose={() => setRequestOpen(false)} />
      )}
      {showLastOne && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] rounded-md bg-charcoal px-4 py-3 text-xs text-cream shadow-lg">
          Maximum available reached — that&apos;s all we can supply right now, and it&apos;s in your cart.
        </div>
      )}
      {showPerOrderHit && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] rounded-md bg-charcoal px-4 py-3 text-xs text-cream shadow-lg">
          Limited to {cap?.perOrder} per order — that&apos;s all in your cart. You can order again later.
        </div>
      )}
      </>
    );
  }

  return (
    <>
    <Link
      href={localePath(locale, `/product/${product.id}`)}
      onClick={rememberCatalogueUrl}
      className="product-card group block"
    >
      {/* Image */}
      <div className="aspect-square relative overflow-hidden">
        <ProductImage
          src={displayImage}
          alt={displayName}
          productId={product.id}
          categoryId={product.categoryId}
          fill
          className="group-hover:scale-110 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />

        {/* Badges — mobile: first only (priority sold-out > sale > new > best > bundle); desktop: all */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {(() => {
            const all = [
              cannotBuy && (
                <span
                  key="nfs"
                  className={`text-[10px] uppercase tracking-widest px-2 py-0.5 text-cream ${blockReason === 'notForSale' ? 'bg-charcoal/80' : 'bg-rose-600/90'}`}
                >
                  {blockLabel}
                </span>
              ),
              pct > 0 && <span key="s" className="badge-discount">−{pct}%</span>,
              product.isNew && <span key="n" className="badge-new">{tProduct('tags.new')}</span>,
              product.isBestSeller && <span key="b" className="badge-best">{tProduct('tags.bestSeller')}</span>,
              isBundle && <span key="bd" className="badge-bundle">BUNDLE</span>,
            ].filter(Boolean) as React.ReactElement[];
            if (all.length === 0) return null;
            return (
              <>
                <div className="md:hidden">{all[0]}</div>
                <div className="hidden md:flex md:flex-col md:gap-1">{all}</div>
              </>
            );
          })()}
        </div>

        {/* Quick Add overlay — desktop only (hover-based) */}
        <div className="hidden md:block absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <button
            onClick={handleAddToCart}
            disabled={blockReason !== null}
            className="w-full btn-gold text-[10px] py-2.5 flex items-center justify-center gap-2 disabled:bg-charcoal disabled:opacity-100"
          >
            <ShoppingBag size={13} />
            {blockReason ? blockLabel : outOfStock ? 'Make a request' : t('addToCart')}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 md:p-6">
        <p className="text-xs text-mist mb-1">{displayId}</p>
        <h3 className="text-sm md:text-base font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight line-clamp-2 mb-2">
          {displayName}
        </h3>
        <TagChips tags={tagChips} />
        {variantCount > 1 && (
          <p className="text-[10px] text-gold/80 font-medium tracking-wide mb-1">
            {variantCount} options available
          </p>
        )}
        {product.specification && (
          <p className="hidden md:block text-sm text-mist line-clamp-1 mb-3">{getLocalizedSpecification(product, locale)}</p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-display text-base md:text-lg font-light text-charcoal">
              {formatPrice(product.price, currency)}
            </span>
            <WasPrice price={product.price} originalPrice={product.originalPrice} currency={currency} />
            {product.moq > 1 && (
              <span className="text-xs text-mist ml-1.5">MOQ:{product.moq}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
    {requestOpen && (
      <RequestModal productId={product.id} productName={product.name} onClose={() => setRequestOpen(false)} />
    )}
    {showLastOne && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] rounded-md bg-charcoal px-4 py-3 text-xs text-cream shadow-lg">
        Maximum available reached — that&apos;s all we can supply right now, and it&apos;s in your cart.
      </div>
    )}
    {showPerOrderHit && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] rounded-md bg-charcoal px-4 py-3 text-xs text-cream shadow-lg">
        Limited to {cap?.perOrder} per order — that&apos;s all in your cart. You can order again later.
      </div>
    )}
    </>
  );
}
