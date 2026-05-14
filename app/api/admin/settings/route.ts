import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'lib', 'site-config.ts');

export async function PATCH(req: NextRequest) {
  const updates = await req.json();
  let src = fs.readFileSync(CONFIG_FILE, 'utf8');

  // These replacements target the `contact` block fields.
  // `contact.whatsapp` is a plain phone string (e.g. "+82-10-0000-0000"),
  // while `social.whatsapp` is a https://wa.me/... URL — handled separately
  // by the waLink block below, which uses a more specific regex.
  // Because `contact.whatsapp` appears before `social.whatsapp` in the file,
  // the first regex match targets the contact entry only.
  const replacements: Record<string, string> = {
    email: `email: "${updates.email}"`,
    phone: `phone: "${updates.phone}"`,
    whatsapp: `whatsapp: "${updates.whatsapp}"`,
    telegram: `telegram: "${updates.telegram}"`,
  };

  for (const [field, replacement] of Object.entries(replacements)) {
    src = src.replace(new RegExp(`${field}: "[^"]*"`), replacement);
  }

  if (updates.waLink) {
    src = src.replace(/whatsapp: "https:\/\/wa\.me\/[^"]*"/, `whatsapp: "${updates.waLink}"`);
  }

  fs.writeFileSync(CONFIG_FILE, src, 'utf8');
  return NextResponse.json({ ok: true });
}
