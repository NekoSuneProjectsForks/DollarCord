"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setSent(true);
      setDevToken(data.devToken ?? null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dc-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dc-sidebar rounded-lg shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-dc-accent-dim mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-dc-text">Reset your password</h1>
          <p className="text-dc-muted mt-1 text-sm">We&apos;ll send you a reset link.</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-dc-success/10 border border-dc-success/30 text-dc-text text-sm rounded p-3">
              If an account exists for <span className="font-semibold">{email}</span>, a reset link has been sent.
            </div>
            {devToken && (
              <div className="bg-dc-input rounded p-3 text-xs text-dc-muted break-all">
                <p className="font-semibold text-dc-text mb-1">Dev mode — no email transport configured.</p>
                Use this link to continue:{" "}
                <Link href={`/reset-password?token=${devToken}`} className="text-dc-accent hover:underline">
                  /reset-password?token={devToken.slice(0, 12)}…
                </Link>
              </div>
            )}
            <Link href="/login" className="block text-center text-dc-accent hover:underline text-sm">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md transition-colors text-sm"
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
            <Link href="/login" className="block text-center text-dc-accent hover:underline text-sm">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
