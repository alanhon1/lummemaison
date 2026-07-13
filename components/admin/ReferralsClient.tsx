'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { createReferralCode, updateReferralCode, toggleReferralCode } from '@/app/manzura/referrals/actions';

export interface ReferralCode {
  id: number;
  code: string;
  influencer_name: string;
  notes: string | null;
  clicks: number;
  active: boolean;
  created_at: string;
}

export interface ReferralOrder {
  id: number;
  display: string;
  status: string;
  customer_name: string;
  total_cents: number;
  currency: string;
  created_at: string;
  referral_code: string;
}

export interface ReferralSignup {
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
  referral_code: string;
}

interface Props {
  codes: ReferralCode[];
  orders: ReferralOrder[];
  signups: ReferralSignup[];
}

const STATUS_LABEL: Record<string, string> = {
  quote_pending: 'Quote pending',
  awaiting_payment: 'Awaiting payment',
  order_received: 'Received',
  payment_verified: 'Verified',
  packaging: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// One-click copy of the shareable link for a code (what you paste to the
// influencer). Uses the current origin so it works on any deployment.
function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    const link = `${window.location.origin}/?ref=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy the link:', link);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy https://lumeemaison.com/?ref=${code}`}
      className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] font-sans font-medium transition-colors ${
        copied ? 'border-green-600 text-green-700' : 'border-bone text-mist hover:border-gold hover:text-gold-dark'
      }`}
    >
      {copied ? 'Copied ✓' : 'Copy link'}
    </button>
  );
}

export default function ReferralsClient({ codes, orders, signups }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ReferralCode | null>(null);
  // One panel open at a time: either a code's orders or its signups.
  const [expanded, setExpanded] = useState<{ id: number; kind: 'orders' | 'signups' } | null>(null);
  const [formError, setFormError] = useState('');
  const [isPending, startTransition] = useTransition();

  const ordersByCode = new Map<string, ReferralOrder[]>();
  for (const o of orders) {
    const arr = ordersByCode.get(o.referral_code) ?? [];
    arr.push(o);
    ordersByCode.set(o.referral_code, arr);
  }

  const signupsByCode = new Map<string, ReferralSignup[]>();
  for (const s of signups) {
    const arr = signupsByCode.get(s.referral_code) ?? [];
    arr.push(s);
    signupsByCode.set(s.referral_code, arr);
  }

  function togglePanel(id: number, kind: 'orders' | 'signups') {
    setExpanded(expanded?.id === id && expanded.kind === kind ? null : { id, kind });
  }

  function openCreate() {
    setEditing(null);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(c: ReferralCode) {
    setEditing(c);
    setFormError('');
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setFormError('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = editing ? await updateReferralCode(editing.id, fd) : await createReferralCode(fd);
      if (!result.ok) { setFormError(result.error); return; }
      closeForm();
    });
  }

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => { await toggleReferralCode(id, !current); });
  }

  const inputCls = 'w-full border border-bone rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-charcoal';
  const labelCls = 'block text-xs font-semibold tracking-wide text-mist uppercase mb-1';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display italic text-2xl text-charcoal">Referrals</h1>
          <p className="text-xs text-mist mt-0.5">
            {codes.length} code{codes.length !== 1 ? 's' : ''} — share links as{' '}
            <span className="font-mono">lumeemaison.com/?ref=code</span>
          </p>
        </div>
        <button onClick={() => (showForm ? closeForm() : openCreate())} className="btn-gold text-xs">
          {showForm ? 'Cancel' : '+ New Code'}
        </button>
      </div>

      {showForm && (
        <form
          key={editing ? `edit-${editing.id}` : 'new'}
          onSubmit={handleSubmit}
          className="bg-white border border-bone rounded-lg p-5 mb-6 space-y-4"
        >
          <h2 className="font-display italic text-lg text-charcoal">
            {editing ? `Edit “${editing.code}”` : 'New Referral Code'}
          </h2>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Code *</label>
              {editing ? (
                <>
                  <input value={editing.code} disabled className={`${inputCls} lowercase opacity-60`} />
                  <p className="text-[10px] text-mist mt-1">The code can’t change — past orders reference it.</p>
                </>
              ) : (
                <>
                  <input name="code" required placeholder="missabby" className={`${inputCls} lowercase`} />
                  <p className="text-[10px] text-mist mt-1">2–64 chars, a-z / 0-9 / - / _. Case-insensitive.</p>
                </>
              )}
            </div>
            <div>
              <label className={labelCls}>Influencer Name *</label>
              <input name="influencer_name" required placeholder="MissAbby" defaultValue={editing?.influencer_name ?? ''} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes (internal)</label>
              <input name="notes" placeholder="Instagram, promo products sent June…" defaultValue={editing?.notes ?? ''} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="text-xs px-3 py-1.5 text-mist hover:text-charcoal">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn-gold text-xs">
              {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create Code'}
            </button>
          </div>
        </form>
      )}

      {codes.length === 0 ? (
        <div className="bg-white border border-bone rounded-lg p-8 text-center text-sm text-mist italic">
          No referral codes yet. Create one above.
        </div>
      ) : (
        <div className="bg-white border border-bone rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bone bg-cream text-xs font-semibold tracking-wide text-mist uppercase">
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Influencer</th>
                <th className="text-right px-4 py-3">Clicks</th>
                <th className="text-right px-4 py-3">Signups</th>
                <th className="text-right px-4 py-3">Orders</th>
                <th className="text-right px-4 py-3">Order Value</th>
                <th className="text-center px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => {
                const codeOrders = ordersByCode.get(c.code.toLowerCase()) ?? [];
                const codeSignups = signupsByCode.get(c.code.toLowerCase()) ?? [];
                // Totals exclude cancelled orders; the expanded list shows everything.
                const counted = codeOrders.filter(o => o.status !== 'cancelled');
                const valueCents = counted.reduce((sum, o) => sum + o.total_cents, 0);
                const ordersOpen = expanded?.id === c.id && expanded.kind === 'orders';
                const signupsOpen = expanded?.id === c.id && expanded.kind === 'signups';
                return (
                  <React.Fragment key={c.id}>
                    <tr className="border-b border-bone last:border-0 hover:bg-cream/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-charcoal">
                          {c.code}
                          <CopyLinkButton code={c.code} />
                        </div>
                        {c.notes && <div className="text-xs text-mist">{c.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-charcoal">{c.influencer_name}</td>
                      <td className="px-4 py-3 text-right text-charcoal">{c.clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => togglePanel(c.id, 'signups')}
                          disabled={codeSignups.length === 0}
                          className="text-charcoal underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
                          title={codeSignups.length > 0 ? (signupsOpen ? 'Hide signups' : 'Show signups') : 'No signups yet'}
                        >
                          {codeSignups.length}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => togglePanel(c.id, 'orders')}
                          disabled={codeOrders.length === 0}
                          className="text-charcoal underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
                          title={codeOrders.length > 0 ? (ordersOpen ? 'Hide orders' : 'Show orders') : 'No orders yet'}
                        >
                          {counted.length}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-charcoal">{usd(valueCents)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(c.id, c.active)}
                          disabled={isPending}
                          className={`w-10 h-5 rounded-full transition-colors ${c.active ? 'bg-gold' : 'bg-bone'}`}
                          title={c.active ? 'Deactivate' : 'Activate'}
                        >
                          <span className={`block w-4 h-4 rounded-full bg-white mx-auto shadow transition-transform ${c.active ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(c)}
                          disabled={isPending}
                          className="text-xs text-charcoal hover:text-gold-dark disabled:opacity-30"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                    {signupsOpen && codeSignups.length > 0 && (
                      <tr className="border-b border-bone last:border-0 bg-cream/40">
                        <td colSpan={8} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-mist uppercase tracking-wide">
                                <th className="text-left py-1 pr-4">Customer</th>
                                <th className="text-left py-1 pr-4">Email</th>
                                <th className="text-left py-1">Joined</th>
                              </tr>
                            </thead>
                            <tbody>
                              {codeSignups.map(s => (
                                <tr key={s.user_id} className="text-charcoal">
                                  <td className="py-1 pr-4">
                                    <Link href={`/manzura/users/${s.user_id}`} className="hover:text-gold-dark hover:underline">
                                      {s.full_name || '—'}
                                    </Link>
                                  </td>
                                  <td className="py-1 pr-4">{s.email || '—'}</td>
                                  <td className="py-1">{new Date(s.created_at).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="text-[10px] text-mist mt-2">Customers who signed up after landing on this code’s link (tracked from July 2026).</p>
                        </td>
                      </tr>
                    )}
                    {ordersOpen && codeOrders.length > 0 && (
                      <tr className="border-b border-bone last:border-0 bg-cream/40">
                        <td colSpan={8} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-mist uppercase tracking-wide">
                                <th className="text-left py-1 pr-4">Order</th>
                                <th className="text-left py-1 pr-4">Date</th>
                                <th className="text-left py-1 pr-4">Customer</th>
                                <th className="text-right py-1 pr-4">Total</th>
                                <th className="text-left py-1">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {codeOrders.map(o => (
                                <tr key={o.id} className={o.status === 'cancelled' ? 'text-mist line-through' : 'text-charcoal'}>
                                  <td className="py-1 pr-4">
                                    <Link href={`/manzura/orders/${o.id}`} className="font-mono hover:text-gold-dark hover:underline">
                                      {o.display}
                                    </Link>
                                  </td>
                                  <td className="py-1 pr-4">{new Date(o.created_at).toLocaleDateString()}</td>
                                  <td className="py-1 pr-4">{o.customer_name}</td>
                                  <td className="py-1 pr-4 text-right">{usd(o.total_cents)}</td>
                                  <td className="py-1">{STATUS_LABEL[o.status] ?? o.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="text-[10px] text-mist mt-2">Cancelled orders are listed but excluded from the totals above.</p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
