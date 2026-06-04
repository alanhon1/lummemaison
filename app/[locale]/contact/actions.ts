'use server';

import { getTransporter, missingEmailEnv } from '@/lib/email/mailer';
import { siteConfig } from '@/lib/site-config';

export interface ContactState {
  ok?: boolean;
  error?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Sends the contact-form message to the shop inbox via SMTP (same mailer as the
// order emails). The customer's address is set as reply-to so the owner can
// reply straight from their inbox. Returns ok/error for in-page feedback —
// never opens the visitor's mail client.
export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get('name') ?? '').trim().slice(0, 200);
  const email = String(formData.get('email') ?? '').trim().slice(0, 200);
  const company = String(formData.get('company') ?? '').trim().slice(0, 200);
  const message = String(formData.get('message') ?? '').trim().slice(0, 5000);

  if (!name || !email || !message) {
    return { error: 'Please fill in your name, email, and message.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  const to = siteConfig.contact.email; // info@lumeemaison.com
  const from = process.env.SMTP_FROM;
  const cannotSend = `Sorry, we couldn't send your message right now. Please email us directly at ${to}.`;

  if (!from) {
    console.error('[contact] cannot send — missing email env:', missingEmailEnv().join(', '));
    return { error: cannotSend };
  }

  let transporter: ReturnType<typeof getTransporter>;
  try {
    transporter = getTransporter();
  } catch (e) {
    console.error('[contact] transporter init failed', e);
    return { error: cannotSend };
  }

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo: `${name} <${email}>`,
      subject: `New website message from ${name}${company ? ` (${company})` : ''}`,
      text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || '—'}\n\nMessage:\n${message}`,
      html:
        `<p><strong>Name:</strong> ${esc(name)}</p>` +
        `<p><strong>Email:</strong> ${esc(email)}</p>` +
        `<p><strong>Company:</strong> ${esc(company || '—')}</p>` +
        `<hr/>` +
        `<p style="white-space:pre-wrap">${esc(message)}</p>`,
    });
    return { ok: true };
  } catch (e) {
    console.error('[contact] send failed', e);
    return { error: cannotSend };
  }
}
