'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import {
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
} from '@/app/manzura/announcements/actions';
import type { Announcement, AnnouncementPlacement } from '@/lib/announcements';

interface Props { items: Announcement[]; }

const PLACEMENT_LABELS: Record<AnnouncementPlacement, string> = {
  home: 'Homepage popup',
  catalogue: 'Catalogue popup',
  both: 'Home + Catalogue popup',
  none: 'List page only (no popup)',
};

const inputCls = 'w-full border border-bone rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-charcoal';
const labelCls = 'block text-xs font-semibold tracking-wide text-mist uppercase mb-1';

export default function AnnouncementsClient({ items }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [formError, setFormError] = useState('');
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setFormError('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = editing
        ? await updateAnnouncement(fd)
        : await createAnnouncement(fd);
      if (!result.ok) { setFormError(result.error); return; }
      closeForm();
    });
  }

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => { await toggleAnnouncement(id, !current); });
  }

  function handleDelete(id: number, title: string) {
    if (!window.confirm(`Delete announcement "${title}"?`)) return;
    startTransition(async () => {
      const result = await deleteAnnouncement(id);
      if (!result.ok) alert(result.error);
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display italic text-2xl text-charcoal">Announcements</h1>
          <p className="text-xs text-mist mt-0.5">{items.length} announcement{items.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <button onClick={openCreate} className="btn-gold text-xs">+ New Announcement</button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-bone rounded-lg p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display italic text-lg text-charcoal">
              {editing ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            <button type="button" onClick={closeForm} className="text-xs text-mist hover:text-charcoal">Cancel</button>
          </div>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}

          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div>
            <label className={labelCls}>Title *</label>
            <input name="title" required defaultValue={editing?.title ?? ''} placeholder="Holiday shipping update" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Content *</label>
            <textarea name="body" required rows={5} defaultValue={editing?.body ?? ''} placeholder="Write the announcement customers will see…" className={`${inputCls} resize-y`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Where to show (popup)</label>
              <select name="placement" defaultValue={editing?.placement ?? 'none'} className={inputCls}>
                {(Object.keys(PLACEMENT_LABELS) as AnnouncementPlacement[]).map(p => (
                  <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
                ))}
              </select>
              <p className="text-[10px] text-mist mt-1">Popups show once per visitor, after they accept the welcome disclaimer.</p>
            </div>
            <div>
              <label className={labelCls}>Image (optional)</label>
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" className={`${inputCls} py-1`} />
              {editing?.image_url && (
                <div className="mt-2 flex items-center gap-2">
                  <Image src={editing.image_url} alt="" width={48} height={48} className="w-12 h-12 object-cover rounded border border-bone" unoptimized />
                  <span className="text-[10px] text-mist">Current image — choose a file to replace it.</span>
                </div>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} className="accent-gold" />
            Active (visible to customers)
          </label>

          {!editing && (
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" name="push" className="accent-gold" />
              Also push to subscribed customers (banner + inbox)
            </label>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-gold text-xs">
              {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Announcement'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="bg-white border border-bone rounded-lg p-8 text-center text-sm text-mist italic">
          No announcements yet. Create one above.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className="bg-white border border-bone rounded-lg p-4 flex gap-4">
              {a.image_url && (
                <Image src={a.image_url} alt="" width={64} height={64} className="w-16 h-16 object-cover rounded border border-bone shrink-0" unoptimized />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-charcoal truncate">{a.title}</h3>
                    <p className="text-xs text-mist line-clamp-2 mt-0.5 whitespace-pre-line">{a.body}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${a.active ? 'bg-gold/15 text-gold-dark' : 'bg-bone text-mist'}`}>
                    {a.active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-mist">
                  <span>{PLACEMENT_LABELS[a.placement]}</span>
                  <span>·</span>
                  <span>{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => handleToggle(a.id, a.active)}
                    disabled={isPending}
                    className="text-xs text-charcoal hover:text-gold-dark disabled:opacity-40"
                  >
                    {a.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEdit(a)} disabled={isPending} className="text-xs text-charcoal hover:text-gold-dark disabled:opacity-40">Edit</button>
                  <button onClick={() => handleDelete(a.id, a.title)} disabled={isPending} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
