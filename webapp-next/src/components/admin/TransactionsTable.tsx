'use client';

import { IndianRupee, Clock, Smartphone } from 'lucide-react';
import type { OrderStatus, CoffeeOrder, CoffeeMachine, CoffeePayment } from '@/lib/types/database';

// ── Types matching the joined query in transactions/page.tsx ──────
interface OrderRow {
  id: string;
  created_at: string;
  drink_type: 'coffee' | 'tea';
  customization: { sugar: string; strength: string; milk?: boolean };
  amount_paise: number;
  status: OrderStatus;
  coffee_machines: Pick<CoffeeMachine, 'name' | 'location'> | null;
  coffee_payments: Pick<CoffeePayment, 'razorpay_payment_id' | 'method' | 'status'>[] | null;
}

interface Props {
  orders: OrderRow[];
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
  paid:       'bg-blue-500/15 text-blue-400 border-blue-500/20',
  dispensing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  dispensed:  'bg-green-500/15 text-green-400 border-green-500/20',
  failed:     'bg-red-500/15 text-red-400 border-red-500/20',
  refunded:   'bg-white/10 text-white/40 border-white/10',
};

const DRINK_EMOJI = { coffee: '☕', tea: '🍵' } as const;

function formatMethod(method: string | null | undefined): string {
  if (!method) return '—';
  if (method === 'upi') return 'UPI';
  if (method === 'card') return 'Card';
  if (method === 'netbanking') return 'Net Banking';
  if (method === 'wallet') return 'Wallet';
  return method;
}

export default function TransactionsTable({ orders }: Props) {
  if (orders.length === 0) {
    return (
      <div className="glass rounded-2xl py-16 text-center text-white/30 text-sm">
        No transactions yet.
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3.5 font-medium">Time</th>
              <th className="text-left px-5 py-3.5 font-medium">Machine</th>
              <th className="text-left px-5 py-3.5 font-medium">Drink</th>
              <th className="text-left px-5 py-3.5 font-medium">Amount</th>
              <th className="text-left px-5 py-3.5 font-medium">Payment</th>
              <th className="text-left px-5 py-3.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const payment = Array.isArray(order.coffee_payments) ? order.coffee_payments[0] : null;
              const amountRs = (order.amount_paise / 100).toFixed(0);
              return (
                <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/[.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-white/50 text-xs">
                      <Clock size={11} className="shrink-0" />
                      <span>{new Date(order.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        hour12: true,
                      })}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white font-medium">{order.coffee_machines?.name ?? '—'}</p>
                    {order.coffee_machines?.location && (
                      <p className="text-white/40 text-xs">{order.coffee_machines.location}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{DRINK_EMOJI[order.drink_type]}</span>
                      <div>
                        <p className="text-white capitalize font-medium">{order.drink_type}</p>
                        <p className="text-white/40 text-xs capitalize">
                          {order.customization.strength} · {order.customization.milk === false ? 'no milk' : 'with milk'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-white font-semibold">
                      <IndianRupee size={13} className="text-coffee-400" />
                      {amountRs}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-white/50 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Smartphone size={11} className="shrink-0" />
                      {formatMethod(payment?.method)}
                    </div>
                    {payment?.razorpay_payment_id && (
                      <p className="font-mono text-white/25 text-[10px] mt-0.5">
                        {payment.razorpay_payment_id.slice(-10)}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[order.status]}`}>
                      {order.status}
                    </span>
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
