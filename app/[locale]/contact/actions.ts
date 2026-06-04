'use server';

import { getTransporter, missingEmailEnv } from '@/lib/email/mailer';
import { contactMessageEmail } from '@/lib/email/templates';
import { siteConfig } from '@/lib/site-config';

export interface ContactState {
  ok?: boolean;
  error?: string;
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
    const rendered = contactMessageEmail({ name, email, company, message });
    await transporter.sendMail({
      from,
      to,
      replyTo: `${name} <${email}>`,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    return { ok: true };
  } catch (e) {
    console.error('[contact] send failed', e);
    return { error: cannotSend };
  }
}
