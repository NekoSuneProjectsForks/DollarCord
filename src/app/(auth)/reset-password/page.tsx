"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-dc-danger/10 border border-dc-danger/30 text-dc-danger text-sm rounded p-3">
        Missing reset token. Request a new link from the{" "}
        <Link href="/forgot-password" className="underline">forgot password</Link> page.
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-dc-success/10 border border-dc-success/30 text-dc-text text-sm rounded p-3">
        Password reset! Redirecting to sign in…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-dc-danger/10 border border-dc-danger/30 text-dc-danger text-sm rounded p-3">{error}</div>
      )}
      <div>
        <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">New Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Confirm Password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md transition-colors text-sm"
      >
        {loading ? "Resetting…" : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-dc-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dc-sidebar rounded-lg shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-dc-accent-dim mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-dc-text">Set a new password</h1>
        </div>
        <Suspense fallback={<p className="text-dc-muted text-sm text-center">Loading…</p>}>
          <ResetForm />
        </Suspense>
        <p className="text-center mt-6">
          <Link href="/login" className="text-dc-accent hover:underline text-sm">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
