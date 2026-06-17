import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllProducts } from '@/lib/catalogue';
import InboundForm from '@/components/admin/InboundForm';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { ClickableRow } from '@/components/admin/ClickableRow';
import { type HistoryMovement } from '@/components/admin/BatchHistoryTable';
import HistorySection from '@/components/admin/HistorySection';
import ProductStockDetails from '@/components/admin/ProductStockDetails';
import WonderMark from '@/components/admin/WonderMark';
import StockOverviewPanel from '@/components/admin/StockOverviewPanel';
import StockExportButton from '@/components/admin/StockExportButton';
import OrdersExportButton from '@/components/admin/OrdersExportButton';

export const dynamic = 'force-dynamic';

type Tab = 'stock' | 'history' | 'orders' | 'add';

type StockSort = 'qty-asc' | 'qty-desc' | 'name-asc' | 'id-asc';

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    pid?: string;
    from?: string;
    to?: string;
    reason?: string;
    cid?: string;
    date?: string;
    month?: string;
    page?: string;
    sort?: string;
    wonderOnly?: string;
    nonWonderOnly?: string;
  }>;
}

const REASON_META: Record<string, { label: string; cls: string }> = {
  inbound:        { label: 'Inbound',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  order:          { label: 'Order',         cls: 'bg-sky-50 text-sky-700 border-sky-200'             },
  cancel_restock: { label: 'Cancel +stock', cls: 'bg-amber-50 text-amber-700 border-amber-200'       },
  auto_add:       { label: 'Auto add stock', cls: 'bg-violet-50 text-violet-700 border-violet-200'   },
  adjustment:     { label: 'Adjustment',    cls: 'bg-stone-50 text-stone-600 border-stone-200'       },
};

const STATUS_LABEL: Record<string, string> = {
  order_received:   'Received',
  payment_verified: 'Verified',
  packaging:        'Packing',
  shipped:          'Shipped',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
};

// KST date string "YYYY-MM-DD" from an ISO timestamp.
function toKstDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

// KST datetime for display.
function toKstDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso)).replace(',', '');
}

// Build start-of-day UTC bound for a KST date string.
function kstDateToUtcStart(kstDate: string): string {
  // "2025-03-15" in KST = "2025-03-14T15:00:00Z" UTC (KST is UTC+9)
  return new Date(`${kstDate}T00:00:00+09:00`).toISOString();
}
function kstDateToUtcEnd(kstDate: string): string {
  return new Date(`${kstDate}T23:59:59+09:00`).toISOString();
}

// Simple 5-column calendar for a given year+month. markedDates = Set<"YYYY-MM-DD">.
function MiniCalendar({
  year, month, markedDates, baseParams,
}: {
  year: number; month: number; markedDates: Set<string>; baseParams: string;
}) {
  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const monthLabel = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const today = toKstDate(new Date().toISOString());
  const days: Array<{ d: number; key: string } | null> = [];

  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ d, key });
  }

  return (
    <div className="bg-white border border-bone rounded p-4 max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <Link
          href={`/manzura/stock?tab=history&month=${prevMonth}&${baseParams}`}
          className="text-mist hover:text-charcoal text-sm px-2"
        >
          ‹
        </Link>
        <span className="text-xs font-semibold text-charcoal uppercase tracking-widest">{monthLabel}</span>
        <Link
          href={`/manzura/stock?tab=history&month=${nextMonth}&${baseParams}`}
          className="text-mist hover:text-charcoal text-sm px-2"
        >
          ›
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] text-mist mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {days.map((item, i) => {
          if (!item) return <span key={`e${i}`} />;
          const { d, key } = item;
          const hasMovements = markedDates.has(key);
          const isToday = key === today;
          return (
            <Link
              key={key}
              href={`/manzura/stock?tab=history&date=${key}&month=${year}-${String(month).padStart(2, '0')}`}
              className={`relative flex items-center justify-center h-7 w-full text-xs rounded transition-colors ${
                isToday ? 'font-bold text-gold-dark' : 'text-charcoal'
              } hover:bg-cream`}
            >
              {d}
              {hasMovements && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function StockPage({ searchParams }: PageProps) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const sp = await searchParams;
  const rawTab = sp.tab;
  const tab: Tab = rawTab === 'history' ? 'history' : rawTab === 'orders' ? 'orders' : rawTab === 'add' ? 'add' : 'stock';

  const supabase = createServiceClient();
  const allProducts = await getAllProducts();
  const productById = new Map(allProducts.map(p => [p.id, p.name as string]));

  const tabBar = (
    <div className="flex flex-wrap gap-2 mb-6">
      {(['stock', 'history', 'orders', 'add'] as const).map(v => (
        <Link
          key={v}
          href={`/manzura/stock${v === 'stock' ? '' : `?tab=${v}`}`}
          className={`text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
            tab === v
              ? 'bg-charcoal text-cream border-charcoal'
              : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
          }`}
        >
          {v === 'stock' ? 'Stock' : v === 'history' ? 'History' : v === 'orders' ? 'Orders' : 'Add Inbound'}
        </Link>
      ))}
    </div>
  );

  // ── STOCK TAB ─────────────────────────────────────────────────
  if (tab === 'stock') {
    const sort = (sp.sort ?? 'qty-asc') as StockSort;

    const wonderOnly = sp.wonderOnly === '1';
    const nonWonderOnly = !wonderOnly && sp.nonWonderOnly === '1';
    const { data: stockRows } = await supabase
      .from('product_stock')
      .select('product_id, option, stock, wonder, stock_unknown');

    const rows = (stockRows ?? []) as Array<{ product_id: number; option: string; stock: number; wonder: boolean; stock_unknown: boolean }>;
    const rowFor = (id: number, opt: string) => rows.find(r => r.product_id === id && r.option === opt);

    // One row per (product, option); optionless products get a single '' row.
    let allRows = allProducts.flatMap(p => {
      const opts = p.options && p.options.length > 0 ? p.options : [''];
      return opts.map(opt => ({
        id: p.id,
        name: opt ? `${p.name} — ${opt}` : (p.name as string),
        option: opt,
        stock: rowFor(p.id, opt)?.stock ?? 0,
        wonder: Boolean(rowFor(p.id, opt)?.wonder),
        unknown: Boolean(rowFor(p.id, opt)?.stock_unknown),
      }));
    });
    if (wonderOnly) allRows = allRows.filter(r => r.wonder);
    else if (nonWonderOnly) allRows = allRows.filter(r => !r.wonder);
    allRows = allRows.sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      if (sort === 'id-asc')   return a.id - b.id;
      if (sort === 'qty-desc') return b.stock - a.stock;
      return a.stock - b.stock; // qty-asc (default)
    });

    const outOfStock = allRows.filter(r => r.stock <= 0).length;
    const lowStock   = allRows.filter(r => r.stock > 0 && r.stock <= 3).length;

    const todayKst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-light text-charcoal">Stock</h1>
          <div className="flex items-center gap-2">
            <StockOverviewPanel
              rows={allRows}
              outOfStock={outOfStock}
              lowStock={lowStock}
            />
            <StockExportButton rows={allRows} date={todayKst} />
          </div>
        </div>
        {tabBar}

        <div className="flex flex-wrap gap-3 mb-6">
          <span className="text-xs px-3 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
            {allRows.length} products
          </span>
          {outOfStock > 0 && (
            <span className="text-xs px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
              {outOfStock} sold out
            </span>
          )}
          {lowStock > 0 && (
            <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {lowStock} low (≤ 3)
            </span>
          )}
        </div>

        {/* Sort controls */}
        <form method="GET" action="/manzura/stock" className="flex items-center gap-2 mb-3">
          <input type="hidden" name="tab" value="stock" />
          <label className="text-[10px] uppercase tracking-widest text-mist">Sort</label>
          <select name="sort" defaultValue={sort}
            className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold">
            <option value="qty-asc">Quantity: Low → High</option>
            <option value="qty-desc">Quantity: High → Low</option>
            <option value="name-asc">Name: A → Z</option>
            <option value="id-asc">ID: Low → High</option>
          </select>
          <button type="submit" className="text-xs border border-bone px-3 py-1.5 rounded text-mist hover:text-charcoal transition-colors">
            Apply
          </button>
          <a
            href={`/manzura/stock?tab=stock${wonderOnly ? '' : '&wonderOnly=1'}&sort=${sort}`}
            title="Arbitrarily assigned stock"
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              wonderOnly
                ? 'bg-amber-400 text-amber-950 border-amber-400'
                : 'border-bone text-mist hover:text-charcoal'
            }`}
          >
            {wonderOnly ? 'S only ✓' : 'S only'}
          </a>
          <a
            href={`/manzura/stock?tab=stock${nonWonderOnly ? '' : '&nonWonderOnly=1'}&sort=${sort}`}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              nonWonderOnly
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-bone text-mist hover:text-charcoal'
            }`}
          >
            {nonWonderOnly ? 'Non-S ✓' : 'Non-S'}
          </a>
        </form>

        <div className="bg-white border border-bone rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-bone">
              <tr className="text-[10px] uppercase tracking-widest text-mist">
                <th className="text-left px-4 py-3 font-semibold">ID</th>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-right px-4 py-3 font-semibold">Stock</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {allRows.map(r => {
                const isOut = r.stock <= 0;
                const isLow = !isOut && r.stock <= 3;
                return (
                  <tr key={`${r.id}-${r.option}`} className={`border-t border-bone ${isOut ? 'bg-rose-50/30' : isLow ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-mist font-mono">#{r.id}</td>
                    <td className="px-4 py-2.5 text-charcoal text-sm">
                      <span className="inline-flex items-center gap-1">
                        {r.name}
                        {r.wonder && <WonderMark />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-charcoal">
                      {r.stock}
                    </td>
                    <td className="px-4 py-2.5">
                      {isOut ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Sold out</span>
                      ) : isLow ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Low</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <ProductStockDetails productId={r.id} option={r.option} productName={r.name as string} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    );
  }

  // ── HISTORY TAB ───────────────────────────────────────────────
  if (tab === 'history') {
    const pidParam   = sp.pid   ?? '';
    const fromParam  = sp.from  ?? '';
    const toParam    = sp.to    ?? '';
    const reasonParam = sp.reason ?? '';
    const cidParam   = sp.cid   ?? '';
    const dateParam  = sp.date  ?? '';

    // Calendar month
    const now = new Date();
    const defaultMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' })
      .format(now);
    const monthParam = sp.month ?? defaultMonth;
    const [monthYear, monthMo] = monthParam.split('-').map(Number);

    // Build base query
    let query = supabase
      .from('stock_movements')
      .select('id, product_id, delta, reason, company_id, order_id, note, created_at, batch_id, companies(name), orders(order_seq, order_number), inbound_batches(inbound_date, memo)')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (pidParam) query = query.eq('product_id', Number(pidParam));
    if (reasonParam) query = query.eq('reason', reasonParam);
    if (cidParam) query = query.eq('company_id', Number(cidParam));
    if (dateParam) {
      query = query.gte('created_at', kstDateToUtcStart(dateParam))
                   .lte('created_at', kstDateToUtcEnd(dateParam));
    } else {
      if (fromParam) query = query.gte('created_at', kstDateToUtcStart(fromParam));
      if (toParam)   query = query.lte('created_at', kstDateToUtcEnd(toParam));
    }

    const [movResult, companyResult, calMonthResult] = await Promise.all([
      query,
      supabase.from('companies').select('id, name').order('name'),
      // Fetch movements for the calendar month to mark days
      supabase
        .from('stock_movements')
        .select('created_at')
        .gte('created_at', kstDateToUtcStart(`${monthYear}-${String(monthMo).padStart(2, '0')}-01`))
        .lte('created_at', kstDateToUtcEnd(`${monthYear}-${String(monthMo).padStart(2, '0')}-${new Date(monthYear, monthMo, 0).getDate()}`))
        .limit(5000),
    ]);

    const movements = (movResult.data ?? []) as unknown as Array<{
      id: number; product_id: number; delta: number; reason: string;
      company_id: number | null; order_id: number | null; note: string | null;
      created_at: string; batch_id: number | null;
      companies: { name: string } | null;
      orders: { order_seq: number | null; order_number: string } | null;
      inbound_batches: { inbound_date: string; memo: string | null } | null;
    }>;
    const companies = (companyResult.data ?? []) as Array<{ id: number; name: string }>;

    // Build set of KST dates that have movements (for calendar)
    const markedDates = new Set<string>(
      (calMonthResult.data ?? []).map(r => toKstDate(r.created_at as string))
    );

    // Export params
    const exportParams = new URLSearchParams({ type: 'history' });
    if (pidParam)    exportParams.set('pid', pidParam);
    if (fromParam)   exportParams.set('from', fromParam);
    if (toParam)     exportParams.set('to', toParam);
    if (reasonParam) exportParams.set('reason', reasonParam);
    if (cidParam)    exportParams.set('cid', cidParam);
    if (dateParam)   exportParams.set('date', dateParam);

    // Preserve filter params for calendar navigation
    const calBaseParams = new URLSearchParams();
    if (pidParam)    calBaseParams.set('pid', pidParam);
    if (reasonParam) calBaseParams.set('reason', reasonParam);
    if (cidParam)    calBaseParams.set('cid', cidParam);

    const exportBaseUrl = `/api/admin/stock/export?${exportParams}`;
    const historyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-light text-charcoal">Stock</h1>
        </div>
        {tabBar}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Calendar */}
          <MiniCalendar
            year={monthYear}
            month={monthMo}
            markedDates={markedDates}
            baseParams={calBaseParams.toString()}
          />

          {/* Filters + Table */}
          <div className="flex-1 min-w-0">
            {/* Filter form */}
            <form method="GET" action="/manzura/stock" className="flex flex-wrap gap-2 mb-4 items-end">
              <input type="hidden" name="tab" value="history" />
              <input type="hidden" name="month" value={monthParam} />

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">Product</label>
                <select name="pid" defaultValue={pidParam}
                  className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold">
                  <option value="">All products</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.id}>#{p.id} {(p.name as string).slice(0, 24)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">Reason</label>
                <select name="reason" defaultValue={reasonParam}
                  className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold">
                  <option value="">All</option>
                  <option value="inbound">Inbound</option>
                  <option value="order">Order</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="cancel_restock">Cancel +stock</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">Supplier</label>
                <select name="cid" defaultValue={cidParam}
                  className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold">
                  <option value="">All</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">From (KST)</label>
                <input type="date" name="from" defaultValue={fromParam}
                  className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold" />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">To (KST)</label>
                <input type="date" name="to" defaultValue={toParam}
                  className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold" />
              </div>

              <div className="flex gap-2">
                <button type="submit"
                  className="bg-charcoal text-cream text-[10px] uppercase tracking-widest px-3 py-1.5 rounded hover:bg-charcoal/90 transition-colors">
                  Apply
                </button>
                <Link href="/manzura/stock?tab=history"
                  className="border border-bone text-[10px] uppercase tracking-widest px-3 py-1.5 rounded text-mist hover:text-charcoal transition-colors">
                  Clear
                </Link>
              </div>
            </form>

            {dateParam && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gold-dark font-semibold">Showing: {dateParam}</span>
                <Link href="/manzura/stock?tab=history" className="text-[10px] text-mist hover:text-charcoal underline">
                  clear
                </Link>
              </div>
            )}

            {movements.length === 0 ? (
              <p className="text-sm text-mist border border-dashed border-bone p-8 text-center rounded">
                No movements match these filters.
              </p>
            ) : (
              <HistorySection
                movements={movements.map<HistoryMovement>(m => {
                  const seq = m.orders?.order_seq;
                  return {
                    id: m.id,
                    product_id: m.product_id,
                    product_name: productById.get(m.product_id) ?? `#${m.product_id}`,
                    delta: m.delta,
                    reason: m.reason,
                    company_name: m.companies?.name ?? null,
                    order_ref: m.orders ? (seq != null ? formatOrderNumber(seq) : m.orders.order_number) : null,
                    order_id: m.order_id,
                    note: m.note,
                    created_at_kst: toKstDateTime(m.created_at),
                    batch_id: m.batch_id,
                    batch_date: m.inbound_batches?.inbound_date ?? null,
                    batch_memo: m.inbound_batches?.memo ?? null,
                  };
                })}
                exportBaseUrl={exportBaseUrl}
                date={historyDate}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── ORDERS TAB ────────────────────────────────────────────────
  if (tab === 'orders') {
    const fromParam   = sp.from   ?? '';
    const toParam     = sp.to     ?? '';
    const statusParam = sp.reason ?? ''; // reuse 'reason' param slot for status

    let ordersQuery = supabase
      .from('orders')
      .select('id, order_seq, order_number, status, customer_name, customer_email, customer_phone, total_cents, currency, created_at, shipping_address, user_id')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (statusParam) ordersQuery = ordersQuery.eq('status', statusParam);
    if (fromParam)   ordersQuery = ordersQuery.gte('created_at', kstDateToUtcStart(fromParam));
    if (toParam)     ordersQuery = ordersQuery.lte('created_at', kstDateToUtcEnd(toParam));

    const { data: ordersRaw } = await ordersQuery;
    const orders = (ordersRaw ?? []) as Array<{
      id: number; order_seq: number | null; order_number: string;
      status: string; customer_name: string; customer_email: string;
      customer_phone: string; total_cents: number; currency: string;
      created_at: string; shipping_address: Record<string, string>; user_id: string;
    }>;

    // Fetch items for these orders
    const orderIds = orders.map(o => o.id);
    let itemsByOrder = new Map<number, string>();
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_name, quantity')
        .in('order_id', orderIds);
      for (const it of items ?? []) {
        const prev = itemsByOrder.get(it.order_id as number) ?? '';
        itemsByOrder.set(
          it.order_id as number,
          prev ? `${prev}, ${it.product_name} ×${it.quantity}` : `${it.product_name} ×${it.quantity}`,
        );
      }
    }

    // Fetch customer codes
    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
    const customerCodeMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('user_id, customer_code')
        .in('user_id', userIds);
      for (const p of profiles ?? []) {
        if (p.customer_code) customerCodeMap.set(p.user_id as string, p.customer_code as string);
      }
    }

    const exportParams = new URLSearchParams({ type: 'orders' });
    if (fromParam)   exportParams.set('from', fromParam);
    if (toParam)     exportParams.set('to', toParam);
    if (statusParam) exportParams.set('reason', statusParam);

    const ordersKstDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    const ordersPreviewRows = orders.map(o => {
      const display = o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
      return {
        order_ref: display,
        date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(o.created_at)),
        name: o.customer_name,
        code: customerCodeMap.get(o.user_id) ?? '',
        items: itemsByOrder.get(o.id) ?? '',
        total: o.total_cents / 100,
        status: STATUS_LABEL[o.status] ?? o.status,
      };
    });

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-light text-charcoal">Stock</h1>
          <OrdersExportButton
            rows={ordersPreviewRows}
            downloadUrl={`/api/admin/stock/export?${exportParams}`}
            date={ordersKstDate}
          />
        </div>
        {tabBar}

        {/* Filter */}
        <form method="GET" action="/manzura/stock" className="flex flex-wrap gap-2 mb-4 items-end">
          <input type="hidden" name="tab" value="orders" />
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">Status</label>
            <select name="reason" defaultValue={statusParam}
              className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">From (KST)</label>
            <input type="date" name="from" defaultValue={fromParam}
              className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">To (KST)</label>
            <input type="date" name="to" defaultValue={toParam}
              className="border border-bone rounded px-2 py-1.5 text-xs text-charcoal bg-white focus:outline-none focus:border-gold" />
          </div>
          <div className="flex gap-2">
            <button type="submit"
              className="bg-charcoal text-cream text-[10px] uppercase tracking-widest px-3 py-1.5 rounded hover:bg-charcoal/90 transition-colors">
              Apply
            </button>
            <Link href="/manzura/stock?tab=orders"
              className="border border-bone text-[10px] uppercase tracking-widest px-3 py-1.5 rounded text-mist hover:text-charcoal transition-colors">
              Clear
            </Link>
          </div>
        </form>

        {orders.length === 0 ? (
          <p className="text-sm text-mist border border-dashed border-bone p-8 text-center rounded">
            No orders match these filters.
          </p>
        ) : (
          <div className="bg-white border border-bone rounded overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-cream border-b border-bone">
                <tr className="text-[10px] uppercase tracking-widest text-mist">
                  <th className="text-left px-3 py-3 font-semibold">Order</th>
                  <th className="text-left px-3 py-3 font-semibold">Date (KST)</th>
                  <th className="text-left px-3 py-3 font-semibold">Customer</th>
                  <th className="text-left px-3 py-3 font-semibold">Cust. ID</th>
                  <th className="text-left px-3 py-3 font-semibold">Items</th>
                  <th className="text-left px-3 py-3 font-semibold">Phone</th>
                  <th className="text-right px-3 py-3 font-semibold">Total</th>
                  <th className="text-left px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const display = o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
                  const isCancelled = o.status === 'cancelled';
                  const total = (o.total_cents / 100).toLocaleString('en-US', { style: 'currency', currency: o.currency });
                  const addr = o.shipping_address as Record<string, string> | null;
                  const addrStr = addr ? [addr.city, addr.country].filter(Boolean).join(', ') : '';
                  return (
                    <ClickableRow key={o.id} href={`/manzura/orders/${o.id}`} className={`border-t border-bone hover:bg-cream/50 ${isCancelled ? 'opacity-50' : ''}`}>
                      <td className={`px-3 py-2.5 font-mono text-xs text-charcoal ${isCancelled ? 'line-through' : ''}`}>
                        {display}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-mist whitespace-nowrap">{toKstDate(o.created_at)}</td>
                      <td className="px-3 py-2.5 text-xs text-charcoal">
                        <div>{o.customer_name}</div>
                        <div className="text-mist">{addrStr}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-charcoal">
                        {customerCodeMap.get(o.user_id) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-charcoal max-w-[200px] truncate">
                        {itemsByOrder.get(o.id) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-mist">{o.customer_phone || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-charcoal">{total}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isCancelled ? 'bg-stone-100 text-stone-500 line-through' : 'bg-cream text-gold-dark'
                        }`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── ADD TAB ───────────────────────────────────────────────────
  const { data: companyRows } = await supabase.from('companies').select('id, name').order('name');
  const companies = (companyRows ?? []) as Array<{ id: number; name: string }>;
  const products = allProducts.map(p => ({ id: p.id, name: p.name as string }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-light text-charcoal mb-6">Stock</h1>
      {tabBar}
      <InboundForm products={products} companies={companies} />
    </div>
  );
}
