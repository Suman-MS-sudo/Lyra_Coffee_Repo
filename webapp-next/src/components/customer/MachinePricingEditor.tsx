'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Coffee, Leaf, Milk, Loader2, Pencil, Save, X, Gift } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  machineId:        string;
  isFree:           boolean;
  priceCoffeePaise: number | null;
  priceTeaPaise:    number | null;
  priceMilkPaise:   number | null;
  defaultCoffee:    number;
  defaultTea:       number;
  defaultMilk:      number;
}

function paiseToRupees(p: number | null, fallback: number): string {
  return ((p ?? fallback) / 100).toFixed(0);
}

export default function MachinePricingEditor({
  machineId,
  isFree,
  priceCoffeePaise,
  priceTeaPaise,
  priceMilkPaise,
  defaultCoffee,
  defaultTea,
  defaultMilk,
}: Props) {
  const router              = useRouter();
  const [open, setOpen]     = useState(false);
  const [free, setFree]     = useState(isFree);
  const [coffee, setCoffee] = useState<string>(paiseToRupees(priceCoffeePaise, defaultCoffee));
  const [tea, setTea]       = useState<string>(paiseToRupees(priceTeaPaise,    defaultTea));
  const [milk, setMilk]     = useState<string>(paiseToRupees(priceMilkPaise,   defaultMilk));
  const [pending, startTx]  = useTransition();
  const [saving, setSaving] = useState(false);

  const [savedFree,   setSavedFree]   = useState(isFree);
  const [savedCoffee, setSavedCoffee] = useState(priceCoffeePaise);
  const [savedTea,    setSavedTea]    = useState(priceTeaPaise);
  const [savedMilk,   setSavedMilk]   = useState(priceMilkPaise);

  function reset() {
    setFree(savedFree);
    setCoffee(paiseToRupees(savedCoffee, defaultCoffee));
    setTea(paiseToRupees(savedTea,       defaultTea));
    setMilk(paiseToRupees(savedMilk,     defaultMilk));
  }

  async function save() {
    const coffeePaise = Math.round(parseFloat(coffee) * 100);
    const teaPaise    = Math.round(parseFloat(tea)    * 100);
    const milkPaise   = Math.round(parseFloat(milk)   * 100);
    if (Number.isNaN(coffeePaise) || coffeePaise < 0 || coffeePaise > 100_000) {
      toast.error('Coffee price must be between ₹0 and ₹1000'); return;
    }
    if (Number.isNaN(teaPaise) || teaPaise < 0 || teaPaise > 100_000) {
      toast.error('Tea price must be between ₹0 and ₹1000'); return;
    }
    if (Number.isNaN(milkPaise) || milkPaise < 0 || milkPaise > 100_000) {
      toast.error('Milk price must be between ₹0 and ₹1000'); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/customer/machines/${machineId}/pricing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_free:            free,
          price_coffee_paise: coffeePaise,
          price_tea_paise:    teaPaise,
          price_milk_paise:   milkPaise,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(error ?? 'Save failed');
      }
      const data = await res.json();
      setSavedFree(data.is_free);
      setSavedCoffee(data.price_coffee_paise);
      setSavedTea(data.price_tea_paise);
      setSavedMilk(data.price_milk_paise);
      startTx(() => { setOpen(false); router.refresh(); });
      toast.success(free ? 'Machine set to free' : 'Pricing updated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {savedFree ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
            bg-green-500/15 border border-green-500/20 text-green-400 text-xs font-medium">
            <Gift size={11} /> Free
          </span>
        ) : (
          <span className="text-white/60 text-xs whitespace-nowrap">
            Coffee ₹{paiseToRupees(savedCoffee, defaultCoffee)} · Tea ₹{paiseToRupees(savedTea, defaultTea)} · Milk ₹{paiseToRupees(savedMilk, defaultMilk)}
          </span>
        )}
        <button
          onClick={() => { reset(); setOpen(true); }}
          className="text-white/40 hover:text-coffee-400 transition-colors p-1 -m-1"
          aria-label="Edit pricing"
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3 min-w-[260px]">
      {/* Free toggle */}
      <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
        <span className="flex items-center gap-2 text-sm text-white">
          <Gift size={14} className="text-green-400" />
          Make this machine free
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={free}
          onClick={() => setFree(v => !v)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            free ? 'bg-green-500' : 'bg-white/15'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            free ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </label>

      {/* Price inputs */}
      <fieldset disabled={free} className={free ? 'opacity-40 pointer-events-none' : ''}>
        <div className="space-y-2">
          <PriceInput icon={<Coffee size={13} className="text-coffee-400" />} label="Coffee" value={coffee} onChange={setCoffee} />
          <PriceInput icon={<Leaf   size={13} className="text-green-400"  />} label="Tea"    value={tea}    onChange={setTea}    />
          <PriceInput icon={<Milk   size={13} className="text-blue-300"   />} label="Milk"   value={milk}   onChange={setMilk}   />
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={() => { reset(); setOpen(false); }}
          disabled={saving || pending}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs
            text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={12} /> Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || pending}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-coffee-500 hover:bg-coffee-400 text-white disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
      </div>
    </div>
  );
}

function PriceInput({
  icon, label, value, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5">
      {icon}
      <span className="text-white/60 text-xs w-12">{label}</span>
      <span className="text-white/40 text-xs">₹</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={1000}
        step={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent flex-1 min-w-0 text-white text-sm font-medium
          focus:outline-none [appearance:textfield]
          [&::-webkit-outer-spin-button]:appearance-none
          [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}
