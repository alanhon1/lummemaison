// Order email content generators (customer + admin).
// All monetary amounts (price, total, subtotal, shipping) are integer CENTS.
// Conversion to display dollars happens only inside formatUSD() at render.

import { WISE_PAYMENT } from '@/lib/checkout/wisePayment';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number; // unit price in cents
  option?: string; // chosen purchase option, e.g. "6mm"
}

// Product name with its chosen option appended, e.g. "REJUBEAU 30G (6mm)".
export function itemLabel(it: OrderItem): string {
  return it.option ? `${it.name} (${it.option})` : it.name;
}

export interface OrderShippingAddress {
  street: string;
  city: string;
  state_province?: string;
  postal_code: string;
  country: string;        // ISO alpha-2
  countryName?: string;   // display name (e.g. "South Korea")
}

export interface OrderData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  total: number;            // cents
  currency?: string;         // default 'USD'

  // Optional extensions — rendered only if defined.
  shippingAddress?: OrderShippingAddress;
  customerPhone?: string;
  country?: string;          // display country name
  subtotal?: number;         // cents
  shipping?: number;         // cents (shipping cost)

  // Per-order customer inputs. Shown to admin only — the customer already
  // typed them and including a discount code in the customer-facing email
  // would suggest an applied discount that fulfilment hasn't reviewed yet.
  notes?: string;
  discountCode?: string;

  // Payment verification (Phase 5). `status` reflects what was just saved on
  // the order; `transactionLink` is whatever URL the customer pasted; and
  // `proofPath` / `proofSignedUrl` describe the screenshot uploaded to the
  // private payment-proofs bucket. The signed URL is minted by
  // sendOrderEmails.ts just before sending, with a 7-day expiry.
  status?: string;
  transactionLink?: string;
  proofPath?: string;
  proofSignedUrl?: string;
}

export function formatUSD(cents: number, currency = 'USD'): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ----------------------------------------------------------------------------
// Contact-form message — same Lumée Maison branded shell as the order emails.
// ----------------------------------------------------------------------------

export interface ContactMessageData {
  name: string;
  email: string;
  company?: string;
  message: string;
}

export function contactMessageEmail(d: ContactMessageData): { subject: string; html: string; text: string } {
  const subject = `New website message from ${d.name}${d.company ? ` (${d.company})` : ''}`;

  const rows = [
    { label: 'Name', value: d.name },
    { label: 'Email', value: d.email },
    { label: 'Company', value: d.company || '—' },
  ]
    .map(
      r =>
        `<tr><td style="color:#6b6157;padding:6px 18px 6px 0;vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td><td style="color:#3a342c;padding:6px 0;">${escapeHtml(r.value)}</td></tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;max-width:600px;width:100%;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#9a8e7e;margin-top:6px;">New website message</div>
        </td></tr>
        <tr><td style="padding:32px 40px 8px;">
          <h3 style="font-family:Georgia,serif;font-style:italic;color:#3a342c;margin:0 0 14px;">Contact details</h3>
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;">${rows}</table>
          <h3 style="font-family:Georgia,serif;font-style:italic;color:#3a342c;margin:28px 0 8px;">Message</h3>
          <div style="background:#f7ede0;border:1px solid #eadfd1;padding:16px 18px;font-size:14px;line-height:1.7;color:#3a342c;white-space:pre-wrap;">${escapeHtml(d.message)}</div>
          <p style="margin:22px 0 0;font-size:13px;color:#6b6157;">Reply directly to this email to respond to ${escapeHtml(d.name)}.</p>
        </td></tr>
        <tr><td style="padding:8px 40px 28px;">
          <p style="margin:18px 0 0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;">— Lumée Maison website</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #eadfd1;font-size:11px;color:#9a8e7e;text-align:center;">
          Sent from the contact form at lumeemaison.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `New website message\n\nName: ${d.name}\nEmail: ${d.email}\nCompany: ${d.company || '—'}\n\nMessage:\n${d.message}\n\n(Reply to this email to respond.)`;

  return { subject, html, text };
}

function formatAddressLines(addr: OrderShippingAddress): string[] {
  const lines: string[] = [];
  lines.push(addr.street);
  const cityLine = [addr.city, addr.state_province, addr.postal_code]
    .filter(Boolean)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  lines.push(addr.countryName ?? addr.country);
  return lines;
}

// ----------------------------------------------------------------------------
// Customer email — Lumée Maison brand tone, elegant, payment-instruction-led.
// ----------------------------------------------------------------------------

// Read an env var, treating empty strings and bracketed placeholders as
// "not configured". Mirrors the helper in the payment page so email content
// never shows misleading account info.
function envValue(key: string): string {
  const raw = process.env[key];
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^\[.*\]$/.test(trimmed)) return '';
  return trimmed;
}

// Receipt email — sent to the customer once they submit their order with proof.
// Clean, no payment instructions: name, order number, address, items, thanks.
function receiptEmail(order: OrderData): { subject: string; html: string; text: string } {
  const currency = order.currency ?? 'USD';
  const subject = `Your Lumée Maison Order ${order.orderNumber} — Received`;

  const itemRows = order.items
    .map(it => {
      const line = it.price * it.quantity;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;">${escapeHtml(itemLabel(it))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:center;">${it.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:right;">${formatUSD(it.price, currency)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:right;">${formatUSD(line, currency)}</td>
      </tr>`;
    })
    .join('');

  const totalsRows: string[] = [];
  if (order.subtotal !== undefined) {
    totalsRows.push(`<tr><td style="padding:4px 12px;text-align:right;color:#6b6157;">Subtotal</td><td style="padding:4px 12px;text-align:right;width:120px;">${formatUSD(order.subtotal, currency)}</td></tr>`);
    if (order.subtotal + (order.shipping ?? 0) - order.total > 0) {
      totalsRows.push(`<tr><td style="padding:4px 12px;text-align:right;color:#0a7a4f;">Discount</td><td style="padding:4px 12px;text-align:right;color:#0a7a4f;">-${formatUSD(order.subtotal + (order.shipping ?? 0) - order.total, currency)}</td></tr>`);
    }
  }
  if (order.shipping !== undefined) {
    totalsRows.push(`<tr><td style="padding:4px 12px;text-align:right;color:#6b6157;">Shipping</td><td style="padding:4px 12px;text-align:right;">${formatUSD(order.shipping, currency)}</td></tr>`);
  }
  totalsRows.push(`<tr><td style="padding:8px 12px;text-align:right;font-weight:600;border-top:2px solid #c9b89a;">Total</td><td style="padding:8px 12px;text-align:right;font-weight:600;border-top:2px solid #c9b89a;">${formatUSD(order.total, currency)}</td></tr>`);

  let shippingBlock = '';
  if (order.shippingAddress) {
    const lines = formatAddressLines(order.shippingAddress).map(escapeHtml).join('<br/>');
    shippingBlock = `
      <h3 style="font-family:Georgia,serif;font-style:italic;color:#3a342c;margin:28px 0 8px;">Shipping to</h3>
      <p style="margin:0;color:#3a342c;line-height:1.55;">${escapeHtml(order.customerName)}<br/>${lines}</p>
    `;
  }

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:12px;letter-spacing:3px;color:#9a8e7e;margin-top:4px;text-transform:uppercase;">Order Receipt</div>
        </td></tr>
        <tr><td style="padding:32px 40px 8px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(order.customerName)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Thank you for your order with Lumée Maison. We have received your payment confirmation and will verify it shortly. Once confirmed, your order will be prepared for shipment.</p>

          <p style="margin:0 0 4px;font-size:13px;color:#9a8e7e;text-transform:uppercase;letter-spacing:2px;">Order number</p>
          <p style="margin:0 0 24px;font-size:20px;font-weight:600;letter-spacing:0.5px;color:#3a342c;">${escapeHtml(order.orderNumber)}</p>

          <h3 style="font-family:Georgia,serif;font-style:italic;color:#3a342c;margin:0 0 8px;">Your order</h3>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eadfd1;font-size:14px;">
            <thead><tr style="background:#f7ede0;">
              <th align="left" style="padding:8px 12px;color:#6b6157;font-weight:600;">Item</th>
              <th align="center" style="padding:8px 12px;color:#6b6157;font-weight:600;">Qty</th>
              <th align="right" style="padding:8px 12px;color:#6b6157;font-weight:600;">Unit</th>
              <th align="right" style="padding:8px 12px;color:#6b6157;font-weight:600;">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot>${totalsRows.join('')}</tfoot>
          </table>

          ${shippingBlock}

          <p style="margin:32px 0 8px;font-size:15px;line-height:1.6;">We appreciate your trust in Lumée Maison and look forward to delivering your order. If you have any questions, please reply to this email.</p>

          <p style="margin:28px 0 4px;font-size:14px;line-height:1.6;">With gratitude,</p>
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;">The Lumée Maison Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #eadfd1;font-size:11px;color:#9a8e7e;text-align:center;">
          This is your order receipt for ${escapeHtml(order.orderNumber)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const textLines: string[] = [
    `Lumée Maison — Order Receipt`,
    `Order number: ${order.orderNumber}`,
    '',
    `Dear ${order.customerName},`,
    '',
    `Thank you for your order with Lumée Maison. We have received your payment confirmation and will verify it shortly. Once confirmed, your order will be prepared for shipment.`,
    '',
    'Your order:',
  ];
  for (const it of order.items) {
    textLines.push(`  ${itemLabel(it)} × ${it.quantity}  ${formatUSD(it.price * it.quantity, currency)}`);
  }
  if (order.subtotal !== undefined) textLines.push(`  Subtotal: ${formatUSD(order.subtotal, currency)}`);
  if (order.subtotal !== undefined && order.subtotal + (order.shipping ?? 0) - order.total > 0) {
    textLines.push(`  Discount: -${formatUSD(order.subtotal + (order.shipping ?? 0) - order.total, currency)}`);
  }
  if (order.shipping !== undefined) textLines.push(`  Shipping: ${formatUSD(order.shipping, currency)}`);
  textLines.push(`  Total:    ${formatUSD(order.total, currency)}`);
  if (order.shippingAddress) {
    textLines.push('', 'Shipping to:');
    textLines.push(`  ${order.customerName}`);
    for (const ln of formatAddressLines(order.shippingAddress)) textLines.push(`  ${ln}`);
  }
  textLines.push('', 'With gratitude,', 'The Lumée Maison Team');

  return { subject, html, text: textLines.join('\n') };
}

export function customerEmail(order: OrderData): { subject: string; html: string; text: string } {
  // When status is 'order_received' the customer has already uploaded proof and
  // submitted — send a clean receipt instead of payment instructions.
  if (order.status === 'order_received') {
    return receiptEmail(order);
  }

  const currency = order.currency ?? 'USD';
  const subject = `Your Lumée Maison Order ${order.orderNumber} — Payment Instructions`;

  const wiseFields = WISE_PAYMENT.bankFields.map(f => ({ label: f.label, value: f.value }));

  const usdtNetworks: Array<{ label: string; address: string }> = [];
  const erc20 = envValue('USDT_ERC20_ADDRESS');
  if (erc20) usdtNetworks.push({ label: 'ERC20 (Ethereum)', address: erc20 });
  const trc20 = envValue('USDT_TRC20_ADDRESS');
  if (trc20) usdtNetworks.push({ label: 'TRC20 (Tron)', address: trc20 });

  const paymentWhatsapp = envValue('PAYMENT_WHATSAPP');
  const adminEmailAddr = envValue('ADMIN_NOTIFICATION_EMAIL') || 'info@lumeemaison.com';

  // ----- HTML -----
  const itemRows = order.items
    .map(it => {
      const line = it.price * it.quantity;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;">${escapeHtml(itemLabel(it))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:center;">${it.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:right;">${formatUSD(it.price, currency)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:right;">${formatUSD(line, currency)}</td>
      </tr>`;
    })
    .join('');

  const totalsRows: string[] = [];
  if (order.subtotal !== undefined) {
    totalsRows.push(`<tr><td style="padding:4px 12px;text-align:right;color:#6b6157;">Subtotal</td><td style="padding:4px 12px;text-align:right;width:120px;">${formatUSD(order.subtotal, currency)}</td></tr>`);
    if (order.subtotal + (order.shipping ?? 0) - order.total > 0) {
      totalsRows.push(`<tr><td style="padding:4px 12px;text-align:right;color:#0a7a4f;">Discount</td><td style="padding:4px 12px;text-align:right;color:#0a7a4f;">-${formatUSD(order.subtotal + (order.shipping ?? 0) - order.total, currency)}</td></tr>`);
    }
  }
  if (order.shipping !== undefined) {
    totalsRows.push(`<tr><td style="padding:4px 12px;text-align:right;color:#6b6157;">Shipping</td><td style="padding:4px 12px;text-align:right;">${formatUSD(order.shipping, currency)}</td></tr>`);
  }
  totalsRows.push(`<tr><td style="padding:8px 12px;text-align:right;font-weight:600;border-top:2px solid #c9b89a;">Total</td><td style="padding:8px 12px;text-align:right;font-weight:600;border-top:2px solid #c9b89a;">${formatUSD(order.total, currency)}</td></tr>`);

  let shippingBlock = '';
  if (order.shippingAddress) {
    const lines = formatAddressLines(order.shippingAddress).map(escapeHtml).join('<br/>');
    shippingBlock = `
      <h3 style="font-family:Georgia,serif;font-style:italic;color:#3a342c;margin:28px 0 8px;">Shipping to</h3>
      <p style="margin:0;color:#3a342c;line-height:1.5;">${escapeHtml(order.customerName)}<br/>${lines}</p>
    `;
  }

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:12px;letter-spacing:3px;color:#9a8e7e;margin-top:4px;text-transform:uppercase;">Order Confirmation</div>
        </td></tr>
        <tr><td style="padding:32px 40px 8px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(order.customerName)},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Thank you for your order with Lumée Maison. We have received your request and reserved your selection. Please complete payment using one of the methods below — once we confirm receipt, your order will be prepared for shipment.</p>
          <p style="margin:0 0 4px;font-size:14px;color:#6b6157;">Order number</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:600;letter-spacing:0.5px;">${escapeHtml(order.orderNumber)}</p>

          <h3 style="font-family:Georgia,serif;font-style:italic;color:#3a342c;margin:28px 0 8px;">Your order</h3>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eadfd1;font-size:14px;">
            <thead><tr style="background:#f7ede0;">
              <th align="left" style="padding:8px 12px;color:#6b6157;font-weight:600;">Item</th>
              <th align="center" style="padding:8px 12px;color:#6b6157;font-weight:600;">Qty</th>
              <th align="right" style="padding:8px 12px;color:#6b6157;font-weight:600;">Unit</th>
              <th align="right" style="padding:8px 12px;color:#6b6157;font-weight:600;">Line</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot>${totalsRows.join('')}</tfoot>
          </table>

          ${shippingBlock}

          <h3 style="font-family:Georgia,serif;font-style:italic;color:#3a342c;margin:32px 0 12px;">Payment instructions</h3>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3a342c;">Please choose <strong>one</strong> of the following payment methods. After paying, kindly reply to this email with a screenshot or photo of your transfer receipt.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr>
              <td valign="top" style="width:50%;padding:16px;background:#f7ede0;border:1px solid #eadfd1;">
                <div style="font-weight:600;letter-spacing:1px;text-transform:uppercase;font-size:12px;color:#6b6157;margin-bottom:8px;">Wise (Bank Transfer)</div>
                ${
                  wiseFields.length === 0
                    ? `<div style="font-size:13px;line-height:1.6;color:#6b6157;font-style:italic;">Details being updated — please contact us.</div>`
                    : `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.7;">
                      ${wiseFields
                        .map(
                          f =>
                            `<tr><td style="color:#6b6157;padding-right:10px;vertical-align:top;">${escapeHtml(f.label)}</td><td>${escapeHtml(f.value)}</td></tr>`,
                        )
                        .join('')}
                    </table>`
                }
                <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #d6c8b0;font-size:12px;color:#6b6157;line-height:1.5;">
                  Enter your order number <strong style="color:#3a342c;">${escapeHtml(order.orderNumber)}</strong> in the Wise &ldquo;reference&rdquo; field.
                </div>
              </td>
              <td style="width:12px;"></td>
              <td valign="top" style="width:50%;padding:16px;background:#f7ede0;border:1px solid #eadfd1;">
                <div style="font-weight:600;letter-spacing:1px;text-transform:uppercase;font-size:12px;color:#6b6157;margin-bottom:8px;">USDT ONLY</div>
                ${
                  usdtNetworks.length === 0
                    ? `<div style="font-size:13px;line-height:1.6;color:#6b6157;font-style:italic;">Addresses being updated — please contact us${paymentWhatsapp ? ` on WhatsApp <strong>${escapeHtml(paymentWhatsapp)}</strong>` : ''}.</div>`
                    : usdtNetworks
                        .map(
                          n => `<div style="font-size:13px;line-height:1.6;margin-bottom:10px;">
                            <div style="color:#6b6157;">Network</div>
                            <div style="margin-bottom:4px;">${escapeHtml(n.label)}</div>
                            <div style="color:#6b6157;">Address</div>
                            <div style="word-break:break-all;font-family:Consolas,Menlo,monospace;font-size:12px;">${escapeHtml(n.address)}</div>
                          </div>`,
                        )
                        .join('')
                }
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 8px;font-size:14px;line-height:1.6;">After paying, please reply to this email or send a screenshot to <a href="mailto:${escapeHtml(adminEmailAddr)}" style="color:#7a5a3a;">${escapeHtml(adminEmailAddr)}</a>.</p>

          <p style="margin:28px 0 4px;font-size:14px;line-height:1.6;">With gratitude,</p>
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;">The Lumée Maison Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #eadfd1;font-size:11px;color:#9a8e7e;text-align:center;">
          This is a transactional message regarding your order ${escapeHtml(order.orderNumber)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  // ----- Plain text -----
  const textLines: string[] = [];
  textLines.push(`Lumée Maison — Order ${order.orderNumber}`);
  textLines.push('');
  textLines.push(`Dear ${order.customerName},`);
  textLines.push('');
  textLines.push('Thank you for your order with Lumée Maison. Please complete payment using one of the methods below — once we confirm receipt, your order will be prepared for shipment.');
  textLines.push('');
  textLines.push('Your order:');
  for (const it of order.items) {
    const line = it.price * it.quantity;
    textLines.push(`  - ${itemLabel(it)} × ${it.quantity} @ ${formatUSD(it.price, currency)} = ${formatUSD(line, currency)}`);
  }
  if (order.subtotal !== undefined) textLines.push(`  Subtotal: ${formatUSD(order.subtotal, currency)}`);
  if (order.subtotal !== undefined && order.subtotal + (order.shipping ?? 0) - order.total > 0) {
    textLines.push(`  Discount: -${formatUSD(order.subtotal + (order.shipping ?? 0) - order.total, currency)}`);
  }
  if (order.shipping !== undefined) textLines.push(`  Shipping: ${formatUSD(order.shipping, currency)}`);
  textLines.push(`  Total:    ${formatUSD(order.total, currency)}`);
  if (order.shippingAddress) {
    textLines.push('');
    textLines.push('Shipping to:');
    textLines.push(`  ${order.customerName}`);
    for (const ln of formatAddressLines(order.shippingAddress)) {
      textLines.push(`  ${ln}`);
    }
  }
  textLines.push('');
  textLines.push('Payment instructions — choose ONE:');
  textLines.push('');
  textLines.push('  [Wise — Bank Transfer]');
  if (wiseFields.length === 0) {
    textLines.push('    Details being updated — please contact us.');
  } else {
    for (const f of wiseFields) {
      textLines.push(`    ${f.label.padEnd(14)}${f.value}`);
    }
  }
  textLines.push(`    Reference:    ${order.orderNumber}`);
  textLines.push('');
  textLines.push('  [USDT ONLY]');
  if (usdtNetworks.length === 0) {
    textLines.push(`    Addresses being updated — please contact us${paymentWhatsapp ? ` on WhatsApp ${paymentWhatsapp}` : ''}.`);
  } else {
    for (const n of usdtNetworks) {
      textLines.push(`    Network: ${n.label}`);
      textLines.push(`    Address: ${n.address}`);
      textLines.push('');
    }
  }
  textLines.push('');
  textLines.push(`After paying, please reply to this email or send a screenshot to ${adminEmailAddr}.`);
  textLines.push('');
  textLines.push('With gratitude,');
  textLines.push('The Lumée Maison Team');

  return { subject, html, text: textLines.join('\n') };
}

// ----------------------------------------------------------------------------
// Customer shipment notification — sent when admin marks an order as `shipped`.
// Lightweight: order number, carrier, tracking number, and tracking URL.
// ----------------------------------------------------------------------------

export interface ShipmentData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  carrierLabel: string;
  trackingNumber: string;
  trackingUrl?: string;
}

export function shipmentEmail(s: ShipmentData): { subject: string; html: string; text: string } {
  const subject = `Your Lumée Maison Order ${s.orderNumber} — Shipped`;
  const trackingLine = s.trackingUrl
    ? `<a href="${s.trackingUrl}" style="color:#7a5a3a;">${escapeHtml(s.trackingNumber)}</a>`
    : escapeHtml(s.trackingNumber);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:12px;letter-spacing:3px;color:#9a8e7e;margin-top:4px;text-transform:uppercase;">Your Order Has Shipped</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(s.customerName)},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Your order <strong>${escapeHtml(s.orderNumber)}</strong> is on its way. Tracking details below.</p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;font-size:14px;line-height:1.8;">
            <tr><td style="color:#6b6157;padding-right:18px;vertical-align:top;">Carrier</td><td style="color:#3a342c;">${escapeHtml(s.carrierLabel)}</td></tr>
            <tr><td style="color:#6b6157;padding-right:18px;vertical-align:top;">Tracking number</td><td style="color:#3a342c;font-family:Consolas,Menlo,monospace;">${trackingLine}</td></tr>
          </table>

          ${
            s.trackingUrl
              ? `<p style="margin:0 0 28px;"><a href="${s.trackingUrl}" style="display:inline-block;padding:10px 24px;background:#c9a875;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">Track Your Package</a></p>`
              : ''
          }

          <p style="margin:24px 0 4px;font-size:14px;line-height:1.6;">With gratitude,</p>
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;">The Lumée Maison Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #eadfd1;font-size:11px;color:#9a8e7e;text-align:center;">
          This is a shipping notification for your order ${escapeHtml(s.orderNumber)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Lumée Maison — Order ${s.orderNumber} has shipped`,
    '',
    `Dear ${s.customerName},`,
    '',
    `Your order ${s.orderNumber} is on its way.`,
    '',
    `  Carrier:         ${s.carrierLabel}`,
    `  Tracking number: ${s.trackingNumber}`,
    s.trackingUrl ? `  Track:           ${s.trackingUrl}` : '',
    '',
    'With gratitude,',
    'The Lumée Maison Team',
  ]
    .filter(line => line !== null && line !== undefined)
    .join('\n');

  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// Signup confirmation — sent after a customer signs up; contains the magic
// link to confirm their email. We send via our own Nodemailer rather than
// Supabase's internal SMTP because the free-tier SMTP rate-limits at 3/hour
// (encountered in production).
// ----------------------------------------------------------------------------

export interface SignupConfirmData {
  customerName: string;
  customerEmail: string;
  confirmUrl: string;
}

export function signupConfirmationEmail(s: SignupConfirmData): { subject: string; html: string; text: string } {
  const subject = `Lumée Maison — Confirm your email`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:12px;letter-spacing:3px;color:#9a8e7e;margin-top:4px;text-transform:uppercase;">Confirm your email</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(s.customerName)},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Thank you for joining Lumée Maison. To finish creating your account, please confirm your email by clicking the button below.</p>
          <p style="margin:24px 0;"><a href="${s.confirmUrl}" style="display:inline-block;padding:12px 28px;background:#c9a875;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">Confirm Email</a></p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b6157;">If the button doesn't work, copy and paste this link into your browser:<br/><span style="word-break:break-all;color:#7a5a3a;">${escapeHtml(s.confirmUrl)}</span></p>
          <p style="margin:28px 0 4px;font-size:14px;line-height:1.6;">Warm regards,</p>
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;">The Lumée Maison Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #eadfd1;font-size:11px;color:#9a8e7e;text-align:center;">
          If you didn't sign up, you can ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    `Lumée Maison — Confirm your email`, '',
    `Dear ${s.customerName},`, '',
    `Please confirm your email by visiting:`,
    s.confirmUrl, '',
    `If you didn't sign up, you can ignore this email.`,
    '', `The Lumée Maison Team`,
  ].join('\n');
  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// Password reset code — 4-digit OTP sent to the customer's inbox when they
// click "Forgot password?". Custom flow (not Supabase's resetPasswordForEmail
// magic-link flow) because the user wants a 4-digit code, not a link.
// ----------------------------------------------------------------------------

export interface PasswordResetCodeData {
  customerEmail: string;
  code: string;        // exactly 4 digits
  ttlMinutes: number;  // e.g. 10
}

export function passwordResetCodeEmail(s: PasswordResetCodeData): { subject: string; html: string; text: string } {
  const subject = `Lumée Maison — Password reset code`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:12px;letter-spacing:3px;color:#9a8e7e;margin-top:4px;text-transform:uppercase;">Password reset</div>
        </td></tr>
        <tr><td style="padding:32px 40px;text-align:center;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;text-align:left;">Use the 4-digit code below to reset your password. It expires in ${s.ttlMinutes} minutes.</p>
          <div style="font-family:Consolas,Menlo,monospace;font-size:42px;letter-spacing:0.6em;font-weight:600;color:#3a342c;background:#f7ede0;border:1px solid #eadfd1;padding:18px 0;margin:24px 0;">${escapeHtml(s.code)}</div>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b6157;text-align:left;">If you didn't request a password reset, you can ignore this email — your password remains unchanged.</p>
          <p style="margin:28px 0 4px;font-size:14px;line-height:1.6;text-align:left;">Warm regards,</p>
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;text-align:left;">The Lumée Maison Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    `Lumée Maison — Password reset code`, '',
    `Your 4-digit code: ${s.code}`,
    `Expires in ${s.ttlMinutes} minutes.`, '',
    `If you didn't request a password reset, you can ignore this email.`,
    '', `The Lumée Maison Team`,
  ].join('\n');
  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// Customer delivery confirmation — sent when admin marks an order `delivered`.
// Closes the customer-email sequence (received → shipped → delivered).
// ----------------------------------------------------------------------------

export interface DeliveryData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
}

export function deliveryEmail(d: DeliveryData): { subject: string; html: string; text: string } {
  const subject = `Your Lumée Maison Order ${d.orderNumber} — Delivered`;
  const adminEmailAddr = envValue('ADMIN_NOTIFICATION_EMAIL') || 'info@lumeemaison.com';

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:12px;letter-spacing:3px;color:#9a8e7e;margin-top:4px;text-transform:uppercase;">Delivered</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(d.customerName)},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">We've marked your order <strong>${escapeHtml(d.orderNumber)}</strong> as delivered. We hope everything arrived in beautiful condition.</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">If anything looks off — damaged, missing, or different from what you expected — please reply to this email or write to <a href="mailto:${escapeHtml(adminEmailAddr)}" style="color:#7a5a3a;">${escapeHtml(adminEmailAddr)}</a> and we'll make it right.</p>
          <p style="margin:28px 0 4px;font-size:14px;line-height:1.6;">Thank you for choosing us,</p>
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;">The Lumée Maison Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #eadfd1;font-size:11px;color:#9a8e7e;text-align:center;">
          This is a delivery confirmation for your order ${escapeHtml(d.orderNumber)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Lumée Maison — Order ${d.orderNumber} delivered`,
    '',
    `Dear ${d.customerName},`,
    '',
    `We've marked your order ${d.orderNumber} as delivered. We hope everything arrived in beautiful condition.`,
    '',
    `If anything looks off — damaged, missing, or different from what you expected — please reply to this email or write to ${adminEmailAddr} and we'll make it right.`,
    '',
    'Thank you for choosing us,',
    'The Lumée Maison Team',
  ].join('\n');

  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// Customer cancellation notification — sent when admin transitions an order
// to `cancelled`. Mirrors the shipment-notification tone.
// ----------------------------------------------------------------------------

export interface CancellationData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
}

export function cancellationEmail(c: CancellationData): { subject: string; html: string; text: string } {
  const subject = `Your Lumée Maison Order ${c.orderNumber} — Cancelled`;
  const adminEmailAddr = envValue('ADMIN_NOTIFICATION_EMAIL') || 'info@lumeemaison.com';

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:12px;letter-spacing:3px;color:#9a8e7e;margin-top:4px;text-transform:uppercase;">Order Cancelled</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(c.customerName)},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Your order <strong>${escapeHtml(c.orderNumber)}</strong> has been cancelled. If you have any questions or this was unexpected, please reply to this email or reach us at <a href="mailto:${escapeHtml(adminEmailAddr)}" style="color:#7a5a3a;">${escapeHtml(adminEmailAddr)}</a>.</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">If you have already sent payment, we will reach out separately with refund details.</p>
          <p style="margin:28px 0 4px;font-size:14px;line-height:1.6;">With apologies for the inconvenience,</p>
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;">The Lumée Maison Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #eadfd1;font-size:11px;color:#9a8e7e;text-align:center;">
          This is a cancellation notice for your order ${escapeHtml(c.orderNumber)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Lumée Maison — Order ${c.orderNumber} cancelled`,
    '',
    `Dear ${c.customerName},`,
    '',
    `Your order ${c.orderNumber} has been cancelled. If you have any questions or this was unexpected, please reply to this email or reach us at ${adminEmailAddr}.`,
    '',
    'If you have already sent payment, we will reach out separately with refund details.',
    '',
    'With apologies for the inconvenience,',
    'The Lumée Maison Team',
  ].join('\n');

  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// Payment-verified notification — sent to the customer when admin confirms
// their payment. Bridges the gap between order receipt and shipment emails.
// ----------------------------------------------------------------------------

export interface PaymentVerifiedData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency?: string;
}

export function paymentVerifiedEmail(d: PaymentVerifiedData): { subject: string; html: string; text: string } {
  const currency = d.currency ?? 'USD';
  const subject = `Your Lumée Maison Order ${d.orderNumber} — Payment Verified`;

  const itemRows = d.items
    .map(it => {
      const line = it.price * it.quantity;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;">${escapeHtml(itemLabel(it))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:center;">${it.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:right;">${formatUSD(it.price, currency)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:right;">${formatUSD(line, currency)}</td>
      </tr>`;
    })
    .join('');

  const totalsRows = [
    `<tr><td style="padding:4px 12px;text-align:right;color:#6b6157;">Subtotal</td><td style="padding:4px 12px;text-align:right;width:120px;">${formatUSD(d.subtotalCents, currency)}</td></tr>`,
    `<tr><td style="padding:4px 12px;text-align:right;color:#6b6157;">Shipping</td><td style="padding:4px 12px;text-align:right;">${formatUSD(d.shippingCents, currency)}</td></tr>`,
    `<tr><td style="padding:8px 12px;text-align:right;font-weight:600;border-top:2px solid #c9b89a;">Total</td><td style="padding:8px 12px;text-align:right;font-weight:600;border-top:2px solid #c9b89a;">${formatUSD(d.totalCents, currency)}</td></tr>`,
  ].join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eadfd1;">
        <tr><td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #eadfd1;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;letter-spacing:1px;color:#3a342c;">Lumée Maison</div>
          <div style="font-size:12px;letter-spacing:3px;color:#9a8e7e;margin-top:4px;text-transform:uppercase;">Payment Verified</div>
        </td></tr>
        <tr><td style="padding:32px 40px 8px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(d.customerName)},</p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Great news — we have verified your payment for order <strong>${escapeHtml(d.orderNumber)}</strong>. Your order is now being prepared for shipment and you will receive a tracking notification once it ships.</p>

          <p style="margin:24px 0 4px;font-size:13px;color:#9a8e7e;text-transform:uppercase;letter-spacing:2px;">Order number</p>
          <p style="margin:0 0 24px;font-size:20px;font-weight:600;letter-spacing:0.5px;color:#3a342c;">${escapeHtml(d.orderNumber)}</p>

          <h3 style="font-family:Georgia,serif;font-style:italic;color:#3a342c;margin:0 0 8px;">Your order</h3>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eadfd1;font-size:14px;">
            <thead><tr style="background:#f7ede0;">
              <th align="left" style="padding:8px 12px;color:#6b6157;font-weight:600;">Item</th>
              <th align="center" style="padding:8px 12px;color:#6b6157;font-weight:600;">Qty</th>
              <th align="right" style="padding:8px 12px;color:#6b6157;font-weight:600;">Unit</th>
              <th align="right" style="padding:8px 12px;color:#6b6157;font-weight:600;">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot>${totalsRows}</tfoot>
          </table>

          <p style="margin:28px 0 4px;font-size:14px;line-height:1.6;">With gratitude,</p>
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#3a342c;">The Lumée Maison Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #eadfd1;font-size:11px;color:#9a8e7e;text-align:center;">
          This is a payment confirmation for your order ${escapeHtml(d.orderNumber)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const textLines = [
    `Lumée Maison — Payment Verified`,
    `Order number: ${d.orderNumber}`,
    '',
    `Dear ${d.customerName},`,
    '',
    `Great news — we have verified your payment for order ${d.orderNumber}. Your order is now being prepared for shipment.`,
    '',
    'Your order:',
  ];
  for (const it of d.items) {
    textLines.push(`  ${itemLabel(it)} × ${it.quantity}  ${formatUSD(it.price * it.quantity, currency)}`);
  }
  textLines.push(`  Subtotal: ${formatUSD(d.subtotalCents, currency)}`);
  textLines.push(`  Shipping: ${formatUSD(d.shippingCents, currency)}`);
  textLines.push(`  Total:    ${formatUSD(d.totalCents, currency)}`);
  textLines.push('', 'With gratitude,', 'The Lumée Maison Team');

  return { subject, html, text: textLines.join('\n') };
}

// ----------------------------------------------------------------------------
// Admin low-stock alert — fired when any product in a just-verified order
// drops to or below the LOW_STOCK_THRESHOLD after stock deduction.
// ----------------------------------------------------------------------------

export interface LowStockAlertData {
  products: Array<{ id: number; name: string; stock: number }>;
}

export function lowStockAlertEmail(d: LowStockAlertData): { subject: string; html: string; text: string } {
  const n = d.products.length;
  const subject = `[Lumée Maison] Low Stock Alert — ${n} product${n !== 1 ? 's' : ''}`;

  const rows = d.products
    .map(
      p =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(p.name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;color:${p.stock === 0 ? '#dc2626' : '#d97706'};">${p.stock}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">${p.id}</td>
        </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;">
        <tr><td style="padding:18px 24px;background:#7c3aed;color:#fff;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.8;">Inventory Alert</div>
          <div style="font-size:17px;font-weight:600;margin-top:2px;">Low Stock — ${n} product${n !== 1 ? 's' : ''}</div>
        </td></tr>
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">The following products reached low stock after a recent order. Restock soon to avoid going out of stock.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;font-size:13px;">
            <thead><tr style="background:#f3f4f6;">
              <th align="left" style="padding:8px 12px;color:#374151;">Product</th>
              <th align="center" style="padding:8px 12px;color:#374151;">Stock Left</th>
              <th align="center" style="padding:8px 12px;color:#374151;">ID</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:16px 0 0;font-size:13px;"><a href="https://www.lumeemaison.com/manzura/stock" style="color:#7c3aed;">Open Stock Management →</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const textLines = [
    subject,
    '',
    `The following products are low on stock:`,
    '',
    ...d.products.map(p => `  ${p.name} (ID: ${p.id}) — ${p.stock} left`),
    '',
    'Manage stock: https://www.lumeemaison.com/manzura/stock',
  ];

  return { subject, html, text: textLines.join('\n') };
}

// ----------------------------------------------------------------------------
// Admin email — concise, fulfillment-focused, ship-to block prominent.
// ----------------------------------------------------------------------------

export function adminEmail(order: OrderData): { subject: string; html: string; text: string } {
  const currency = order.currency ?? 'USD';
  const statusTag = order.status ? `[${order.status.toUpperCase()}] ` : '';
  const subject = `${statusTag}New Order ${order.orderNumber} — ${order.customerName} — ${formatUSD(order.total, currency)}`;

  // ----- HTML -----
  const shipLines: string[] = [];
  shipLines.push(`<strong>${escapeHtml(order.customerName)}</strong>`);
  if (order.shippingAddress) {
    for (const ln of formatAddressLines(order.shippingAddress)) {
      shipLines.push(escapeHtml(ln));
    }
  } else if (order.country) {
    shipLines.push(escapeHtml(order.country));
  }
  if (order.customerPhone) shipLines.push(`Tel: ${escapeHtml(order.customerPhone)}`);
  shipLines.push(`Email: <a href="mailto:${escapeHtml(order.customerEmail)}" style="color:#1f6feb;">${escapeHtml(order.customerEmail)}</a>`);

  const itemRows = order.items
    .map(it => {
      const line = it.price * it.quantity;
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(itemLabel(it))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${it.quantity}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatUSD(it.price, currency)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatUSD(line, currency)}</td>
      </tr>`;
    })
    .join('');

  const totalsRows: string[] = [];
  if (order.subtotal !== undefined) {
    totalsRows.push(`<tr><td colspan="3" style="padding:4px 10px;text-align:right;color:#6b7280;">Subtotal</td><td style="padding:4px 10px;text-align:right;">${formatUSD(order.subtotal, currency)}</td></tr>`);
  }
  if (order.shipping !== undefined) {
    totalsRows.push(`<tr><td colspan="3" style="padding:4px 10px;text-align:right;color:#6b7280;">Shipping</td><td style="padding:4px 10px;text-align:right;">${formatUSD(order.shipping, currency)}</td></tr>`);
  }
  totalsRows.push(`<tr><td colspan="3" style="padding:6px 10px;text-align:right;font-weight:700;border-top:2px solid #111;">Total</td><td style="padding:6px 10px;text-align:right;font-weight:700;border-top:2px solid #111;">${formatUSD(order.total, currency)}</td></tr>`);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;">
        <tr><td style="padding:18px 24px;background:#111;color:#fff;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">New Order</div>
          <div style="font-size:18px;font-weight:600;margin-top:2px;">${escapeHtml(order.orderNumber)}</div>
        </td></tr>

        <tr><td style="padding:20px 24px;background:#fff8e1;border-bottom:1px solid #f3e6b3;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b5b00;margin-bottom:6px;">Ship to</div>
          <div style="font-size:15px;line-height:1.55;">
            ${shipLines.join('<br/>')}
          </div>
        </td></tr>

        <tr><td style="padding:20px 24px;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Items</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;font-size:13px;">
            <thead><tr style="background:#f3f4f6;">
              <th align="left" style="padding:6px 10px;color:#374151;">Item</th>
              <th align="center" style="padding:6px 10px;color:#374151;">Qty</th>
              <th align="right" style="padding:6px 10px;color:#374151;">Unit</th>
              <th align="right" style="padding:6px 10px;color:#374151;">Line</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot>${totalsRows.join('')}</tfoot>
          </table>
        </td></tr>

        ${
          order.notes
            ? `<tr><td style="padding:0 24px 16px;">
                <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Customer notes / Reference</div>
                <div style="font-size:14px;line-height:1.55;background:#fff8e1;border:1px solid #f3e6b3;padding:10px 12px;white-space:pre-wrap;">${escapeHtml(order.notes)}</div>
              </td></tr>`
            : ''
        }

        ${
          order.discountCode
            ? `<tr><td style="padding:0 24px 16px;">
                <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Discount code (manual review required)</div>
                <div style="font-size:14px;line-height:1.4;background:#fef3c7;border:1px solid #fde68a;padding:10px 12px;font-family:Consolas,Menlo,monospace;">${escapeHtml(order.discountCode)}</div>
                <div style="font-size:12px;color:#92400e;margin-top:6px;">No discount has been applied automatically — verify the code and adjust the total manually before shipping.</div>
              </td></tr>`
            : ''
        }

        ${
          order.proofSignedUrl || order.transactionLink
            ? `<tr><td style="padding:0 24px 16px;">
                <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Payment verification</div>
                <div style="font-size:14px;line-height:1.7;background:#ecfdf5;border:1px solid #a7f3d0;padding:10px 12px;">
                  ${
                    order.proofSignedUrl
                      ? `<div><strong>Screenshot:</strong> <a href="${order.proofSignedUrl}" style="color:#065f46;word-break:break-all;">${order.proofSignedUrl}</a><div style="font-size:11px;color:#047857;margin-top:2px;">Link valid for 7 days. After that, open the order in /manzura/orders to regenerate.</div></div>`
                      : ''
                  }
                  ${
                    order.transactionLink
                      ? `<div style="${order.proofSignedUrl ? 'margin-top:8px;' : ''}"><strong>Transaction link:</strong> <a href="${escapeHtml(order.transactionLink)}" style="color:#065f46;word-break:break-all;">${escapeHtml(order.transactionLink)}</a></div>`
                      : ''
                  }
                </div>
              </td></tr>`
            : ''
        }

        <tr><td style="padding:14px 24px 20px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
          Reply to this email to contact the customer directly.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  // ----- Plain text -----
  const textLines: string[] = [];
  textLines.push(`NEW ORDER — ${order.orderNumber}`);
  textLines.push('');
  textLines.push('Ship to:');
  textLines.push(`  ${order.customerName}`);
  if (order.shippingAddress) {
    for (const ln of formatAddressLines(order.shippingAddress)) {
      textLines.push(`  ${ln}`);
    }
  } else if (order.country) {
    textLines.push(`  ${order.country}`);
  }
  if (order.customerPhone) textLines.push(`  Tel: ${order.customerPhone}`);
  textLines.push(`  Email: ${order.customerEmail}`);
  textLines.push('');
  textLines.push('Items:');
  for (const it of order.items) {
    const line = it.price * it.quantity;
    textLines.push(`  - ${itemLabel(it)} × ${it.quantity} @ ${formatUSD(it.price, currency)} = ${formatUSD(line, currency)}`);
  }
  if (order.subtotal !== undefined) textLines.push(`  Subtotal: ${formatUSD(order.subtotal, currency)}`);
  if (order.subtotal !== undefined && order.subtotal + (order.shipping ?? 0) - order.total > 0) {
    textLines.push(`  Discount: -${formatUSD(order.subtotal + (order.shipping ?? 0) - order.total, currency)}`);
  }
  if (order.shipping !== undefined) textLines.push(`  Shipping: ${formatUSD(order.shipping, currency)}`);
  textLines.push(`  Total:    ${formatUSD(order.total, currency)}`);
  if (order.notes) {
    textLines.push('');
    textLines.push('Customer notes / Reference:');
    for (const ln of order.notes.split('\n')) textLines.push(`  ${ln}`);
  }
  if (order.discountCode) {
    textLines.push('');
    textLines.push('Discount code (manual review required):');
    textLines.push(`  ${order.discountCode}`);
    textLines.push('  No discount has been applied automatically — verify the code and adjust the total manually before shipping.');
  }
  if (order.proofSignedUrl || order.transactionLink) {
    textLines.push('');
    textLines.push('Payment verification:');
    if (order.proofSignedUrl) {
      textLines.push(`  Screenshot: ${order.proofSignedUrl}`);
      textLines.push('  (Link valid for 7 days. After that, open the order in /manzura/orders to regenerate.)');
    }
    if (order.transactionLink) {
      textLines.push(`  Transaction link: ${order.transactionLink}`);
    }
  }
  textLines.push('');
  textLines.push('Reply to this email to contact the customer directly.');

  return { subject, html, text: textLines.join('\n') };
}
