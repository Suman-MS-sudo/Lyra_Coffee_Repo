'use client';

import Link from 'next/link';

interface Order {
  id: string;
  drink_type: string;
  customization: { sugar: string; strength: string; size: string };
  amount_paise: number;
  status: string;
  created_at: string;
  coffee_machines: { name: string; location: string | null } | null;
  coffee_payments: Array<{ razorpay_payment_id: string | null; status: string; method: string | null; vpa: string | null }> | null;
}

interface Props {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-500/20 text-yellow-400',
  paid:       'bg-blue-500/20 text-blue-400',
  dispensing: 'bg-purple-500/20 text-purple-400',
  dispensed:  'bg-[#6dbf67]/20 text-[#6dbf67]',
  failed:     'bg-red-500/20 text-red-400',
  refunded:   'bg-[#7a7062]/20 text-[#7a7062]',
};

export function OrdersTable({ orders, total, page, limit }: Props) {
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2e2e2e] text-[#7a7062] text-xs uppercase tracking-widest">
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Machine</th>
                <th className="text-left px-4 py-3">Drink</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Payment</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-[#7a7062]">No orders yet</td></tr>
              )}
              {orders.map(o => {
                const payment = Array.isArray(o.coffee_payments) ? o.coffee_payments[0] : null;
                return (
                  <tr key={o.id} className="border-b border-[#2e2e2e] last:border-0 hover:bg-[#111] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#7a7062]">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {o.coffee_machines?.name ?? '—'}
                      {o.coffee_machines?.location && (
                        <span className="block text-[#7a7062]">{o.coffee_machines.location}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize">{o.drink_type}</span>
                      <span className="block text-xs text-[#7a7062]">
                        {o.customization?.size} · {o.customization?.strength}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      ₹{((o.amount_paise ?? 0) / 100).toFixed(0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? ''}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7a7062]">
                      {payment?.vpa ?? payment?.method ?? '—'}
                      {payment?.razorpay_payment_id && (
                        <span className="block font-mono text-[10px]">{payment.razorpay_payment_id.slice(-8)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`?page=${page - 1}`} className="px-3 py-1.5 rounded-lg border border-[#2e2e2e] text-sm hover:border-[#c8861a] transition-colors">
              ← Prev
            </Link>
          )}
          <span className="text-xs text-[#7a7062]">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`?page=${page + 1}`} className="px-3 py-1.5 rounded-lg border border-[#2e2e2e] text-sm hover:border-[#c8861a] transition-colors">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
