"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordStrength } from "@/components/ui/PasswordStrength";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setToken } = useAuth();
  const [form, setForm] = useState({ email: "", username: "", displayName: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      setUser(data.user);
      setToken(data.token);
      router.push("/channels");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dc-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dc-sidebar rounded-lg shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-dc-accent-dim mb-4">
            <span className="text-3xl">💸</span>
          </div>
          <h1 className="text-2xl font-bold text-dc-text">Create an account</h1>
          <p className="text-dc-muted mt-1 text-sm">Join DollarCord today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-dc-danger/10 border border-dc-danger/30 text-dc-danger text-sm rounded p-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              required
              className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => update("username", e.target.value.toLowerCase())}
              required
              className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
              placeholder="cooluser42"
            />
            <p className="text-dc-faint text-xs mt-1">Letters, numbers, underscores, dots, hyphens</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              required
              className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
              placeholder="Cool User"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
              className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
              placeholder="At least 8 characters"
            />
            <PasswordStrength password={form.password} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md transition-colors text-sm mt-2"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-dc-muted text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-dc-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
