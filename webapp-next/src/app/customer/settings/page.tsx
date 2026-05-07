'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Webhook, ExternalLink, Trash2, Save, Loader2, CheckCircle2, Copy } from 'lucide-react';

export default function CustomerSettingsPage() {
  // API keys state
  const [keyId, setKeyId]     = useState('');
  const [secret, setSecret]   = useState('');
  const [savedKeyId, setSavedKeyId] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [clearing, setClearing] = useState(false);

  // Webhook secret state
  const [webhookSecret, setWebhookSecret]       = useState('');
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [savingWh, setSavingWh]                 = useState(false);
  const [clearingWh, setClearingWh]             = useState(false);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch('/api/customer/settings')
      .then(r => r.json())
      .then(d => {
        setSavedKeyId(d.razorpay_key_id ?? null);
        setHasWebhookSecret(!!d.has_webhook_secret);
        setWebhookUrl(d.webhook_url ?? '');
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveKeys(e: React.FormEvent) {
    e.preventDefault();
    if (!keyId.trim() || !secret.trim()) {
      toast.error('Both Key ID and Key Secret are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customer/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpay_key_id: keyId.trim(), razorpay_key_secret: secret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return; }
      setSavedKeyId(keyId.trim());
      setKeyId('');
      setSecret('');
      toast.success('Razorpay keys saved');
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearKeys() {
    setClearing(true);
    try {
      const res = await fetch('/api/customer/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpay_key_id: null, razorpay_key_secret: null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to clear'); return; }
      setSavedKeyId(null);
      toast.success('Razorpay keys cleared — platform defaults will be used');
    } catch {
      toast.error('Network error');
    } finally {
      setClearing(false);
    }
  }

  async function handleSaveWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!webhookSecret.trim()) { toast.error('Webhook secret cannot be empty'); return; }
    setSavingWh(true);
    try {
      const res = await fetch('/api/customer/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpay_webhook_secret: webhookSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return; }
      setHasWebhookSecret(true);
      setWebhookSecret('');
      toast.success('Webhook secret saved');
    } catch {
      toast.error('Network error');
    } finally {
      setSavingWh(false);
    }
  }

  async function handleClearWebhook() {
    setClearingWh(true);
    try {
      const res = await fetch('/api/customer/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpay_webhook_secret: null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to clear'); return; }
      setHasWebhookSecret(false);
      toast.success('Webhook secret cleared');
    } catch {
      toast.error('Network error');
    } finally {
      setClearingWh(false);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl).then(() => toast.success('Copied!'));
  }

  const inputCls = `w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white
    placeholder:text-white/20 focus:outline-none focus:border-coffee-500/50 focus:ring-1 focus:ring-coffee-500/20
    transition-colors font-mono`;

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 lg:mb-8">Settings</h1>

      <div className="max-w-xl space-y-6">

        {/* ── API Keys status ─────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <KeyRound size={15} className="text-coffee-400" />
            <h2 className="text-sm font-semibold text-white">Razorpay API Keys</h2>
          </div>
          <p className="text-white/40 text-xs mb-4 leading-relaxed">
            Connect your own Razorpay account so payments go directly to your dashboard.
            Leave empty to use the platform default gateway.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-white/30 text-sm py-2">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : savedKeyId ? (
            <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-xs text-green-400 font-medium">Connected</p>
                  <p className="text-white/50 text-xs font-mono mt-0.5">{savedKeyId}</p>
                </div>
              </div>
              <button
                onClick={handleClearKeys}
                disabled={clearing}
                className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {clearing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {clearing ? 'Clearing…' : 'Clear'}
              </button>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-white/30 text-xs">No custom keys — using platform gateway</p>
            </div>
          )}
        </div>

        {/* ── Set / update API keys ────────────────────────────────── */}
        <form onSubmit={handleSaveKeys} className="glass rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">
            {savedKeyId ? 'Update API Keys' : 'Add Your Razorpay API Keys'}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Key ID</label>
              <input type="text" value={keyId} onChange={e => setKeyId(e.target.value)}
                placeholder="rzp_live_… or rzp_test_…" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Key Secret</label>
              <input type="password" value={secret} onChange={e => setSecret(e.target.value)}
                placeholder="Your Razorpay key secret" className={inputCls} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <a href="https://dashboard.razorpay.com/app/website-app-settings/api-keys"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-white/30 hover:text-coffee-400 transition-colors">
              <ExternalLink size={11} /> Find my keys on Razorpay
            </a>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-coffee-500 hover:bg-coffee-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Keys</>}
            </button>
          </div>
        </form>

        {/* ── Webhook secret ───────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Webhook size={15} className="text-coffee-400" />
            <h2 className="text-sm font-semibold text-white">Webhook Secret</h2>
          </div>
          <p className="text-white/40 text-xs leading-relaxed">
            Required for Razorpay to notify Lyra when a payment is captured.
            Register the URL below in your Razorpay dashboard under{' '}
            <span className="text-white/60">Webhooks → Add New Webhook</span>, then paste
            the webhook secret here.
          </p>

          {/* Webhook URL to copy */}
          {webhookUrl && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
              <p className="text-white/50 text-xs font-mono truncate">{webhookUrl}</p>
              <button onClick={copyWebhookUrl}
                className="shrink-0 text-white/30 hover:text-coffee-400 transition-colors">
                <Copy size={13} />
              </button>
            </div>
          )}

          {/* Current status */}
          {!loading && (
            hasWebhookSecret ? (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                  <p className="text-xs text-green-400 font-medium">Webhook secret configured</p>
                </div>
                <button onClick={handleClearWebhook} disabled={clearingWh}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors disabled:opacity-40">
                  {clearingWh ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  {clearingWh ? 'Clearing…' : 'Clear'}
                </button>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <p className="text-white/30 text-xs">No webhook secret set</p>
              </div>
            )
          )}

          {/* Set / update webhook secret */}
          <form onSubmit={handleSaveWebhook} className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">
                {hasWebhookSecret ? 'Replace Webhook Secret' : 'Webhook Secret'}
              </label>
              <input type="password" value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)}
                placeholder="Paste your Razorpay webhook secret" className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={savingWh}
                className="flex items-center gap-2 bg-coffee-500 hover:bg-coffee-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                {savingWh ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Secret</>}
              </button>
            </div>
          </form>
        </div>

        <p className="text-white/20 text-xs px-1 leading-relaxed">
          Secrets are never returned to the browser. API key ID and secret must be set together.
        </p>
      </div>
    </div>
  );
}
