// Order email content generators (customer + admin).
// All monetary amounts (price, total, subtotal, shipping) are integer CENTS.
// Conversion to display dollars happens only inside formatUSD() at render.

export interface OrderItem {
  name: string;
  quantity: number;
  price: number; // unit price in cents
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

export function customerEmail(order: OrderData): { subject: string; html: string; text: string } {
  const currency = order.currency ?? 'USD';
  const subject =
    order.status === 'processing'
      ? `Your Lumée Maison Order ${order.orderNumber} — Payment received, verifying`
      : `Your Lumée Maison Order ${order.orderNumber} — Payment Instructions`;

  const wiseFields: Array<{ label: string; value: string }> = [
    { label: 'Account name', value: envValue('WISE_ACCOUNT_NAME') },
    { label: 'Bank', value: envValue('WISE_BANK_NAME') },
    { label: 'Account no.', value: envValue('WISE_ACCOUNT_NUMBER') },
    { label: 'SWIFT', value: envValue('WISE_SWIFT') },
    { label: 'Currency', value: envValue('WISE_CURRENCY') },
    { label: 'Address', value: envValue('WISE_ADDRESS') },
    { label: 'City', value: envValue('WISE_CITY') },
    { label: 'Postcode', value: envValue('WISE_POSTCODE') },
    { label: 'Country', value: envValue('WISE_COUNTRY') },
  ].filter(f => f.value);

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
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;">${escapeHtml(it.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:center;">${it.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:right;">${formatUSD(it.price, currency)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eadfd1;text-align:right;">${formatUSD(line, currency)}</td>
      </tr>`;
    })
    .join('');

  const totalsRows: string[] = [];
  if (order.subtotal !== undefined) {
    totalsRows.push(`<tr><td style="padding:4px 12px;text-align:right;color:#6b6157;">Subtotal</td><td style="padding:4px 12px;text-align:right;width:120px;">${formatUSD(order.subtotal, currency)}</td></tr>`);
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
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${
            order.status === 'processing'
              ? `Thank you — we have received your payment confirmation for the order below and are verifying it now. We will email you again as soon as it ships. The payment details below are saved here in case you need to resend.`
              : `Thank you for your order with Lumée Maison. We have received your request and reserved your selection. Please complete payment using one of the methods below — once we confirm receipt, your order will be prepared for shipment.`
          }</p>
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
                ${
                  paymentWhatsapp
                    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #d6c8b0;font-size:12px;color:#6b6157;line-height:1.5;">
                        First-time senders: send a small test of <strong>1–5 USD</strong> first, then message us on WhatsApp <strong style="color:#3a342c;">${escapeHtml(paymentWhatsapp)}</strong> before sending the full amount.
                      </div>`
                    : ''
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
    textLines.push(`  - ${it.name} × ${it.quantity} @ ${formatUSD(it.price, currency)} = ${formatUSD(line, currency)}`);
  }
  if (order.subtotal !== undefined) textLines.push(`  Subtotal: ${formatUSD(order.subtotal, currency)}`);
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
    if (paymentWhatsapp) {
      textLines.push(`    First-time senders: send 1–5 USD test first, then WhatsApp ${paymentWhatsapp} before sending the full amount.`);
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
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(it.name)}</td>
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
    textLines.push(`  - ${it.name} × ${it.quantity} @ ${formatUSD(it.price, currency)} = ${formatUSD(line, currency)}`);
  }
  if (order.subtotal !== undefined) textLines.push(`  Subtotal: ${formatUSD(order.subtotal, currency)}`);
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
