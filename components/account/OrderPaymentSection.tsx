'use client';

import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AlertTriangle, CheckCircle2, FileCheck2, Loader2 } from 'lucide-react';
import WisePaymentInfo from '@/components/checkout/WisePaymentInfo';
import {
  uploadPaymentProof,
  attachOrderPaymentProof,
} from '@/app/[locale]/checkout/actions';

const ACCEPTED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

interface Props {
  orderId: number;
  totalCents: number;
  currency: string;
}

export default function OrderPaymentSection({ orderId, totalCents, currency }: Props) {
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [proofPath, setProofPath] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [transactionLink, setTransactionLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const formattedTotal = (totalCents / 100).toLocaleString(
    locale === 'ru' ? 'ru-RU' : 'en-US',
    { style: 'currency', currency },
  );

  async function handleFile(file: File) {
    setUploadError('');
    if (file.size > MAX_PROOF_BYTES) {
      setUploadError('File is larger than 10 MB.');
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type)) {
      setUploadError('Unsupported file type. Please upload a PNG, JPG, WEBP, HEIC, or PDF.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await uploadPaymentProof(fd);
      if (!res.ok || !res.path) {
        setUploadError(res.error ?? 'Upload failed. Please try again.');
        return;
      }
      setProofPath(res.path);
      setProofFileName(file.name);
      setSubmitError('');
    } finally {
      setUploading(false);
    }
  }

  function clearProof() {
    setProofPath('');
    setProofFileName('');
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit() {
    if (!proofPath) {
      setSubmitError('Please upload a payment screenshot first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await attachOrderPaymentProof(
        orderId,
        proofPath,
        transactionLink.trim() || undefined,
      );
      if (!res.ok) {
        setSubmitError(res.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="bg-white border border-bone rounded-lg p-5 md:p-6 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-green-600 mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold text-charcoal text-sm">Payment proof received</p>
            <p className="text-sm text-mist mt-1">
              We&apos;ll verify your payment and update your order status shortly.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Final total */}
      <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <h2 className="font-display italic text-xl text-charcoal mb-4">Payment Due</h2>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-mist">Final total (including shipping)</span>
          <span className="font-display text-2xl text-charcoal">{formattedTotal}</span>
        </div>
        <p className="text-xs text-mist mt-2">
          Please send exactly this amount via Wise, then upload your payment screenshot below.
        </p>
      </section>

      {/* Wise payment details */}
      <WisePaymentInfo />

      {/* Payment proof upload */}
      <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <header className="flex items-center gap-2 mb-2">
          <FileCheck2 size={20} className="text-gold-dark" aria-hidden />
          <h2 className="font-display italic text-xl text-charcoal">Upload Payment Screenshot</h2>
        </header>
        <p className="text-sm text-mist mb-5">
          Once you&apos;ve sent payment via Wise, upload a screenshot as proof. We&apos;ll verify it and update your order.
        </p>

        <div className="space-y-4">
          {/* File upload */}
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
              Payment screenshot
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME.join(',')}
              disabled={uploading}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="block w-full text-sm text-charcoal file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:tracking-widest file:uppercase file:bg-gold-dark/10 file:text-gold-dark hover:file:bg-gold-dark/20 file:cursor-pointer cursor-pointer"
            />
            <p className="text-xs text-mist mt-1.5">PNG, JPG, WEBP, HEIC, or PDF — max 10 MB</p>

            {uploading && (
              <p className="text-xs text-mist mt-2 flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Uploading…
              </p>
            )}
            {proofPath && !uploading && (
              <div className="mt-2 flex items-center gap-3 bg-cream border border-bone rounded-md px-3 py-2">
                <FileCheck2 size={16} className="text-gold-dark shrink-0" aria-hidden />
                <span className="text-sm text-charcoal truncate flex-1">
                  {proofFileName} — uploaded
                </span>
                <button
                  type="button"
                  onClick={clearProof}
                  className="text-xs text-mist hover:text-gold-dark underline underline-offset-4"
                >
                  Replace
                </button>
              </div>
            )}
            {uploadError && (
              <p className="text-sm text-red-600 mt-2 flex items-start gap-1.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                {uploadError}
              </p>
            )}
          </div>

          {/* Transaction link — optional */}
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
              Wise transaction link
              <span className="ml-1.5 text-[10px] font-normal normal-case tracking-normal text-mist">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={transactionLink}
              onChange={e => setTransactionLink(e.target.value)}
              placeholder="https://wise.com/transactions/..."
              maxLength={500}
              className="w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors"
            />
          </div>
        </div>

        {submitError && (
          <p
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mt-4 flex items-start gap-1.5"
            role="alert"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {submitError}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading || !proofPath}
            className="btn-gold disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Payment Proof'}
          </button>
        </div>
      </section>
    </div>
  );
}
