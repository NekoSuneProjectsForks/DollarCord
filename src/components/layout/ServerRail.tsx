"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSocket } from "@/contexts/SocketContext";
import { CreateServerModal } from "@/components/modals/CreateServerModal";
import { JoinServerModal } from "@/components/modals/JoinServerModal";
import type { Channel, Server, User } from "@/types";

interface ServerWithRole extends Server {
  role: string;
  channels: Channel[];
}

interface Props {
  user: User;
  initialServers: ServerWithRole[];
}

function ServerIcon({ server, active }: { server: Server; active: boolean }) {
  const initial = server.name[0].toUpperCase();
  const colors = [
    "bg-violet-600", "bg-blue-600", "bg-emerald-600",
    "bg-rose-600", "bg-amber-600", "bg-cyan-600",
  ];
  let hash = 0;
  for (const c of server.name) hash = (hash * 31 + c.charCodeAt(0)) & 0xff;
  const color = colors[hash % colors.length];

  return (
    <Link
      href={`/servers/${server.id}`}
      className="group relative flex items-center"
      title={server.name}
    >
      <span
        className={`absolute -left-3 w-1 rounded-r-full bg-dc-text transition-all ${
          active ? "h-8" : "h-4 opacity-0 group-hover:opacity-100"
        }`}
      />
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg transition-all duration-150 ${
          active ? "rounded-2xl" : "group-hover:rounded-2xl"
        } ${server.iconUrl ? "" : color} shadow-lg cursor-pointer`}
      >
        {server.iconUrl ? (
          <img src={server.iconUrl} alt={server.name} className="w-full h-full rounded-[inherit] object-cover" />
        ) : (
          initial
        )}
      </div>
    </Link>
  );
}

export function ServerRail({ user: _user, initialServers }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { socket } = useSocket();
  const [servers, setServers] = useState<ServerWithRole[]>(initialServers);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const onServerUpdate = () => {
      fetch("/api/servers")
        .then((r) => r.json())
        .then((d) => setServers(d.servers ?? []));
    };

    socket.on("servers:update", onServerUpdate);
    return () => {
      socket.off("servers:update", onServerUpdate);
    };
  }, [socket]);

  const activeServerId = pathname.match(/\/servers\/([^/]+)/)?.[1];

  useEffect(() => {
    if (!activeServerId) return;
    if (servers.some((server) => server.id === activeServerId)) return;
    router.push("/channels");
  }, [activeServerId, router, servers]);

  function handleServerCreated(server: ServerWithRole) {
    setServers((prev) => [...prev, server]);
    setShowCreate(false);

    const firstChannel = server.channels?.[0];
    if (firstChannel) {
      router.push(`/servers/${server.id}/${firstChannel.id}`);
      return;
    }

    router.push(`/servers/${server.id}`);
  }

  function handleServerJoined(server: ServerWithRole) {
    if (!servers.find((s) => s.id === server.id)) {
      setServers((prev) => [...prev, server]);
    }
    setShowJoin(false);
  }

  return (
    <>
      <nav className="w-[72px] bg-dc-rail shrink-0">
        <div className="relative flex h-full flex-col items-center pt-3 pb-2">
          <Link
            href="/channels"
            className="group relative flex items-center"
            title="Direct Messages"
          >
            <span
              className={`absolute -left-3 w-1 rounded-r-full bg-dc-text transition-all ${
                pathname.startsWith("/channels") ? "h-8" : "h-4 opacity-0 group-hover:opacity-100"
              }`}
            />
            <div
              className={`w-12 h-12 bg-dc-sidebar flex items-center justify-center transition-all duration-150 shadow-lg font-bold text-lg ${
                pathname.startsWith("/channels")
                  ? "rounded-2xl bg-dc-accent text-white"
                  : "rounded-full group-hover:rounded-2xl group-hover:bg-dc-accent text-dc-text group-hover:text-white"
              }`}
            >
              $
            </div>
          </Link>

          <Link href="/discover" className="group relative flex items-center" title="Discover servers">
            <span
              className={`absolute -left-3 w-1 rounded-r-full bg-dc-text transition-all ${
                pathname.startsWith("/discover") ? "h-8" : "h-4 opacity-0 group-hover:opacity-100"
              }`}
            />
            <div
              className={`w-12 h-12 flex items-center justify-center transition-all duration-150 shadow-lg text-xl ${
                pathname.startsWith("/discover")
                  ? "rounded-2xl bg-dc-success text-white"
                  : "rounded-full bg-dc-sidebar group-hover:rounded-2xl group-hover:bg-dc-success text-dc-success group-hover:text-white"
              }`}
            >
              🧭
            </div>
          </Link>

          <div className="w-8 h-px bg-dc-divider my-1" />

          <div className="flex min-h-0 flex-1 w-full flex-col items-center gap-2 overflow-y-auto scrollbar-thin">
            {servers.map((server) => (
              <ServerIcon
                key={server.id}
                server={server}
                active={activeServerId === server.id}
              />
            ))}

            {servers.length > 0 && <div className="w-8 h-px bg-dc-divider my-1" />}
          </div>

          <div className="relative mt-2">
            <button
              onClick={() => setShowAddMenu((p) => !p)}
              className="w-12 h-12 rounded-full bg-dc-chat hover:bg-dc-success hover:rounded-2xl flex items-center justify-center text-dc-success hover:text-white transition-all duration-150 font-bold text-xl shadow"
              title="Add a server"
            >
              +
            </button>
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                <div className="absolute bottom-0 left-14 z-50 bg-dc-sidebar rounded-lg shadow-xl border border-dc-border overflow-hidden w-44">
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                    onClick={() => { setShowCreate(true); setShowAddMenu(false); }}
                  >
                    Create a Server
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                    onClick={() => { setShowJoin(true); setShowAddMenu(false); }}
                  >
                    Join a Server
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <CreateServerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleServerCreated}
      />
      <JoinServerModal
        open={showJoin}
        onClose={() => setShowJoin(false)}
        onJoined={handleServerJoined}
      />
    </>
  );
}
