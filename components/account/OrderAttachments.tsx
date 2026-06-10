'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, X, Trash2 } from 'lucide-react';
import { addOrderAttachment, deleteOrderAttachment } from '@/app/[locale]/account/orders/[seq]/actions';

export interface OrderAttachment {
  id: number;
  url: string;
  comment: string | null;
  createdAt: string;
}

const MAX = 3;
const MAX_COMMENT = 50;

// Shown on both the customer order page (interactive) and the admin order page
// (readOnly). Customers can attach up to 3 photos, one at a time, each with an
// optional short comment; thumbnails enlarge on click.
export default function OrderAttachments({
  orderId,
  attachments,
  readOnly = false,
}: {
  orderId: number;
  attachments: OrderAttachment[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canAdd = !readOnly && attachments.length < MAX;

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Please choose a photo.'); return; }
    const fd = new FormData();
    fd.set('orderId', String(orderId));
    fd.set('photo', file);
    fd.set('comment', comment);
    setError('');
    startTransition(async () => {
      const res = await addOrderAttachment(fd);
      if (!res.ok) { setError(res.error ?? 'Upload failed'); return; }
      setComment(''); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    if (!window.confirm('Remove this photo?')) return;
    setError('');
    startTransition(async () => {
      const res = await deleteOrderAttachment(id);
      if (!res.ok) { setError(res.error ?? 'Delete failed'); return; }
      router.refresh();
    });
  }

  return (
    <div>
      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {attachments.map(a => (
            <li key={a.id} className="w-28">
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => a.url && setLightbox(a.url)}
                  className="block w-28 h-28 rounded-md overflow-hidden border border-bone bg-cream"
                  title="Click to enlarge"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.comment ?? 'Order photo'} className="w-full h-full object-cover" />
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    disabled={isPending}
                    className="absolute -top-2 -right-2 bg-white border border-bone rounded-full p-1 text-mist hover:text-rose-600 shadow disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              {a.comment && <p className="text-[11px] text-charcoal mt-1 break-words leading-snug">{a.comment}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mist italic">{readOnly ? 'No photos attached.' : 'No photos yet.'}</p>
      )}

      {canAdd && (
        <form onSubmit={handleUpload} className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-xs inline-flex items-center gap-1.5 border border-bone rounded-md px-3 py-2 cursor-pointer hover:border-gold text-charcoal">
            <ImagePlus size={14} />
            {fileName || 'Choose photo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
            />
          </label>
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value.slice(0, MAX_COMMENT))}
            maxLength={MAX_COMMENT}
            placeholder={`Comment (optional, ≤${MAX_COMMENT})`}
            className="text-xs border border-bone rounded-md px-3 py-2 flex-1 min-w-40 outline-none focus:border-gold text-charcoal"
          />
          <button
            type="submit"
            disabled={isPending}
            className="btn-gold text-xs disabled:opacity-50"
          >
            {isPending ? 'Uploading…' : 'Add photo'}
          </button>
          <span className="text-[11px] text-mist w-full">{attachments.length}/{MAX} attached</span>
        </form>
      )}

      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Order photo" className="max-h-[90vh] max-w-full rounded-md" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
