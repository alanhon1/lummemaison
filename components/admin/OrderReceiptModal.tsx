'use client';

import { useState } from 'react';
import { X, Copy, Check, Download } from 'lucide-react';

interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_cents: number;
  line_cents: number;
}

interface ReceiptProps {
  orderId: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCode: string | null;
  shippingAddress: {
    street: string;
    city: string;
    state_province?: string | null;
    postal_code: string;
    country: string;
    countryName: string;
  };
  items: ReceiptItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
}

function fmtUSD(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

function buildPackagingText(props: ReceiptProps): string {
  const lines: string[] = [
    `No:   ${props.orderNumber}`,
    `Name: ${props.customerName}`,
    '',
    ...props.items.flatMap(it => [it.product_name, `Quantity: ${it.quantity}`, '']),
  ];
  return lines.join('\n').trimEnd();
}

export default function OrderReceiptModal(props: ReceiptProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const packagingText = buildPackagingText(props);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(packagingText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the textarea
    }
  }

  async function handleExcelDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/admin/orders/${props.orderId}/receipt`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${props.orderNumber}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs border border-bone text-mist hover:text-charcoal hover:border-charcoal px-4 py-2 rounded transition-colors"
      >
        Receipt
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white border border-bone rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-bone px-6 py-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-light text-charcoal">Receipt</h2>
              <button onClick={() => setOpen(false)} className="text-mist hover:text-charcoal">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order info */}
              <div className="border-b border-bone pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-mist mb-0.5">Order</p>
                    <p className="font-mono text-lg font-semibold text-charcoal">{props.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-mist mb-0.5">Date</p>
                    <p className="text-xs text-charcoal">{new Date(props.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* Customer + Ship to */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-2">Customer</p>
                  <div className="text-sm text-charcoal space-y-0.5">
                    <p className="font-semibold">{props.customerName}</p>
                    <p>{props.customerEmail}</p>
                    <p>{props.customerPhone}</p>
                    {props.customerCode && <p className="font-mono text-mist">{props.customerCode}</p>}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-2">Ship to</p>
                  <div className="text-sm text-charcoal space-y-0.5">
                    <p>{props.shippingAddress.street}</p>
                    <p>
                      {[props.shippingAddress.city, props.shippingAddress.state_province, props.shippingAddress.postal_code]
                        .filter(Boolean).join(', ')}
                    </p>
                    <p>{props.shippingAddress.countryName}</p>
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-mist mb-3">Items</p>
                <table className="w-full text-sm border border-bone rounded overflow-hidden">
                  <thead className="bg-cream">
                    <tr className="text-[10px] uppercase tracking-widest text-mist border-b border-bone">
                      <th className="text-left px-3 py-2 font-semibold">Product</th>
                      <th className="text-center px-3 py-2 font-semibold">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold">Unit</th>
                      <th className="text-right px-3 py-2 font-semibold">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.items.map((it, i) => (
                      <tr key={i} className={`border-t border-bone ${i % 2 === 1 ? 'bg-cream/30' : ''}`}>
                        <td className="px-3 py-2 text-charcoal">{it.product_name}</td>
                        <td className="px-3 py-2 text-center text-charcoal">{it.quantity}</td>
                        <td className="px-3 py-2 text-right text-charcoal">{fmtUSD(it.unit_cents, props.currency)}</td>
                        <td className="px-3 py-2 text-right text-charcoal">{fmtUSD(it.line_cents, props.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-bone">
                    <tr>
                      <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-mist">Subtotal</td>
                      <td className="px-3 py-1.5 text-right text-charcoal">{fmtUSD(props.subtotalCents, props.currency)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-mist">Shipping</td>
                      <td className="px-3 py-1.5 text-right text-charcoal">{fmtUSD(props.shippingCents, props.currency)}</td>
                    </tr>
                    <tr className="border-t-2 border-charcoal">
                      <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-widest font-semibold text-charcoal">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right font-display text-base font-semibold text-charcoal">
                        {fmtUSD(props.totalCents, props.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Packaging list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-mist">Packaging List</p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs border border-bone px-3 py-1.5 rounded text-mist hover:text-charcoal hover:border-charcoal transition-colors"
                  >
                    {copied ? <><Check size={11} className="text-emerald-600" /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <pre className="bg-cream/60 border border-bone rounded p-4 text-xs font-mono text-charcoal whitespace-pre-wrap leading-relaxed select-all">
                  {packagingText}
                </pre>
              </div>

              {/* Export Excel */}
              <div className="pt-2 border-t border-bone flex gap-3">
                <button
                  type="button"
                  onClick={handleExcelDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 text-xs bg-charcoal text-cream px-4 py-2 rounded hover:bg-charcoal/90 transition-colors disabled:opacity-50"
                >
                  <Download size={12} />
                  {downloading ? 'Generating…' : 'Export to Excel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
