import Link from 'next/link';
import { useLocale } from 'next-intl';

export default function NotFound() {
  return (
    <div className="pt-24 min-h-screen flex items-center justify-center bg-cream">
      <div className="text-center px-6">
        <div className="font-display text-[10rem] font-light text-bone leading-none mb-4">404</div>
        <h1 className="font-display text-3xl font-light mb-4">Page Not Found</h1>
        <div className="gold-divider mx-auto mb-6" />
        <p className="text-sm text-mist mb-8">The page you are looking for does not exist.</p>
        <Link href="/en" className="btn-primary">
          Return Home
        </Link>
      </div>
    </div>
  );
}
