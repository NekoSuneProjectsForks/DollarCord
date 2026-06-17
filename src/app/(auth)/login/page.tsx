"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-dc-accent-dim mb-4">
            <span className="text-3xl">💸</span>
          </div>
          <h1 className="text-2xl font-bold text-dc-text">Welcome back!</h1>
          <p className="text-dc-muted mt-1 text-sm">Sign in to DollarCord</p>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-dc-input text-dc-text px-3 py-2.5 rounded-md border border-dc-border focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md transition-colors text-sm mt-2"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center mt-4">
          <Link href="/forgot-password" className="text-dc-accent hover:underline text-sm">
            Forgot your password?
          </Link>
        </p>

        <p className="text-center text-dc-muted text-sm mt-2">
          Need an account?{" "}
          <Link href="/register" className="text-dc-accent hover:underline font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
