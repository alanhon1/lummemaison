import type { Product } from '@/lib/products';
import {
  getLocalizedDescription,
  getLocalizedIndication,
  getLocalizedPackaging,
  getLocalizedProtocol,
} from '@/lib/products';

interface Props {
  product: Product;
  locale: string;
  labels: {
    description: string;
    indication: string;
    packaging: string;
    protocol: string;
  };
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-2">
        {label}
      </h3>
      <p className="text-sm text-charcoal leading-relaxed whitespace-pre-line">
        {body || '—'}
      </p>
    </div>
  );
}

export default function ProductDetailContent({ product, locale, labels }: Props) {
  const description = getLocalizedDescription(product, locale);
  const indication = getLocalizedIndication(product, locale);
  const packaging = getLocalizedPackaging(product, locale);
  const protocol = getLocalizedProtocol(product, locale);

  return (
    <section className="mt-10 bg-white border border-bone rounded-sm p-8">
      <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">
        {labels.description}
      </h3>
      <p className="text-sm text-charcoal leading-relaxed whitespace-pre-line mb-6">
        {description || '—'}
      </p>

      <div className="gold-divider mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Block label={labels.indication} body={indication} />
        <Block label={labels.packaging} body={packaging} />
        <Block label={labels.protocol} body={protocol} />
      </div>
    </section>
  );
}
