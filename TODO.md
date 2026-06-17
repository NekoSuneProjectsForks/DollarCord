# DollarCord — Roadmap & TODO

A living plan for DollarCord: a real-time, Discord-inspired chat platform built on
**Next.js 14 (App Router) + Socket.IO + Prisma (SQLite) + TailwindCSS**.

Legend: `[x]` done · `[~]` partial / in progress · `[ ]` not started
Priority: 🔴 critical · 🟠 high · 🟡 medium · 🟢 nice-to-have

---

## 1. What exists today (audit)

### Core messaging
- [x] Email/username/password auth (bcrypt, DB-backed sessions, httpOnly cookie)
- [x] Servers/guilds (create, edit, icon, ownership)
- [x] Text channels (create, rename, delete, position ordering, description)
- [x] Messages (send, edit, delete/soft-delete, reply, cursor pagination, search)
- [x] Inline markdown rendering (bold/italic/code/blockquote/strikethrough/URLs)
- [x] Message embeds (YouTube / Twitch / Kick link previews)
- [x] Reactions (emoji, per-user-per-emoji uniqueness, quick picker)
- [x] Pinned messages (per channel, admin/owner gated)
- [x] Direct messages (1:1 threads, user search, DM privacy settings)
- [x] Typing indicators (channels + DMs)
- [x] Presence: online/offline (in-memory Socket.IO map, snapshot + updates)

### Community / moderation
- [x] Server members + roles (OWNER/ADMIN/MEMBER baseline)
- [x] Custom server roles (name, color, position)
- [x] Invites (codes, max uses, expiry)
- [x] Bans (with reason)
- [x] Bots (per-server token auth + bot message API)
- [x] Server events / calendar (RSVP, notify)
- [x] Per-server user settings (notifications, DM privacy, mute, activity sharing flags)
- [x] Import-from-Discord-template flow

### Profile
- [x] Display name, bio, avatar URL
- [x] Twitch / Kick channel fields on profile (links only — not yet live-detected)

### Infra
- [x] Custom Node server hosting Next + Socket.IO on one port
- [x] Route protection middleware
- [x] Prisma singleton, Zod validation, Toast/Auth/Socket contexts

---

## 2. Requested in this work order

> These are the features explicitly asked for. Decisions locked in:
> **voice = WebRTC P2P mesh**, **game/RPC = web-native presence + Discord-RPC-compatible
> ingest endpoint** (auto process-scanning deferred to a future desktop agent),
> **Twitch = server-side Helix detection**.

### 2.1 Voice channels 🔴
- [x] `Channel.type` = `TEXT | VOICE` (schema + migration)
- [x] Voice channels render in sidebar under a "Voice Channels" group
- [x] Join/leave voice; live participant list per voice channel (sidebar + room)
- [x] WebRTC P2P mesh audio (Socket.IO signaling: offer/answer/ICE)
- [x] Voice controls: mute mic, deafen, leave, per-user speaking indicator (VAD)
- [x] STUN config + optional TURN via `NEXT_PUBLIC_TURN_*` env
- [ ] Push-to-talk toggle (VAD is implemented; PTT mode pending) 🟡
- [ ] Screen share / video (P2P) 🟡
- [ ] Voice channel text chat (Discord-style) 🟢
- [ ] Server-mute / server-deafen by moderators 🟡

### 2.2 Rich Presence / activity (Discord RPC analogue) 🔴
- [x] `Activity` presence model (type, name, details, state, timestamps, assets)
- [x] User status: `ONLINE | IDLE | DND | INVISIBLE` + custom status
- [x] Manual activity (Playing / Streaming / Listening / Watching / Custom)
- [x] Discord-RPC-compatible local **ingest endpoint** (`POST /api/rpc/activity`,
      per-user RPC token, `SetActivity`/`ClearActivity` payload, auto-expiry)
- [x] Presence/activity broadcast over Socket.IO + activity cards on profile popout
      + status colors & activity subtitle in member list
- [ ] Auto game detection via **desktop companion agent** (separate Electron/Node app
      that scans processes → matches a game DB → pushes to the ingest endpoint) 🟠
- [ ] Game/application directory (icons + names for known titles) 🟡
- [ ] "Join game" / activity invites 🟢

### 2.3 Twitch (and Kick) live detection 🔴
- [x] Twitch Helix client (app-access-token, `streams` lookup) using existing
      `TWITCH_CLIENT_ID/SECRET`
- [x] API route: live status for a user's `twitchChannel` (`GET /api/users/me/twitch`)
- [x] Auto "Streaming" presence when a linked Twitch channel goes live
- [x] Background poller that flips presence to LIVE without a client request (2-min loop)
- [ ] Kick live detection (public API/scrape — best effort) 🟡
- [ ] "Now live" announcement message to a configured channel 🟢

### 2.4 Discord template import (expanded) 🟠
- [x] Import text & announcement channels (pre-existing)
- [x] Import **voice & stage channels** as voice channels
- [x] Import **roles** (name + color, Discord int → hex, skips @everyone)
- [x] Import **server name & description** (opt-in toggle)
- [x] Import modal toggles for voice / roles / server name
- [ ] Import categories / channel ordering & nesting 🟡
- [ ] Import threads from a template/source (needs Threads, §4) 🟡
- [ ] Import per-role permissions once a permission matrix exists (§4) 🟡

### 2.5 Threads 🟠
- [ ] `Thread` model (parent channel, name, archived, auto-archive duration)
- [ ] `ThreadMessage` (or reuse Message with `threadId`)
- [ ] Create thread from a message or channel; thread list per channel
- [ ] Real-time thread messages + unread state over Socket.IO
- [ ] Import threads from Discord templates/exports (ties into §2.4)

---

## 3. Security & account management (requested)

- [x] **Password reset** (request token + reset form; `PasswordResetToken` model,
      hashed tokens, 1-hour expiry, all sessions revoked on reset). Email transport
      still TODO — dev mode surfaces the link.
- [x] **Username change** (uniqueness + 1-hour cooldown)
- [x] **Change password while logged in** (revokes other sessions)
- [ ] Email change (with re-verification) 🟠
- [ ] Email verification on signup 🟠
- [ ] **End-to-end encryption for DMs** (per-device keypair, libsodium/WebCrypto;
      server stores ciphertext only) 🟠
- [ ] **Encryption at rest** for sensitive columns (DM bodies, RPC tokens) so a DB
      dump leaks nothing readable 🟠
- [ ] 2FA / TOTP + backup codes 🟠
- [ ] Active-session management (list devices, revoke, "log out everywhere") 🟡
- [ ] Rate limiting + brute-force lockout on auth endpoints 🔴
- [ ] CSRF tokens on state-changing routes 🟠
- [ ] Password strength meter + breach (HIBP) check 🟢
- [ ] Audit log of security-sensitive actions 🟡
- [ ] Account deletion / data export (GDPR) 🟡

> **Note on "data no one can see":** true zero-knowledge means the server itself
> cannot read it — that requires client-side E2E encryption (keys never leave the
> device). Column encryption at rest protects against DB theft but the server can
> still decrypt. Both are tracked above; E2E DMs is the strongest guarantee.

---

## 4. Discord parity gaps (not yet built)

### Messaging
- [ ] File / image / video attachments + uploads 🔴
- [ ] Drag-drop & paste upload, image gallery/lightbox 🟠
- [ ] Custom emoji & stickers (server-uploaded) 🟠
- [ ] @mentions (users/roles/@everyone/@here) with autocomplete + highlight 🔴
- [ ] Mention/unread badges + notification counts per channel/server 🔴
- [ ] Threads (message threads) 🟡
- [ ] Forum channels 🟢
- [ ] Announcement channels + follow 🟢
- [ ] Slash commands framework for bots 🟡
- [ ] Message formatting toolbar + emoji picker (full unicode set) 🟡
- [ ] Spoiler tags, code-block syntax highlighting 🟡
- [ ] Read receipts / "new messages" divider + jump-to-present 🟠
- [ ] Slowmode per channel 🟡
- [ ] Link unfurling / OpenGraph embeds (generic) 🟡

### Structure & permissions
- [ ] Channel categories / groups (collapsible) 🟠
- [ ] Granular per-channel/per-role permission matrix (not just OWNER/ADMIN/MEMBER) 🔴
- [ ] Role hierarchy enforcement + role mentions 🟠
- [ ] Channel-level overrides (private channels) 🟠
- [ ] NSFW / age-gated channels 🟢
- [ ] Server boosting / tiers analogue 🟢
- [ ] Server discovery / public directory 🟢
- [ ] Server templates (native, beyond Discord import) 🟢
- [ ] AutoMod (keyword/spam/raid filters) 🟡

### Social
- [ ] Friends system (request/accept/block) 🟠
- [ ] Block users (global) 🟠
- [ ] Group DMs (3+ participants) 🟠
- [ ] User notes, mutual servers/friends 🟢
- [ ] Rich user profile popout (banner, accent, badges, connections) 🟡
- [ ] Notifications: desktop/web push + in-app inbox 🟠

### Voice/video (beyond §2.1)
- [ ] Stage channels 🟢
- [ ] Go Live / stream to channel 🟡
- [ ] Noise suppression, echo cancel, gain control 🟡
- [ ] Per-user volume sliders 🟡
- [ ] Voice region selection 🟢

---

## 5. Beyond Discord — community-requested / novel features

- [ ] **E2E-encrypted DMs by default** (a real differentiator vs Discord) 🟠
- [ ] Local-first / self-hostable with one-command deploy 🟡
- [ ] Message scheduling + reminders 🟢
- [ ] Per-message editable history (view edit diffs) 🟢
- [ ] Built-in translation of messages 🟢
- [ ] Markdown tables, math (KaTeX), Mermaid diagrams in messages 🟢
- [ ] Threaded replies tree view (not just flat reply) 🟢
- [ ] Customizable themes / CSS per user (safe subset) 🟡
- [ ] Voice transcription + searchable transcripts 🟢
- [ ] Polls (native) with live results 🟡
- [ ] Temporary / self-destructing messages 🟢
- [ ] Server analytics dashboard for owners 🟢
- [ ] Plugin/extension API (sandboxed) 🟢
- [ ] AI assistant channel (summarize, moderate, answer) 🟢
- [ ] Bridges to Matrix/IRC/XMPP 🟢
- [ ] Accessibility: full keyboard nav, screen-reader labels, reduced-motion 🟠
- [ ] Mobile PWA / responsive layout 🟠

---

## 6. Engineering / quality

- [ ] Automated tests (unit + integration + e2e Playwright) 🔴
- [ ] CI pipeline (typecheck, lint, test, build) 🟠
- [ ] Migrate SQLite → Postgres for production 🟠
- [ ] Object storage (S3/R2) for uploads 🟠
- [ ] Structured logging + error tracking (Sentry) 🟡
- [ ] Socket.IO horizontal scaling (Redis adapter) 🟡
- [ ] Input sanitization / XSS hardening on markdown 🔴
- [ ] API rate limiting middleware (global) 🟠
- [ ] Health checks + graceful shutdown 🟡
- [ ] Docker / docker-compose for full stack 🟡
- [ ] Seed data + demo mode 🟢

---

## 7. Status of the current iteration

Shipped (all typecheck + `next build` clean):
1. [x] Schema: `Channel.type`, `Activity`, `PasswordResetToken`, status/customStatus,
       `rpcToken`, username-change cooldown. Migrated.
2. [x] Voice: socket signaling + voice-state tracking; sidebar voice group with live
       participants; voice room UI + WebRTC P2P mesh hook with VAD speaking indicator.
3. [x] Presence/RPC: activity model + socket broadcast; `POST /api/rpc/activity` ingest
       with per-user token; activity cards on profile + member list; status picker.
4. [x] Twitch: Helix lib + `/api/users/me/twitch` route + 2-minute background poller.
5. [x] Account: password reset (request/confirm pages + routes), username change,
       change-password (logged in) — all in Settings → Account.
6. [x] Discord template import: voice channels, roles, server name + modal toggles.

### Next up
1. Threads (§2.5) — model + UI + real-time, then import (§2.4).
2. Desktop companion agent for automatic game detection (§2.2).
3. Email transport for password reset; rate limiting on auth (§3, §6).
4. Per-channel/per-role permission matrix (§4) — unlocks private channels + richer import.

> Live progress is tracked in the task list; checked items above are done & building.
