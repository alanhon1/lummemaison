import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'lib', 'site-config.ts');

export async function PATCH(req: NextRequest) {
  const updates = await req.json();

  let src: string;
  try {
    src = fs.readFileSync(CONFIG_FILE, 'utf8');
  } catch {
    return NextResponse.json({ error: 'Config file not readable' }, { status: 500 });
  }

  // These replacements target the `contact` block fields.
  // `contact.whatsapp` is a plain phone string (e.g. "+82-10-0000-0000"),
  // while `social.whatsapp` is a https://wa.me/... URL — handled separately
  // by the waLink block below, which uses a more specific regex.
  // Because `contact.whatsapp` appears before `social.whatsapp` in the file,
  // the first regex match targets the contact entry only.

  if (updates.email !== undefined) {
    src = src.replace(/email: "[^"]*"/, `email: "${updates.email}"`);
  }
  if (updates.phone !== undefined) {
    src = src.replace(/phone: "[^"]*"/, `phone: "${updates.phone}"`);
  }
  if (updates.whatsapp !== undefined) {
    src = src.replace(/whatsapp: "(?!https:\/\/wa\.me)[^"]*"/, `whatsapp: "${updates.whatsapp}"`);
  }
  if (updates.telegram !== undefined) {
    src = src.replace(/telegram: "[^"]*"/, `telegram: "${updates.telegram}"`);
  }
  if (updates.waLink !== undefined) {
    src = src.replace(/whatsapp: "https:\/\/wa\.me\/[^"]*"/, `whatsapp: "${updates.waLink}"`);
  }

  try {
    fs.writeFileSync(CONFIG_FILE, src, 'utf8');
  } catch {
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
