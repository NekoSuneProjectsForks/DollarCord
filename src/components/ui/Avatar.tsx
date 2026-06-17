import type { User } from "@/types";

interface AvatarProps {
  user: Pick<User, "displayName" | "username" | "avatarUrl">;
  size?: "xs" | "sm" | "md" | "lg";
  online?: boolean;
  /** When provided, the presence dot reflects ONLINE/IDLE/DND/etc. */
  status?: string;
  className?: string;
}

function statusDotClass(status: string | undefined, online: boolean | undefined): string {
  // Offline / invisible always read as gray, regardless of status value.
  if (online === false) return "bg-dc-faint";
  switch (status) {
    case "IDLE":
      return "bg-dc-warning";
    case "DND":
      return "bg-dc-danger";
    case "INVISIBLE":
    case "OFFLINE":
      return "bg-dc-faint";
    case "ONLINE":
    default:
      return online === undefined ? "bg-dc-faint" : "bg-dc-success";
  }
}

const sizes = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-14 h-14 text-xl",
};

const indicatorSizes = {
  xs: "w-2 h-2 -bottom-0.5 -right-0.5",
  sm: "w-2.5 h-2.5 -bottom-0.5 -right-0.5",
  md: "w-3 h-3 -bottom-0.5 -right-0.5",
  lg: "w-4 h-4 -bottom-0.5 -right-0.5",
};

// Generate consistent background color from username
function hashColor(str: string): string {
  const colors = [
    "bg-violet-600", "bg-blue-600", "bg-green-600", "bg-red-600",
    "bg-orange-600", "bg-pink-600", "bg-teal-600", "bg-indigo-600",
  ];
  let hash = 0;
  for (const char of str) hash = (hash * 31 + char.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}

export function Avatar({ user, size = "md", online, status, className = "" }: AvatarProps) {
  const initial = (user.displayName || user.username || "?")[0].toUpperCase();
  const colorClass = hashColor(user.username || user.displayName || "x");

  return (
    <div className={`relative shrink-0 ${sizes[size]} ${className}`}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className={`${sizes[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full ${colorClass} flex items-center justify-center font-semibold text-white select-none`}
        >
          {initial}
        </div>
      )}
      {(online !== undefined || status !== undefined) && (
        <span
          className={`absolute ${indicatorSizes[size]} rounded-full border-2 border-dc-sidebar ${statusDotClass(
            status,
            online
          )}`}
        />
      )}
    </div>
  );
}
