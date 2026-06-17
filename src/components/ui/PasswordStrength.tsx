"use client";

// Lightweight heuristic password strength meter (length + character classes).
// Not a substitute for a breach check, but gives immediate client-side feedback.
function score(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const COLORS = ["bg-dc-danger", "bg-dc-danger", "bg-dc-warning", "bg-dc-accent", "bg-dc-success"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const s = score(password);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded ${i < s ? COLORS[s] : "bg-dc-border"}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-dc-faint">{LABELS[s]}</p>
    </div>
  );
}
