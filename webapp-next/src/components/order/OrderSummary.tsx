'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import type { DrinkCustomization } from '@/lib/types/database';
import { formatPrice, cap } from '@/lib/utils/cn';
import { getMachineDrinkPrice } from '@/lib/utils/security';

import type { DrinkType } from '@/lib/types/database';

interface Props {
  machineId:        string;
  drink:            DrinkType;
  customization:    DrinkCustomization;
  isFree:           boolean;
  priceCoffeePaise: number | null;
  priceTeaPaise:    number | null;
  priceMilkPaise:   number | null;
  onBack:           () => void;
  onPay:            () => void;
  loading:          boolean;
  machineOnline?:   boolean;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-3 border-b border-white/[0.07] last:border-0">
      <span className="text-white/40 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

export default function OrderSummary({ drink, customization, isFree, priceCoffeePaise, priceTeaPaise, priceMilkPaise, onBack, onPay, loading, machineOnline = true }: Props) {
  const price = getMachineDrinkPrice(
    { is_free: isFree, price_coffee_paise: priceCoffeePaise, price_tea_paise: priceTeaPaise, price_milk_paise: priceMilkPaise },
    drink,
  );

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm mb-3 transition-colors"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <h2 className="display text-2xl text-white mb-1">Review your <span className="italic text-coffee-300">order</span></h2>
      <p className="text-white/40 text-sm mb-4">Everything look right?</p>

      {/* Summary card */}
      <div className="glass rounded-3xl p-4 mb-3">
        <Row
          label="Drink"
          value={drink === 'coffee' ? '☕ Filter Coffee' : drink === 'tea' ? '🍵 Tea' : '🥛 Hot Milk'}
        />
        <Row label="Size"     value="Regular · 100ml" />
        <Row label="Strength" value={cap(customization.strength)} />
        <Row label="Milk"     value={customization.milk ? 'With milk' : 'Black (no milk)'} />
        <div className="flex justify-between pt-4 mt-1">
          <span className="font-semibold text-white">Total</span>
          <span className="text-coffee-400 font-bold text-xl">
            {isFree ? 'FREE' : formatPrice(price)}
          </span>
        </div>
      </div>

      {isFree && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3 mb-3">
          <span className="text-xl">🎁</span>
          <p className="text-green-300 text-sm font-medium">Complimentary — no payment needed</p>
        </div>
      )}

      {!machineOnline && (
        <p className="text-center text-red-400/80 text-xs mb-3">
          Machine is offline — please wait for it to reconnect.
        </p>
      )}

      <button
        onClick={onPay}
        disabled={loading || !machineOnline}
        className="w-full py-4 rounded-2xl bg-coffee-500 hover:bg-coffee-400
          disabled:opacity-50 disabled:cursor-not-allowed
          text-white font-semibold text-base transition-all duration-150
          active:scale-[.98] shadow-glow-amber flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {isFree ? 'Placing order…' : 'Opening payment…'}
          </>
        ) : isFree ? (
          'Place order'
        ) : (
          `Pay ${formatPrice(price)}`
        )}
      </button>

      <p className="text-center text-white/20 text-xs mt-3">
        {isFree ? 'Powered by Lyra' : 'Secured by Razorpay · 256-bit encrypted'}
      </p>
    </div>
  );
}
