import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Boxes, Download, Search, ArrowRight, ArrowDownLeft, ArrowUpRight, RotateCcw, Package, CheckCircle2, AlertTriangle, Layers, MapPin, Building2, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { useStore } from '@/lib/store';
import { lines, movements, stock, warehouseFlowRows as getWarehouseFlowRows, type Category, type WarehouseFlowRow, locations } from '@/lib/workflow';
import { PRODUCT_CATALOG, type ModuleDef, type Row, WAREHOUSES, DEFAULT_WAREHOUSE } from '@/lib/modules';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WarehouseReceiptDialog } from './WarehouseReceiptDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const kg = (v: number) => `${v.toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`;
const completedWarehouseStatuses = new Set([
  'Posted',
  'Received',
  'Sent to QC',
  'Delivered',
  'Dispatched',
  'Closed',
]);

function WarehouseFlowPanel({
  tab,
  onTabChange,
  rows,
  inwardRows,
  outwardRows,
  selectedWarehouse,
  onWarehouseChange,
  onNewReceipt,
  onViewReturn,
  searchQuery,
  statusFilter,
  onStatusFilterChange,
}: {
  tab: 'Inward' | 'Outward';
  onTabChange: (tab: 'Inward' | 'Outward') => void;
  rows: WarehouseFlowRow[];
  inwardRows: WarehouseFlowRow[];
  outwardRows: WarehouseFlowRow[];
  selectedWarehouse: string;
  onWarehouseChange: (warehouse: string) => void;
  onNewReceipt: () => void;
  onViewReturn: (returnId: string) => void;
  searchQuery: string;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}) {
  const [dispatchDetails, setDispatchDetails] = useState<WarehouseFlowRow | null>(null);
  const inwardKg = inwardRows
    .filter((row) => ['Posted', 'Received', 'Sent to QC'].includes(row.status))
    .reduce((sum, row) => sum + row.qty, 0);
  const outwardKg = outwardRows.reduce((sum, row) => sum + row.qty, 0);
  const standardStatuses = tab === 'Inward'
    ? ['Arrived', 'Weighed', 'Validated', 'Posted', 'Received', 'Sent to QC']
    : ['Created', 'Trip assigned', 'In transit', 'Delivered', 'Dispatched', 'Closed', 'Requested', 'Return DC created'];
  const statuses = [...standardStatuses, ...new Set(rows.map((row) => row.status).filter((status) => !standardStatuses.includes(status)))];
  const matchingRows = rows.filter((row) =>
    [row.reference, row.sourceReference, row.product, row.party, row.reason || '', row.status, row.warehouse]
      .some((value) => value.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const shownRows = matchingRows.filter((row) => statusFilter === 'All' || row.status === statusFilter);

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="border-b bg-muted/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl',
              tab === 'Inward' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
            )}>
              {tab === 'Inward' ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Warehouse operations</p>
              <h2 className="mt-0.5 text-lg font-bold text-foreground">{tab} records</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tab === 'Inward'
                  ? 'Track posted purchase receipts and buyer returns received into quarantine.'
                  : 'Track sales dispatches plus buyer return pickups, quarantine check-ins, and QC status.'}
              </p>
            </div>
          </div>
          <Button type="button" size="sm" className="h-8" onClick={onNewReceipt}>
              {tab === 'Inward' ? 'New Inward GRN' : 'Buyer Returns & Quarantine'}
              <ArrowRight className="ml-1.5 size-3.5" />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border bg-background p-1" role="group" aria-label="Warehouse direction">
            {([
              { name: 'Inward', icon: ArrowDownLeft, quantity: inwardKg, count: inwardRows.length },
              { name: 'Outward', icon: ArrowUpRight, quantity: outwardKg, count: outwardRows.length },
            ] as const).map(({ name, icon: Icon, quantity, count }) => {
              const isSelected = tab === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onTabChange(name)}
                  className={cn(
                    'flex min-w-36 items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors sm:min-w-44',
                    isSelected
                      ? name === 'Inward'
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                        : 'bg-blue-500/10 text-blue-800 dark:text-blue-200'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{name}</span>
                    <span className="block text-[10px] text-muted-foreground">{count} product lines · {kg(quantity)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by warehouse">
            {['All', ...WAREHOUSES].map((warehouse) => {
              const isSelected = selectedWarehouse === warehouse;
              return (
                <button
                  key={warehouse}
                  type="button"
                  onClick={() => onWarehouseChange(warehouse)}
                  aria-pressed={isSelected}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Building2 className="size-3" />
                  {warehouse === 'All' ? 'All Warehouses' : warehouse}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Filter {tab.toLowerCase()} records by workflow status
        </p>
        <div className="flex max-w-full flex-wrap gap-1 rounded-xl bg-muted/70 p-1" role="group" aria-label={`${tab} status filter`}>
          {['All', ...statuses].map((status) => {
            const count = status === 'All' ? rows.length : rows.filter((row) => row.status === status).length;
            const selected = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={selected}
                onClick={() => onStatusFilterChange(status)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                  selected ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
                )}
              >
                {status}
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 font-mono text-[9px]',
                  selected ? 'bg-primary/10 text-primary' : 'bg-background/70 text-muted-foreground'
                )}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          {tab === 'Inward'
            ? <ArrowDownLeft className="size-4 text-emerald-600" />
            : <ArrowUpRight className="size-4 text-blue-600" />}
          {tab} Warehouse Records
        </p>
        <span className="text-[11px] text-muted-foreground">
          {selectedWarehouse === 'All' ? 'All warehouse locations' : selectedWarehouse} · Showing {shownRows.length} of {matchingRows.length} matching product lines
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-muted/60 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">{tab === 'Inward' ? 'GRN / Return DC' : 'Sales DC / Return DC'}</th>
              <th className="px-4 py-2.5">Source Reference</th>
              <th className="px-4 py-2.5">{tab === 'Inward' ? 'Supplier / Buyer' : 'Buyer'}</th>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5 text-right">Quantity</th>
              <th className="px-4 py-2.5">Warehouse</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shownRows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{row.date || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-primary">
                  {row.reference}
                  {row.flowType === 'Buyer return pickup' && (
                    <span className="mt-1 block font-sans text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Return pickup</span>
                  )}
                  {row.flowType === 'Buyer return quarantine' && (
                    <span className="mt-1 block font-sans text-[9px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Quarantine / QC</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{row.sourceReference}</td>
                <td className="px-4 py-3 text-xs font-medium">{row.party}</td>
                <td className="px-4 py-3 text-xs font-semibold">
                  {row.product}
                  {row.reason && <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">Return reason: {row.reason}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-bold">{kg(row.qty)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{row.warehouse}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    completedWarehouseStatuses.has(row.status)
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  )}>{row.status}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {row.flowType === 'Buyer return pickup' || row.flowType === 'Buyer return quarantine' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => onViewReturn(row.reference)}
                    >
                      <Eye className="mr-1 size-3.5" />
                      View
                    </Button>
                  ) : row.flowType === 'Dispatch' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDispatchDetails(row)}
                    >
                      <Eye className="mr-1 size-3.5" />
                      View
                    </Button>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
            {!shownRows.length && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {rows.length && statusFilter !== 'All' ? `No ${statusFilter} ${tab.toLowerCase()} records found` : `No ${tab.toLowerCase()} records found`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rows.length && statusFilter !== 'All'
                      ? 'Choose another status or select All to view the other records.'
                      : tab === 'Inward'
                      ? 'Post a warehouse receipt or receive a buyer return into quarantine to see it here.'
                      : 'Dispatch a confirmed sale or create a buyer return DC to see its pickup and quarantine progress here.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog open={dispatchDetails !== null} onOpenChange={(open) => {
        if (!open) setDispatchDetails(null);
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Outward dispatch details</DialogTitle>
            <DialogDescription>
              Sales DC {dispatchDetails?.reference || "—"} · Sales order {dispatchDetails?.sourceReference || "—"}
            </DialogDescription>
          </DialogHeader>
          {dispatchDetails && (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Buyer</dt><dd className="font-semibold">{dispatchDetails.party}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Delivery location</dt><dd className="font-semibold">{dispatchDetails.deliveryLocation || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">From warehouse</dt><dd className="font-semibold">{dispatchDetails.warehouse}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Dispatch status</dt><dd className="font-semibold">{dispatchDetails.status}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Transporter</dt><dd className="font-semibold">{dispatchDetails.transporter || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Vehicle / driver</dt><dd className="font-semibold">{[dispatchDetails.vehicle, dispatchDetails.driver].filter(Boolean).join(" · ") || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Dispatch date</dt><dd className="font-semibold">{dispatchDetails.date || "—"}</dd></div>
              </dl>
              <div className="overflow-hidden rounded-xl border">
                <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold">Products on this Sales DC</div>
                <div className="divide-y">
                  {(dispatchDetails.products || [{ p: dispatchDetails.product, q: dispatchDetails.qty }]).map((product, index) => (
                    <div key={`${product.p}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span className="font-medium">{product.p}</span>
                      <span className="font-mono font-semibold">{kg(product.q)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function StockPage({ mod }: { mod: ModuleDef }) {
  const { data, reset, nextId, upsert } = useStore();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [hideZero, setHideZero] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('All');
  const [warehouseFlowTab, setWarehouseFlowTab] = useState<'Inward' | 'Outward'>('Inward');
  const [warehouseStatusFilter, setWarehouseStatusFilter] = useState('All');
  const [receiptDialogRow, setReceiptDialogRow] = useState<Row | null>(null);
  const [returnDialogRow, setReturnDialogRow] = useState<Row | null>(null);

  const balances = stock(data, selectedWarehouse);
  const allMoves = movements(data);
  const ledger = selectedWarehouse === 'All' ? allMoves : allMoves.filter((m) => m.warehouse === selectedWarehouse);
  const isInventory = mod.slug === 'inventory';
  const isLedger = mod.slug === 'stock-movements';
  const inwardRows = getWarehouseFlowRows(data, 'Inward', selectedWarehouse);
  const outwardRows = getWarehouseFlowRows(data, 'Outward', selectedWarehouse);
  // Total KG by warehouse facility for instant overview
  const warehouseStockSummary = WAREHOUSES.map((wh) => {
    const whBalances = stock(data, wh);
    const totalKg = whBalances.reduce((sum, b) => sum + (b.qty > 0 ? b.qty : 0), 0);
    return { name: wh, totalKg };
  });

  const products = [
    ...new Set([
      ...balances.map((s) => s.product),
      ...(data['trips'] || []).flatMap((r) => lines(r, 'net').map((l) => l.p)),
    ]),
  ];

  const qty = (slug: string, p: string, status?: string[]) =>
    (data[slug] || [])
      .filter((r) => (!status || status.includes(r.status)) && (selectedWarehouse === 'All' || (r['warehouse'] || DEFAULT_WAREHOUSE) === selectedWarehouse))
      .reduce((s, r) => s + (lines(r, slug === 'trips' ? 'net' : 'qty').find((l) => l.p === p)?.q || 0), 0);

  const report = products.map((p) => ({
    product: p,
    purchased: qty('trips', p, ['Submitted']),
    received: qty('receipts', p, ['Posted']),
    gradeA: (data['quality-check'] || [])
      .filter((r) => r.status !== 'Assigned' && (selectedWarehouse === 'All' || (r['warehouse'] || DEFAULT_WAREHOUSE) === selectedWarehouse))
      .reduce(
        (s, r) =>
          s +
          (lines(r).find((l) => l.p === p)?.a || 0) +
          (r.status === 'Stage 2 done' ? lines(r).find((l) => l.p === p)?.a2 || 0 : 0),
        0
      ),
    gradeB: (data['quality-check'] || [])
      .filter((r) => r.status === 'Stage 2 done' && (selectedWarehouse === 'All' || (r['warehouse'] || DEFAULT_WAREHOUSE) === selectedWarehouse))
      .reduce((s, r) => s + (lines(r).find((l) => l.p === p)?.b || 0), 0),
    sold: qty('sales-orders', p, ['Dispatched', 'Closed']),
    returned: qty('returns', p, ['Received', 'Sent to QC']),
    stock: balances.filter((s) => s.product === p).reduce((a, s) => a + s.qty, 0),
  }));

  const shownBalances = balances
    .filter(
      (s) =>
        (category === 'All' || category === s.category) &&
        s.product.toLowerCase().includes(q.toLowerCase()) &&
        (!hideZero || Math.abs(s.qty) > 0.001)
    )
    .sort((a, b) => b.qty - a.qty);

  const shownLedger = ledger.filter(
    (m) =>
      (category === 'All' || m.source === category || m.destination === category) &&
      Object.values(m).some((v) => String(v).toLowerCase().includes(q.toLowerCase()))
  );

  const shownReport = report.filter((r) => r.product.toLowerCase().includes(q.toLowerCase()));

  const exportCsv = () => {
    const rows = isInventory ? shownBalances : isLedger ? shownLedger : shownReport;
    if (!rows.length) return;
    const keys = Object.keys(rows[0] || {});
    const csv = [
      keys.join(','),
      ...rows.map((r) =>
        keys
          .map(
            (k) =>
              `"${String((r as unknown as Record<string, unknown>)[k] ?? '').replaceAll('"', '""')}"`
          )
          .join(',')
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${mod.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const headers = isInventory
    ? ['PRODUCT NAME', 'WAREHOUSE FACILITY', 'STOCK CATEGORY', 'STORAGE LOCATION BAY', 'AVAILABLE BALANCE', 'STOCK STATUS']
    : isLedger
    ? ['REFERENCE', 'WAREHOUSE', 'SOURCE REFERENCE', 'PRODUCT', 'SOURCE', 'DESTINATION', 'QUANTITY', 'DATE', 'RESPONSIBLE']
    : ['PRODUCT', 'PURCHASED', 'RECEIVED', 'GRADE A OUTPUT', 'GRADE B OUTPUT', 'SOLD', 'RETURNED', 'STOCK REMAINING'];

  const kpiCategories: Category[] = ['Grade A', 'Grade B', 'Packed', 'Ungraded', 'Remaining', 'Rejected'];

  const totalStockKg = balances.reduce((sum, b) => sum + (b.qty > 0 ? b.qty : 0), 0);
  const gradeAStockKg = balances.filter((b) => b.category === 'Grade A').reduce((sum, b) => sum + b.qty, 0);

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'Grade A':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
      case 'Grade B':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
      case 'Packed':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
      case 'Ungraded':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
      case 'Rejected':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'Remaining':
        return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-primary tracking-wide">
            {mod.stage} · Clear Warehouse Stock Control
          </p>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">{mod.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{mod.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} className="h-9">
            <Download className="mr-1.5 size-4" /> Export
          </Button>
          <Button asChild variant="default" className="h-9">
            <Link to="/m/$module" params={{ module: 'packing' }}>
              <Package className="mr-1.5 size-4" /> Allocation & Packing <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {isInventory && (
        <WarehouseFlowPanel
          tab={warehouseFlowTab}
          onTabChange={(direction) => {
            setWarehouseFlowTab(direction);
            setWarehouseStatusFilter('All');
          }}
          rows={warehouseFlowTab === 'Inward' ? inwardRows : outwardRows}
          inwardRows={inwardRows}
          outwardRows={outwardRows}
          selectedWarehouse={selectedWarehouse}
          onWarehouseChange={setSelectedWarehouse}
          searchQuery={q}
          statusFilter={warehouseStatusFilter}
          onStatusFilterChange={setWarehouseStatusFilter}
          onNewReceipt={() => setReceiptDialogRow({
            id: nextId('receipts'),
            status: 'Arrived',
            date: new Date().toISOString().slice(0, 10),
            item: '[]',
          })}
          onViewReturn={(returnId) => {
            const returnRecord = (data['returns'] || []).find((record) => record.id === returnId);
            if (!returnRecord) {
              toast.error(`Return ${returnId} could not be found.`);
              return;
            }
            setReturnDialogRow(returnRecord);
          }}
        />
      )}
      {returnDialogRow && (
        <WarehouseReceiptDialog
          row={returnDialogRow}
          isNew={false}
          initialFlow="BuyerReturn"
          onClose={() => setReturnDialogRow(null)}
          onSave={(updatedReturn) => {
            upsert('returns', updatedReturn);
            setReturnDialogRow(null);
            toast.success(`${updatedReturn.id} received into warehouse quarantine.`);
          }}
        />
      )}
      {receiptDialogRow && (
        <WarehouseReceiptDialog
          row={receiptDialogRow}
          isNew
          initialFlow={warehouseFlowTab === 'Inward' ? 'Purchase' : 'BuyerReturn'}
          onClose={() => setReceiptDialogRow(null)}
          onSave={(receipt) => {
            upsert('receipts', receipt);
            setReceiptDialogRow(null);
            toast.success(receipt.status === 'Posted'
              ? `${receipt.id} posted to warehouse inventory.`
              : `${receipt.id} saved as an arrival awaiting posting.`);
          }}
        />
      )}

      {/* End-to-end Inventory Process Pipeline Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-background p-4 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <Boxes className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                End-to-End Stock Flow: Graded ➔ Packed ➔ Dispatched
              </h3>
              <p className="text-xs text-muted-foreground">
                Produce is graded in QC (<strong>Grade A / B</strong>), packed into retail packets for buyer demand (<strong>Dispatch Bay · Packed</strong>), and automatically deducted from warehouse on-hand stock when Sales Orders are marked <strong>Dispatched</strong> or <strong>Closed</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <Link to="/m/$module" params={{ module: 'sales-orders' }}>
                View Sales Orders <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Pipeline Steps Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2.5 rounded-lg border bg-card p-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-bold text-emerald-700 dark:text-emerald-400">1</span>
            <div>
              <p className="font-semibold text-foreground">Graded produce (QC)</p>
              <p className="text-[10px] text-muted-foreground">{kg(gradeAStockKg)} Grade A available</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border bg-card p-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-500/15 font-bold text-purple-700 dark:text-purple-400">2</span>
            <div>
              <p className="font-semibold text-foreground">Packed for Buyer (Bay)</p>
              <p className="text-[10px] text-muted-foreground">{kg(balances.filter(s => s.category === 'Packed').reduce((sum, b) => sum + b.qty, 0))} ready to ship</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border bg-card p-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 font-bold text-blue-700 dark:text-blue-400">3</span>
            <div>
              <p className="font-semibold text-foreground">Deducted to Buyer (Sale)</p>
              <p className="text-[10px] text-muted-foreground">{kg(report.reduce((sum, r) => sum + r.sold, 0))} total dispatched</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Warehouse Category Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCategories.map((c) => {
          const totalKg = balances.filter((s) => s.category === c).reduce((s, b) => s + b.qty, 0);
          const isSelected = category === c;
          return (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(category === c ? 'All' : c)}
              className={cn(
                'text-left border-l-3 bg-card p-3 rounded-r-xl border shadow-xs transition-all hover:bg-muted/30 cursor-pointer',
                isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : 'border-border',
                c === 'Grade A' && 'border-l-emerald-500',
                c === 'Grade B' && 'border-l-blue-500',
                c === 'Packed' && 'border-l-purple-500',
                c === 'Ungraded' && 'border-l-amber-500',
                c === 'Remaining' && 'border-l-cyan-500',
                c === 'Rejected' && 'border-l-rose-500'
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold text-foreground truncate">{c}</p>
                {isSelected && <span className="size-1.5 rounded-full bg-primary" />}
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{locations[c]}</p>
              <p className="mt-1 font-mono text-lg font-bold text-foreground tabular-nums">
                {kg(totalKg)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filter and Action Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            aria-label="Search stock"
            placeholder="Search product name, category, or bay…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* 1-Click Quick Category Tabs */}
        {(isInventory || isLedger) && (
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-xs">
            {['All', ...kpiCategories].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  category === c ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {isInventory && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none bg-card px-3 py-2 rounded-lg border">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary/20 size-3.5"
            />
            <span>Hide 0 kg balances</span>
          </label>
        )}
      </div>

      {/* Clear Warehouse Inventory Table */}
      <div className="overflow-x-auto border rounded-2xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              {headers.map((h, i) => (
                <th key={h} className={cn('px-4 py-3 text-left', (i === 4 || i === 5) && 'text-right')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isInventory
              ? shownBalances.map((s) => {
                  const spec =
                    PRODUCT_CATALOG.find((p) => p.name.toLowerCase() === s.product.toLowerCase()) ||
                    PRODUCT_CATALOG.find((p) => p.name.toLowerCase().includes(s.product.toLowerCase()));
                  const isLow = s.qty > 0 && s.qty < 50;
                  const isOut = s.qty <= 0;

                  return (
                    <tr key={`${s.product}-${s.category}`} className="hover:bg-muted/20 transition-colors">
                      {/* Product Name & Category */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'size-2.5 rounded-full',
                              isOut ? 'bg-muted-foreground' : isLow ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                            )}
                          />
                          <div>
                            <p className="font-bold text-foreground text-sm">{s.product}</p>
                            {spec && (
                              <p className="text-[11px] text-muted-foreground">
                                {spec.category || 'General'} · Pack: {spec.defaultPackSize}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Warehouse Facility */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <Building2 className="size-3 text-amber-600 dark:text-amber-400" />
                          {selectedWarehouse === 'All' ? 'All Warehouses' : selectedWarehouse}
                        </span>
                      </td>

                      {/* Stock Category Badge */}
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            getCategoryBadgeClass(s.category)
                          )}
                        >
                          {s.category}
                        </span>
                      </td>

                      {/* Storage Location Bay */}
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-foreground">
                          <MapPin className="size-3 text-muted-foreground" /> {s.location}
                        </span>
                      </td>

                      {/* Balance KG */}
                      <td className="px-4 py-3.5 text-right font-mono text-base font-bold text-foreground tabular-nums">
                        {kg(s.qty)}
                      </td>

                      {/* Stock Status */}
                      <td className="px-4 py-3.5 text-right">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            Out of stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-semibold">
                            <AlertTriangle className="size-3" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">
                            <CheckCircle2 className="size-3" /> Available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              : isLedger
              ? shownLedger.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{m.ref}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <Building2 className="size-3 text-amber-600 dark:text-amber-400" />
                        {m.warehouse || DEFAULT_WAREHOUSE}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.purchase || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{m.product}</td>
                    <td className="px-4 py-3">{m.source}</td>
                    <td className="px-4 py-3">{m.destination}</td>
                    <td className="px-4 py-3 tabular-nums font-mono font-bold text-foreground">{kg(m.qty)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.person}</td>
                  </tr>
                ))
              : shownReport.map((r) => (
                  <tr key={r.product} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{r.product}</td>
                    {[r.purchased, r.received, r.gradeA, r.gradeB, r.sold, r.returned, r.stock].map((v, i) => (
                      <td key={i} className="px-4 py-3 tabular-nums font-mono font-medium">
                        {kg(v)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Empty State */}
        {!(isInventory ? shownBalances : isLedger ? shownLedger : shownReport).length && (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-muted-foreground">No matching inventory records found.</p>
            {balances.length === 0 && (
              <div className="flex justify-center pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    reset();
                    toast.success('Trading house demo inventory re-seeded!');
                  }}
                  className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <RotateCcw className="mr-1.5 size-3.5" /> Re-seed Demo Stock
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {isLedger && (
        <section className="border-t pt-5">
          <h2 className="font-semibold text-foreground">Transaction Audit Log</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Reference</th>
                  <th className="py-2.5 px-4 font-semibold">Action</th>
                  <th className="py-2.5 px-4 font-semibold">Previous → Current</th>
                  <th className="py-2.5 px-4 font-semibold">Date / Person</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data['transaction-audit'] || []).map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="py-2 px-4 font-mono text-xs text-primary">{r['ref']}</td>
                    <td className="py-2 px-4">{r['action']}</td>
                    <td className="py-2 px-4 font-mono text-xs text-muted-foreground">
                      {r['beforeStatus']} → {r['afterStatus']}
                    </td>
                    <td className="py-2 px-4 text-xs text-muted-foreground">
                      {r['date']} · {r['person']}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(data['transaction-audit'] || []).length && (
              <p className="py-4 text-center text-sm text-muted-foreground">No changes since demo reset</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
