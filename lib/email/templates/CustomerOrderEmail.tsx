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
const display = 'Georgia, "Times New Roman", serif';
const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

export default function CustomerOrderEmail({ order }: { order: OrderEmailPayload }) {
  const greeting = order.customerName.split(' ')[0] || order.customerName;
  const shippingLabel =
    order.shippingCents === 6500
      ? '$65 — FedEx Priority (no FedEx account)'
      : '$35 flat — FedEx';

  return (
    <Html>
      <Head />
      <Preview>
        Your Lumée Maison order {order.orderNumber} — payment instructions inside
      </Preview>
      <Body style={{ background: cream, fontFamily: sans, color: ink, margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: `1px solid ${bone}`, borderRadius: 8 }}>
          <Section style={{ padding: '28px 28px 16px 28px', textAlign: 'center' }}>
            <Text style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: gold, margin: 0 }}>
              Lumée Maison
            </Text>
            <Heading as="h1" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 28, color: ink, margin: '12px 0 4px 0' }}>
              Thank you, {greeting}.
            </Heading>
            <Text style={{ fontSize: 14, color: mist, margin: 0 }}>
              Order <strong style={{ color: ink }}>{order.orderNumber}</strong> received.
            </Text>
          </Section>

          <Hr style={{ borderColor: bone, margin: '0 28px' }} />

          <Section style={{ padding: '20px 28px' }}>
            <Heading as="h2" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: ink, margin: '0 0 12px 0' }}>
              Order summary
            </Heading>
            {order.items.map(item => (
              <Row
                key={item.product_id}
                label={`${item.product_name} × ${item.quantity}`}
                value={formatUSD(item.line_cents)}
              />
            ))}
            <Hr style={{ borderColor: bone, margin: '12px 0' }} />
            <Row label="Subtotal" value={formatUSD(order.subtotalCents)} muted />
            <Row label={`Shipping (${shippingLabel})`} value={formatUSD(order.shippingCents)} muted />
            <Row label="Total" value={formatUSD(order.totalCents)} strong />
          </Section>

          <Hr style={{ borderColor: bone, margin: '0 28px' }} />

          <Section style={{ padding: '20px 28px' }}>
            <Heading as="h2" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: ink, margin: '0 0 12px 0' }}>
              Send payment — choose either
            </Heading>

            <Heading as="h3" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 15, color: ink, margin: '12px 0 6px 0' }}>
              Wise — Bank transfer
            </Heading>
            <Row label="Account name" value={order.payment.wise.accountName} muted />
            <Row label="Bank" value={order.payment.wise.bankName} muted />
            <Row label="Account #" value={order.payment.wise.accountNumber} muted mono />
            <Row label="SWIFT / Routing" value={order.payment.wise.swift} muted mono />
            <Row label="Reference" value={order.orderNumber} muted mono />

            <Heading as="h3" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 15, color: ink, margin: '16px 0 6px 0' }}>
              USDT — TRC-20 only
            </Heading>
            <Row label="Network" value={order.payment.usdt.network} muted />
            <Row label="Address" value={order.payment.usdt.address} muted mono />
            <Text style={{ fontSize: 12, color: mist, margin: '6px 0 0 0' }}>
              TRC-20 (Tron) only. Sending on another network (e.g. ERC-20) will lose your funds.
            </Text>

            <Text style={{ fontSize: 13, color: ink, margin: '16px 0 0 0' }}>
              After sending, please email a screenshot of the transaction to{' '}
              <strong>{order.payment.adminEmail}</strong> with your order number{' '}
              <strong>{order.orderNumber}</strong>.
            </Text>
          </Section>

          <Hr style={{ borderColor: bone, margin: '0 28px' }} />

          <Section style={{ padding: '20px 28px' }}>
            <Heading as="h2" style={{ fontFamily: display, fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: ink, margin: '0 0 12px 0' }}>
              A few reminders
            </Heading>
            <Text style={{ fontSize: 13, color: mist, margin: '0 0 10px 0' }}>
              <strong style={{ color: ink }}>Shipping.</strong> $35 flat from South Korea via FedEx (or $65 FedEx Priority for USA without a FedEx account). Carrier varies by destination — the most reliable option for your country is selected automatically.
            </Text>
            <Text style={{ fontSize: 13, color: mist, margin: '0 0 10px 0' }}>
              <strong style={{ color: ink }}>Delivery time.</strong> 3–5 business days once shipped, depending on customs.
            </Text>
            <Text style={{ fontSize: 13, color: mist, margin: '0 0 0 0' }}>
              <strong style={{ color: ink }}>Stock.</strong> Some products are made-to-order and need 1–4 business days from our supplier before shipping. You'll receive an email if any of yours are in that category.
            </Text>
          </Section>

          <Hr style={{ borderColor: bone, margin: '0 28px' }} />

          <Section style={{ padding: '16px 28px 28px 28px' }}>
            <Text style={{ fontSize: 12, color: mist, margin: 0 }}>
              Questions? Reply to this email or write to{' '}
              <strong>{order.payment.adminEmail}</strong>.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }} cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td style={{ padding: '4px 0', fontSize: strong ? 14 : 13, color: muted ? mist : ink, fontWeight: strong ? 600 : 400 }}>
            {label}
          </td>
          <td
            style={{
              padding: '4px 0',
              fontSize: strong ? 16 : 13,
              color: strong ? ink : muted ? mist : ink,
              fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : sans,
              textAlign: 'right',
              fontWeight: strong ? 600 : 400,
              wordBreak: mono ? 'break-all' : 'normal',
            }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
