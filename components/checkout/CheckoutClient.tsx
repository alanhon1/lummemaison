'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { siteConfig } from '@/lib/site-config';

function generateOrderId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LUM-${dateStr}-${rand}`;
}

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Azerbaijan',
  'Bangladesh', 'Belgium', 'Bosnia and Herzegovina', 'Brazil', 'Bulgaria',
  'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Ecuador', 'Egypt', 'Estonia',
  'Finland', 'France', 'Georgia', 'Germany', 'Greece', 'Hungary',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Japan', 'Jordan', 'Kazakhstan', 'Kuwait', 'Latvia', 'Lebanon', 'Lithuania',
  'Malaysia', 'Malta', 'Mexico', 'Moldova', 'Mongolia', 'Morocco',
  'Netherlands', 'New Zealand', 'Nigeria', 'Norway',
  'Oman', 'Pakistan', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Serbia', 'Singapore',
  'Slovakia', 'Slovenia', 'South Africa', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
  'Taiwan', 'Thailand', 'Turkey', 'UAE', 'UK', 'Ukraine', 'USA',
  'Uzbekistan', 'Venezuela', 'Vietnam',
];

export default function CheckoutClient() {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCartStore();

  const [form, setForm] = useState({
    firstName: '', lastName: '', company: '',
    email: '', phone: '', country: '',
    address: '', city: '', state: '', zip: '',
    paymentMethod: 'wise',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isKorea, setIsKorea] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'country') {
      setIsKorea(value === 'South Korea' || value === 'Korea');
    }
    setErrors(prev => ({ ...prev, [name]: '' }));
  }

  function validate() {
    const required = ['firstName', 'lastName', 'email', 'phone', 'country', 'address', 'city'];
    const newErrors: Record<string, string> = {};
    for (const field of required) {
      if (!form[field as keyof typeof form]) {
        newErrors[field] = t('required');
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || isKorea) return;

    const orderId = generateOrderId();
    const orderData = { ...form, orderId, items: items, total: totalPrice() };
    localStorage.setItem('lumiere_order', JSON.stringify(orderData));

    router.push(`/${locale}/payment?order=${orderId}`);
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="font-display text-2xl font-light mb-4">Your cart is empty</p>
        <button
          onClick={() => router.push(`/${locale}/catalogue`)}
          className="btn-primary"
        >
          Browse Catalogue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Shipping Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-bone rounded-sm p-6">
          <h2 className="font-display text-xl font-light mb-6">{t('shipping')}</h2>

          <div className="grid grid-cols-2 gap-4">
            <InputField name="firstName" label={t('firstName')} value={form.firstName} onChange={handleChange} error={errors.firstName} />
            <InputField name="lastName" label={t('lastName')} value={form.lastName} onChange={handleChange} error={errors.lastName} />
          </div>
          <div className="mt-4">
            <InputField name="company" label={`${t('company')} (optional)`} value={form.company} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <InputField name="email" label={t('email')} type="email" value={form.email} onChange={handleChange} error={errors.email} />
            <InputField name="phone" label={t('phone')} type="tel" value={form.phone} onChange={handleChange} error={errors.phone} />
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
              {t('country')}
            </label>
            <select
              name="country"
              value={form.country}
              onChange={handleChange}
              className={`w-full border px-4 py-3 text-sm outline-none transition-colors bg-white ${
                errors.country ? 'border-red-400' : 'border-bone focus:border-gold'
              }`}
            >
              <option value="">Select Country</option>
              {COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
          </div>

          {isKorea && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{t('koreaRestriction')}</p>
            </div>
          )}

          <div className="mt-4">
            <InputField name="address" label={t('address')} value={form.address} onChange={handleChange} error={errors.address} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <InputField name="city" label={t('city')} value={form.city} onChange={handleChange} error={errors.city} />
            <InputField name="state" label={t('state')} value={form.state} onChange={handleChange} />
            <InputField name="zip" label={t('zip')} value={form.zip} onChange={handleChange} />
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white border border-bone rounded-sm p-6">
          <h2 className="font-display text-xl font-light mb-6">{t('paymentMethod')}</h2>
          <div className="space-y-3">
            {[
              { value: 'wise', label: t('wise'), desc: 'Bank transfer via Wise app' },
              { value: 'usdt', label: t('usdt'), desc: 'USDT on TRC-20 network' },
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-4 border cursor-pointer transition-colors ${
                  form.paymentMethod === opt.value ? 'border-gold bg-gold/5' : 'border-bone hover:border-gold/50'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={opt.value}
                  checked={form.paymentMethod === opt.value}
                  onChange={handleChange}
                  className="accent-gold"
                />
                <div>
                  <div className="text-sm font-semibold text-charcoal">{opt.label}</div>
                  <div className="text-xs text-mist">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-white border border-bone rounded-sm p-6 h-fit sticky top-24">
        <h2 className="font-display text-xl font-light mb-6">{t('orderSummary')}</h2>
        <div className="space-y-2 mb-6 pb-6 border-b border-bone max-h-60 overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-xs">
              <span className="text-mist line-clamp-1 flex-1 mr-2">
                {item.name} × {item.quantity}
              </span>
              <span className="font-semibold flex-shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 mb-8">
          <div className="flex justify-between text-xs">
            <span className="text-mist">Subtotal</span>
            <span>${totalPrice().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mist">{t('shippingFee')}</span>
            <span className="text-mist">Calculated separately</span>
          </div>
          <div className="flex justify-between pt-3 border-t border-bone">
            <span className="font-semibold">{t('total')}</span>
            <span className="font-display text-xl font-light">${totalPrice().toFixed(2)}</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={isKorea}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('placeOrder')}
        </button>
      </div>
    </form>
  );
}

function InputField({
  name, label, type = 'text', value, onChange, error
}: {
  name: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full border px-4 py-3 text-sm outline-none transition-colors bg-white ${
          error ? 'border-red-400' : 'border-bone focus:border-gold'
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
