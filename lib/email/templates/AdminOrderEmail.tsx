import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { OrderEmailPayload } from '../types';
import { formatUSD } from '../types';

const cream = '#faf8f5';
const ink = '#1a1a1a';
const mist = '#6b6b6b';
const gold = '#a8874a';
const bone = '#e8e2d9';
const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
const display = 'Georgia, "Times New Roman", serif';

export default function AdminOrderEmail({ order }: { order: OrderEmailPayload }) {
  const shippingLabel =
    order.shippingCents === 6500
      ? 'USA — no FedEx account ($65 FedEx Priority)'
      : 'Flat $35 — FedEx';
  const created = new Date(order.createdAt);
  const createdReadable = `${created.toUTCString()}`;

  return (
    <Html>
      <Head />
      <Preview>
        New order {order.orderNumber} — {order.customerName} — {formatUSD(order.totalCents)}
      </Preview>
      <Body style={{ background: cream, fontFamily: sans, color: ink, margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: `1px solid ${bone}`, borderRadius: 8 }}>
          <Section style={{ padding: '28px 28px 16px 28px' }}>
            <Text style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: gold, margin: 0 }}>
              New order received
            </Text>
            <Heading as="h1" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 26, color: ink, margin: '8px 0 0 0' }}>
              {order.orderNumber}
            </Heading>
            <Text style={{ fontSize: 13, color: mist, margin: '4px 0 0 0' }}>
              {createdReadable}
            </Text>
          </Section>

          <Hr style={{ borderColor: bone, margin: '0 28px' }} />

          <Section style={{ padding: '20px 28px' }}>
            <Heading as="h2" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: ink, margin: '0 0 12px 0' }}>
              Customer
            </Heading>
            <Field label="Name" value={order.customerName} />
            <Field label="Email" value={order.customerEmail} mono />
            <Field label="Phone" value={order.customerPhone} mono />
          </Section>

          <Hr style={{ borderColor: bone, margin: '0 28px' }} />

          <Section style={{ padding: '20px 28px' }}>
            <Heading as="h2" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: ink, margin: '0 0 12px 0' }}>
              Ship to
            </Heading>
            <Text style={{ fontSize: 13, color: ink, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {[
                order.customerName,
                order.shippingAddress.street,
                [
                  order.shippingAddress.city,
                  order.shippingAddress.state_province,
                  order.shippingAddress.postal_code,
                ]
                  .filter(Boolean)
                  .join(', '),
                order.shippingAddress.countryName,
              ]
                .filter(Boolean)
                .join('\n')}
            </Text>
            {order.fedexAccount && (
              <Text style={{ fontSize: 13, color: ink, margin: '8px 0 0 0' }}>
                FedEx account: <strong style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{order.fedexAccount}</strong>
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: bone, margin: '0 28px' }} />

          <Section style={{ padding: '20px 28px' }}>
            <Heading as="h2" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: ink, margin: '0 0 12px 0' }}>
              Items ({order.items.length})
            </Heading>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontSize: 11, color: mist, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Product</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 11, color: mist, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', fontSize: 11, color: mist, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Line</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.product_id}>
                    <td style={{ padding: '4px 0', fontSize: 13, color: ink }}>
                      #{item.product_id} {item.product_name}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: 13, color: ink, textAlign: 'right' }}>
                      {item.quantity}
                    </td>
                    <td style={{ padding: '4px 0', fontSize: 13, color: ink, textAlign: 'right' }}>
                      {formatUSD(item.line_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Hr style={{ borderColor: bone, margin: '12px 0' }} />
            <SummaryRow label="Subtotal" value={formatUSD(order.subtotalCents)} muted />
            <SummaryRow label={`Shipping — ${shippingLabel}`} value={formatUSD(order.shippingCents)} muted />
            <SummaryRow label="Total" value={formatUSD(order.totalCents)} strong />
          </Section>

          <Hr style={{ borderColor: bone, margin: '0 28px' }} />

          <Section style={{ padding: '16px 28px 28px 28px' }}>
            <Text style={{ fontSize: 12, color: mist, margin: 0 }}>
              Payment status: <strong style={{ color: ink }}>pending</strong>. Customer was asked to email a transaction screenshot to {order.payment.adminEmail}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td style={{ padding: '3px 0', fontSize: 11, color: mist, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, width: 110 }}>
            {label}
          </td>
          <td
            style={{
              padding: '3px 0',
              fontSize: 13,
              color: ink,
              fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : sans,
            }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td style={{ padding: '4px 0', fontSize: strong ? 14 : 13, color: muted ? mist : ink, fontWeight: strong ? 600 : 400 }}>
            {label}
          </td>
          <td style={{ padding: '4px 0', fontSize: strong ? 16 : 13, color: strong ? ink : muted ? mist : ink, textAlign: 'right', fontWeight: strong ? 600 : 400 }}>
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
