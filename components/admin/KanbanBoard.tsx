import Link from 'next/link';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

export interface KanbanOrder {
  id: number;
  order_seq: number | null;
  order_number: string;
  status: string;
  customer_name: string;
  total_cents: number;
  currency: string;
  created_at: string;
}

const COLUMNS: Array<{
  status: string;
  label: string;
  headerCls: string;
  borderCls: string;
  countCls: string;
}> = [
  { status: 'order_received',   label: 'Received',    headerCls: 'bg-amber-50  border-amber-200',  borderCls: 'border-amber-200',  countCls: 'bg-amber-100 text-amber-800' },
  { status: 'payment_verified', label: 'Verified',    headerCls: 'bg-sky-50    border-sky-200',    borderCls: 'border-sky-200',    countCls: 'bg-sky-100   text-sky-800'   },
  { status: 'packaging',        label: 'Packing',     headerCls: 'bg-indigo-50 border-indigo-200', borderCls: 'border-indigo-200', countCls: 'bg-indigo-100 text-indigo-800' },
  { status: 'shipped',          label: 'Shipped',     headerCls: 'bg-emerald-50 border-emerald-200', borderCls: 'border-emerald-200', countCls: 'bg-emerald-100 text-emerald-800' },
  { status: 'delivered',        label: 'Delivered',   headerCls: 'bg-stone-100 border-stone-300',  borderCls: 'border-stone-300',  countCls: 'bg-stone-200  text-stone-700'  },
];

function formatTotal(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function KanbanBoard({
  ordersByStatus,
}: {
  ordersByStatus: Map<string, KanbanOrder[]>;
}) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-[900px]">
        {COLUMNS.map(col => {
          const orders = ordersByStatus.get(col.status) ?? [];
          return (
            <div key={col.status} className="flex-1 min-w-[168px] flex flex-col">
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 border rounded-t-md ${col.headerCls}`}>
                <span className="text-xs font-semibold tracking-wider uppercase text-charcoal">
                  {col.label}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.countCls}`}>
                  {orders.length}
                </span>
              </div>

              {/* Cards */}
              <div className={`flex-1 border-x border-b rounded-b-md ${col.borderCls} bg-white overflow-y-auto max-h-[calc(100vh-260px)] divide-y divide-bone`}>
                {orders.length === 0 ? (
                  <p className="text-[11px] text-mist text-center py-6 px-2">Empty</p>
                ) : (
                  orders.map(o => {
                    const display = o.order_seq !== null
                      ? formatOrderNumber(o.order_seq)
                      : o.order_number;
                    return (
                      <Link
                        key={o.id}
                        href={`/manzura/orders/${o.id}`}
                        className="block px-3 py-2.5 hover:bg-cream transition-colors"
                      >
                        <p className="font-mono text-xs text-charcoal font-semibold">{display}</p>
                        <p className="text-[11px] text-charcoal truncate mt-0.5">{o.customer_name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-gold-dark font-semibold">
                            {formatTotal(o.total_cents, o.currency)}
                          </span>
                          <span className="text-[10px] text-mist">{relativeDate(o.created_at)}</span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
