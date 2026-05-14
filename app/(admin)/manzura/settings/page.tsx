'use client';

import { useState } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/lib/site-config';

export default function SettingsPage() {
  const [form, setForm] = useState({
    email: siteConfig.contact.email,
    phone: siteConfig.contact.phone,
    whatsapp: siteConfig.contact.whatsapp,
    telegram: siteConfig.contact.telegram,
    waLink: siteConfig.social.whatsapp,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-light text-charcoal">Settings</h1>
        <Link href="/manzura" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2">← Dashboard</Link>
      </div>
      <div className="bg-white border border-bone p-6 space-y-5">
        {[
          { key: 'email', label: 'Contact Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'whatsapp', label: 'WhatsApp Number' },
          { key: 'telegram', label: 'Telegram Handle' },
          { key: 'waLink', label: 'WhatsApp Link (wa.me/...)' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-mist mb-1.5">{f.label}</label>
            <input
              value={form[f.key as keyof typeof form]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>
        ))}
        <div className="flex items-center gap-4 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-gold text-xs disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-xs text-green-600">Saved! Redeploy to apply.</span>}
        </div>
      </div>
    </div>
  );
}
