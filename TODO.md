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
- [x] Push-to-talk toggle (Voice/PTT switch; hold Space)
- [x] Screen share (P2P video via perfect-negotiation renegotiation)
- [x] Voice channel text chat (Discord-style attached chat panel)
- [x] Server-mute / server-deafen by moderators (role-checked relay)
- [x] Webcam video (camera toggle + multi-stream tiles alongside screen share)
- [x] Per-user volume sliders + mic/speaker device pickers + adjustable noise gate (VAD)
- [x] **1:1 / group DM calls** (📞/📹 in DMs, ring + incoming banner, reuses the mesh)
- [ ] Voice regions / SFU for large rooms (mesh is fine for small groups) 🟢

### 2.1b GameVox-style positioning
- [x] Low-latency P2P voice, PTT, device selection, per-user volume, noise gate
- [ ] Always-on overlay / global PTT outside the browser (needs desktop agent) 🟡
- [ ] Ping/latency indicator per peer 🟢

### 2.2 Rich Presence / activity (Discord RPC analogue) 🔴
- [x] `Activity` presence model (type, name, details, state, timestamps, assets)
- [x] User status: `ONLINE | IDLE | DND | INVISIBLE` + custom status
- [x] Manual activity (Playing / Streaming / Listening / Watching / Custom)
- [x] Discord-RPC-compatible local **ingest endpoint** (`POST /api/rpc/activity`,
      per-user RPC token, `SetActivity`/`ClearActivity` payload, auto-expiry)
- [x] Presence/activity broadcast over Socket.IO + activity cards on profile popout
      + status colors & activity subtitle in member list
- [x] Auto game detection via **desktop companion agent** (`agent/` — standalone Node
      app that scans processes → matches a game DB → pushes to the ingest endpoint)
- [x] Game/application directory (`agent/games.json`, ~25 starter titles, user-extendable)
- [x] "Join game" / activity invites (joinUrl + party occupancy; Join button on cards)
- [ ] Package the agent as a tray app / installer (Electron or pkg) 🟡
- [ ] Auto-launch agent on boot 🟢

### 2.3 Twitch (and Kick) live detection 🔴
- [x] Twitch Helix client (app-access-token, `streams` lookup) using existing
      `TWITCH_CLIENT_ID/SECRET`
- [x] API route: live status for a user's `twitchChannel` (`GET /api/users/me/twitch`)
- [x] Auto "Streaming" presence when a linked Twitch channel goes live
- [x] Background poller that flips presence to LIVE without a client request (2-min loop,
      now covers Twitch **and** Kick)
- [x] Kick live detection (public v2 channel API — best effort)
- [x] "Now live" announcement message to a configured channel (per-server
      `liveAnnounceChannelId`, set in Server Settings; posted on offline→live)

### 2.4 Discord template import (expanded) 🟠
- [x] Import text & announcement channels (pre-existing)
- [x] Import **voice & stage channels** as voice channels
- [x] Import **roles** (name + color, Discord int → hex, skips @everyone)
- [x] Import **server name & description** (opt-in toggle)
- [x] Import modal toggles for voice / roles / server name
- [x] Import categories / channel ordering & nesting (parent_id → ChannelCategory)
- [ ] Import threads from a template/source (needs Threads, §2.5) 🟡
- [ ] Import per-role permissions once a permission matrix exists (§4) 🟡

### 2.5 Threads 🟠
- [x] `Thread` model (parent channel, name, rootMessage, archived, lastMessageAt)
- [x] Thread messages reuse `Message` via `threadId`
- [x] Create thread from a message (🧵 action) or channel (header); thread list panel
- [x] Real-time thread messages over Socket.IO (`thread:*` rooms)
- [x] Per-thread unread badges (ThreadReadState; dots in panel + count on header 🧵)
- [x] Import threads from templates — native template export/apply now includes threads
      (Discord guild templates don't carry threads, so this covers the native format)

---

## 3. Security & account management (requested)

- [x] **Password reset** (request token + reset form; `PasswordResetToken` model,
      hashed tokens, 1-hour expiry, all sessions revoked on reset). Email transport
      still TODO — dev mode surfaces the link.
- [x] **Username change** (uniqueness + 1-hour cooldown)
- [x] **Change password while logged in** (revokes other sessions)
- [x] **Active-session management** (list devices, revoke one, "log out everywhere")
- [x] **Rate limiting + brute-force lockout** on auth endpoints (login/register/reset)
- [x] **Account deletion / data export** (GDPR JSON export; delete owned servers + account)
- [x] Password strength meter (length + character-class heuristic) on register & change
- [ ] Email change (with re-verification) 🟠 — needs an email transport
- [ ] Email verification on signup 🟠 — needs an email transport
- [ ] **End-to-end encryption for DMs** (per-device keypair, libsodium/WebCrypto;
      server stores ciphertext only) 🟠
- [ ] **Encryption at rest** for sensitive columns (DM bodies, RPC tokens) so a DB
      dump leaks nothing readable 🟠
- [ ] 2FA / TOTP + backup codes 🟠
- [ ] CSRF tokens on state-changing routes 🟠
- [ ] Breach (HIBP) check on passwords 🟢
- [ ] Audit log of security-sensitive actions 🟡

> **Note on "data no one can see":** true zero-knowledge means the server itself
> cannot read it — that requires client-side E2E encryption (keys never leave the
> device). Column encryption at rest protects against DB theft but the server can
> still decrypt. Both are tracked above; E2E DMs is the strongest guarantee.

---

## 4. Discord parity gaps (not yet built)

### Messaging
- [x] File / image / video attachments + uploads (local-disk `/api/upload` → `/public/uploads`)
- [x] Drag-drop & paste upload + image lightbox (gallery view still pending)
- [x] @mentions (users + @everyone/@here) with autocomplete + highlight + "mentions you"
- [x] Mention/unread badges + counts per channel (read-state model + live updates)
- [x] Spoiler tags (`||x||`) + lightweight code-block syntax highlighting
- [x] Slowmode per channel (enforced server-side; composer cooldown; header control)
- [x] Threads (message threads): Thread model, create from message/channel, thread
      panel, real-time replies, reuse of message rendering + composer
- [x] "New messages" divider + jump-to-present (uses read-state)
- [ ] Custom emoji & stickers (server-uploaded) 🟠
- [ ] Forum channels 🟢 — type exists; needs thread-list landing UI
- [ ] Announcement channels + follow 🟢 — type exists; needs follow plumbing
- [ ] Slash commands framework for bots 🟡
- [ ] Message formatting toolbar + emoji picker (full unicode set) 🟡
- [ ] Read receipts (per-user seen markers) 🟠 — divider/jump shipped; seen-by pending
- [ ] Link unfurling / OpenGraph embeds (generic) 🟡

### Structure & permissions
- [x] Channel categories / groups (collapsible, persisted per server)
- [x] NSFW / age-gated channels (flag + create option + confirm gate)
- [x] **Server Supporters** — community support/tier system + tier badge (boosting
      analogue, intentionally NOT a paid "Nitro")
- [x] Role mentions (`@RoleName` pings the role's members + highlight)
- [x] **Granular per-channel/per-role permission matrix** — 14-flag bitfield on roles +
      per-channel allow/deny overrides (EVERYONE/ROLE/MEMBER), Discord-style effective-
      permission computation, enforced in message routes + channel page + sidebar visibility
- [x] **Channel-level overrides / private channels** — permissions modal (tri-state per
      role) + "Make Private" quick action; hidden channels filtered from the sidebar
- [x] Role permission editing in Server Settings (per-role checkboxes)
- [x] Role hierarchy: privilege-escalation guard (only owner can grant a server-managing role)
- [x] **Server discovery / public directory** — `isPublic` toggle + `/discover` page + one-click join
- [x] **Native server templates** — export structure (categories/channels/roles) as JSON + apply
- [x] **AutoMod** (blocked words, max-mentions, invite-link blocking; managers exempt)
- [ ] Full role-position hierarchy gating across all member actions 🟡 (escalation guard shipped)
- [ ] Per-channel/per-member overrides UI (role + everyone shipped; per-member pending) 🟡

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

## 8. Self-hosting & multi-tenancy

- [x] **Per-server file/data paths** — `UPLOAD_ROOT` env; uploads namespaced
      `<root>/<serverId>/...`. A root outside `./public` is streamed via `/api/files`.
      One node already hosts unlimited communities (guilds) in one DB; this gives each
      its own data directory so a single self-host can run many servers cleanly.
- [ ] Per-tenant DB option (schema-per-tenant or DB-per-tenant) for hard isolation 🟡
- [ ] Admin console to list/manage tenant servers + storage usage on a node 🟡
- [ ] Move uploads to S3/R2 with per-server prefixes (cloud multi-tenancy) 🟠

> Note: "more than 2 servers in one node" already works — a DollarCord instance hosts
> any number of guilds. The new piece is per-server data directories (done) so files
> don't comingle. Hard DB isolation per tenant is the optional next step.

---

## 9. Self-host licensing & launch promo — PLAN (not yet built)

Goal: self-hosting is **free for lifetime if claimed before the cutoff (00:00 20 Jul)**;
after that a one-time **$2 USD** unlocks it. Build later in a dedicated pass.

Spec:
- `License` model: `{ id, instanceId, tier (FREE_LIFETIME|PAID|TRIAL), claimedAt, cutoffAt,
  paymentRef?, valid }`. One row per self-host instance (keyed by a generated `instanceId`).
- **Claim flow**: on first boot, instance calls a license endpoint; if `now < cutoffAt`,
  issue `FREE_LIFETIME` and persist. After cutoff, instance is `TRIAL` until paid.
- **Gating**: a soft gate (banner + feature nag) rather than a hard lockout, to avoid
  bricking self-hosts. Gate "create additional server beyond N" or premium cosmetics.
- **Payments** (deferred — needs provider + keys): Stripe/LemonSqueezy one-time $2 checkout
  + webhook → set `tier=PAID`, `paymentRef`. Env: `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`.
- **License server**: a tiny hosted endpoint (this app can host it) that signs license
  tokens (JWT/ed25519) so instances verify offline. Avoid phone-home hard dependency.
- Decisions needed before building: payment provider; what exactly is gated; whether the
  cutoff is wall-clock UTC; whether existing installs are grandfathered.

---

## 10. Matrix integration — PLAN (not yet built)

Goal: bridge DollarCord with Matrix so Matrix users participate in the same rooms — "all
in one system". Build later; needs a reachable homeserver to test.

Architecture (appservice bridge, recommended):
- Run as a **Matrix Application Service** registered with a homeserver (Synapse/Dendrite)
  via `matrix.appservice.yaml` (`as_token`, `hs_token`, namespaces `#dollarcord_*`,
  `@dollarcord_*`).
- **Mapping**: DollarCord server→Matrix space; channel→Matrix room; user→ghost
  `@dollarcord_<username>:hs`. Persist a `MatrixLink { dcChannelId, matrixRoomId }` and
  `MatrixUserLink { dcUserId, matrixUserId }`.
- **Relay**: DC message create → appservice `PUT /rooms/{room}/send` (as the ghost);
  Matrix `m.room.message` (via `/transactions` push) → create a DC message (bot/ghost author).
  Dedupe with an origin tag to prevent echo loops.
- **Media**: upload to Matrix content repo (`/_matrix/media`) and mirror to DollarCord
  attachments; map MXC URIs ↔ our `/api/files` URLs.
- **Auth/identity**: optional — let real Matrix users link their account (double-puppeting)
  for native sends; otherwise relay via a shared bot identity.
- Modules to add: `src/bridge/matrix/{appservice,transactions,relay,mapping}.ts`,
  config under `config/matrix.appservice.yaml`, env `MATRIX_HS_URL`, `MATRIX_AS_TOKEN`,
  `MATRIX_HS_TOKEN`, `MATRIX_SERVER_NAME`.
- Decisions needed: which homeserver; bridge-bot vs double-puppeting; which servers/channels
  are bridged; E2EE rooms (bridging E2EE needs the bridge to hold keys — usually skipped).

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

### Shipped in iteration 2
- Voice: push-to-talk, screen share (P2P), attached text chat, moderator server-mute/deafen
- Kick live detection + "now live" announcements to a configured channel
- Desktop companion agent (`agent/`) for automatic game detection + game directory
- Join-game / activity invites (joinUrl + party occupancy)

### Shipped in iteration 3
- Attachments/uploads (drag/paste/picker + lightbox), @mentions (autocomplete + highlight + badges),
  unread/mention counts (read-state), slowmode, spoilers + code highlighting
- Channel categories + ordering + import categories/nesting; ANNOUNCEMENT/FORUM channel types
- Security: auth rate-limiting, active-session management, account delete + data export, password meter

### Shipped in iteration 4
- **Threads**: model + create-from-message/channel + panel + real-time replies
- New-messages divider + jump-to-present; collapsible categories
- NSFW/age-gated channels; role mentions (`@RoleName` pings members)
- **Server Supporters** (boosting analogue, NOT Nitro) with tiers + badge

### Shipped in iteration 5
- **Permission matrix**: 14-flag role bitfield + per-channel allow/deny overrides, effective-
  permission engine, enforcement (view/send/mention-everyone) + private channels
- Role permission editor; privilege-escalation guard
- Server discovery (`/discover`) + native server templates (export/apply) + AutoMod

### Shipped in iteration 6
- Performance: unread endpoint de-N+1'd (batched groupBy/aggregation) + message index
- Per-server upload data paths (`UPLOAD_ROOT`, namespaced; `/api/files` fallback) for self-host
- Webcam video in voice channels + per-user volume + mic/speaker device pickers + noise-gate slider
- **1:1 / group DM calls** (voice + video + screen, with ring/incoming banner)
- Plans written for self-host licensing/promo (§9) and Matrix integration (§10)

### Next up
1. Self-host licensing + $2 launch promo (§9) — pick a payment provider, then build.
2. Matrix bridge (§10) — stand up a homeserver, then build the appservice.
3. Email transport → email verification/change + real password-reset delivery.
4. E2E-encrypted DMs and/or 2FA TOTP — remaining heavy security items.

> Live progress is tracked in the task list; checked items above are done & building.
