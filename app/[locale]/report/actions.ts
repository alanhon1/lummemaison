'use server';

import { createServiceClient } from '@/lib/supabase/server';

export interface ReportState {
  ok?: boolean;
  error?: string;
}

// Public "Report an issue" submission. Open to anyone (logged in or not), so it
// runs with the service-role client (RLS on reported_issues has no public policy
// — see migration 025). Minimal fields: the message is required, a contact email
// is optional. Failures are reported back to the form, never thrown.
export async function reportIssue(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const message = String(formData.get('message') ?? '').trim().slice(0, 4000);
  const contactEmail = String(formData.get('contactEmail') ?? '').trim().slice(0, 200);

  if (!message) return { error: 'Please describe the issue before sending.' };
  if (message.length < 3) return { error: 'Please add a little more detail.' };

  const admin = createServiceClient();
  const { error } = await admin.from('reported_issues').insert({
    message,
    contact_email: contactEmail || null,
  });
  if (error) {
    console.error('[report] insert failed:', error.message);
    return { error: "We couldn't submit your report right now. Please try again shortly." };
  }
  return { ok: true };
}
