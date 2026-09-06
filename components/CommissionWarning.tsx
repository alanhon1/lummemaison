import { AlertTriangle } from 'lucide-react';

// Hard warning that the Wise/bank transfer commission is the SENDER's to cover.
// Customers routinely send the invoice total MINUS their bank's commission,
// which leaves the received amount short and stalls fulfilment — so this is
// styled as a blocking warning, never fine print.
//
// Presentational on purpose (strings come in as props, no translation hook), so
// the same component renders from a client component (checkout PaymentStep) and
// from server components (customer order detail) without duplication.
export default function CommissionWarning({
  title,
  body,
  className = '',
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-md border-2 border-red-400 bg-red-50 p-4 text-sm text-red-800 ${className}`}
    >
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{title}</span>
      </p>
      <p className="mt-1.5 pl-6 leading-relaxed text-red-700">{body}</p>
    </div>
  );
}
