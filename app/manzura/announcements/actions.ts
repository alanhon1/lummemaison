'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { ANNOUNCEMENTS_TAG, type AnnouncementPlacement } from '@/lib/announcements';

const BUCKET = 'announcement-images';
const PLACEMENTS: AnnouncementPlacement[] = ['home', 'catalogue', 'both', 'none'];

// This project is NOT on cacheComponents, so the runtime takes the legacy
// single-tag revalidateTag (see lib/catalogue-store.ts). Cast to that signature.
const revalidateAnnouncements = () =>
  (revalidateTag as (tag: string) => void)(ANNOUNCEMENTS_TAG);

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

export type ActionResult = { ok: true } | { ok: false; error: string };

type ServiceClient = ReturnType<typeof createServiceClient>;

// Uploads an optional image File to the public bucket and returns its public
// URL, or null if no file was provided. Throws on a real upload failure.
async function uploadImage(supabase: ServiceClient, file: FormDataEntryValue | null): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith('image/')) throw new Error('file must be an image');

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) throw new Error(`image upload failed: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function parseFields(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const placementRaw = String(formData.get('placement') ?? 'none');
  const placement: AnnouncementPlacement = (PLACEMENTS as string[]).includes(placementRaw)
    ? (placementRaw as AnnouncementPlacement)
    : 'none';
  const active = formData.get('active') != null;
  return { title, body, placement, active };
}

export async function createAnnouncement(formData: FormData): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const { title, body, placement, active } = parseFields(formData);
  if (!title) return { ok: false, error: 'Title is required' };
  if (!body) return { ok: false, error: 'Content is required' };

  const supabase = createServiceClient();

  let imageUrl: string | null;
  try {
    imageUrl = await uploadImage(supabase, formData.get('image'));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'image upload failed' };
  }

  const { error } = await supabase.from('announcements').insert({
    title,
    body,
    image_url: imageUrl,
    placement,
    active,
  });
  if (error) return { ok: false, error: error.message };

  revalidateAnnouncements();
  revalidatePath('/manzura/announcements');
  return { ok: true };
}

export async function updateAnnouncement(formData: FormData): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const id = Number.parseInt(String(formData.get('id') ?? ''), 10);
  if (!Number.isFinite(id)) return { ok: false, error: 'missing id' };

  const { title, body, placement, active } = parseFields(formData);
  if (!title) return { ok: false, error: 'Title is required' };
  if (!body) return { ok: false, error: 'Content is required' };

  const supabase = createServiceClient();

  // A new image replaces the old one; with no new file the existing image_url
  // is left untouched.
  let newImageUrl: string | null;
  try {
    newImageUrl = await uploadImage(supabase, formData.get('image'));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'image upload failed' };
  }

  const patch: Record<string, unknown> = {
    title,
    body,
    placement,
    active,
    updated_at: new Date().toISOString(),
  };
  if (newImageUrl) patch.image_url = newImageUrl;

  const { error } = await supabase.from('announcements').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidateAnnouncements();
  revalidatePath('/manzura/announcements');
  return { ok: true };
}

export async function toggleAnnouncement(id: number, active: boolean): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('announcements')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidateAnnouncements();
  revalidatePath('/manzura/announcements');
  return { ok: true };
}

export async function deleteAnnouncement(id: number): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const supabase = createServiceClient();
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidateAnnouncements();
  revalidatePath('/manzura/announcements');
  return { ok: true };
}
