import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/admin-guard';

const CONFIG_FILE = path.join(process.cwd(), 'lib', 'site-config.ts');

// This endpoint rewrites a TypeScript source file (lib/site-config.ts) in place.
// A value that contains a double-quote, backslash or newline would break out of
// the string literal and inject arbitrary code that runs on the next build /
// server start. Reject anything that is not a plain, safe single-line value so
// the file can never be turned into a code-injection vector.
const MAX_LEN = 200;
function safeValue(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (v.length > MAX_LEN) return null;
  // Disallow the characters that could escape the "..." literal or smuggle code.
  if (/["\\\r\n`$<>]/.test(v)) return null;
  return v;
}

// `$` in a String.replace replacement string is special ($1, $&, $$ ...). Even
// though safeValue already rejects `$`, route every replacement through a
// function replacer so the value is inserted verbatim with zero interpretation.
function setField(src: string, pattern: RegExp, value: string): string {
  return src.replace(pattern, (m) => m.replace(/"[^"]*"/, `"${value}"`));
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const updates = await req.json();

  // Validate every supplied field up front; reject the whole request on any
  // unsafe value rather than writing a partially-applied / corrupt config.
  const fields = ['email', 'phone', 'whatsapp', 'telegram', 'waLink'] as const;
  const clean: Partial<Record<(typeof fields)[number], string>> = {};
  for (const f of fields) {
    if (updates[f] === undefined) continue;
    const v = safeValue(updates[f]);
    if (v === null) {
      return NextResponse.json({ error: `Invalid value for "${f}"` }, { status: 400 });
    }
    clean[f] = v;
  }

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
  if (clean.email !== undefined)    src = setField(src, /email: "[^"]*"/, clean.email);
  if (clean.phone !== undefined)    src = setField(src, /phone: "[^"]*"/, clean.phone);
  if (clean.whatsapp !== undefined) src = setField(src, /whatsapp: "(?!https:\/\/wa\.me)[^"]*"/, clean.whatsapp);
  if (clean.telegram !== undefined) src = setField(src, /telegram: "[^"]*"/, clean.telegram);
  if (clean.waLink !== undefined)   src = setField(src, /whatsapp: "https:\/\/wa\.me\/[^"]*"/, clean.waLink);

  try {
    fs.writeFileSync(CONFIG_FILE, src, 'utf8');
  } catch {
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
