English | [简体中文](README.zh-CN.md)

# shotsync

Your own cross-device image, text & file pool, deployable to Cloudflare's free tier in a few minutes. Drop a screenshot, photo, or file on one device, grab it on another. No app to install (the phone client is a PWA), no third-party image host — your data lives only in your own Cloudflare account.

**🎬 Live demo (read-only sample pool): https://shotsync-demo.defiabell.workers.dev**

![shotsync gallery](docs/screenshot.png)

## What it is

A single **Cloudflare Worker + R2 bucket** backing a small **PWA gallery**:

- Upload **images** (auto-converted to JPEG + thumbnailed client-side), **text** snippets, and arbitrary **files** (up to 50 MB each).
- View a newest-first feed on any device; tap to view full, **save/download**, or **delete**.
- Mint a **signed, expiring public link** to share one item — without exposing the rest of the pool.
- **Token-gated**: one shared secret unlocks the pool; everything else stays private.
- Two pools: a **30-day transit pool** for passing things between devices, plus an **optional permanent archive** (up to 500 MB per file).

## Why

iCloud / AirDrop / network drives / public image hosts are either manual, ecosystem-locked, or route your (possibly work) screenshots through someone else's cloud. shotsync is a self-hosted, free, privacy-respecting take: data only moves between your devices and your own Cloudflare account.

## How it compares (LocalSend, PairDrop, messaging yourself)

The dividing line is **a live transfer vs. a pool that waits**. LocalSend and PairDrop connect two devices that are both awake right now and stream between them. shotsync keeps the item for 30 days, so the sending device can be asleep, on a different network, or in another country by the time you pick it up.

|  | shotsync | [LocalSend](https://localsend.org) | [PairDrop](https://pairdrop.net) |
| --- | --- | --- | --- |
| Both devices online at once | not required | required | required |
| Install | none (PWA in the browser) | an app on every device | none (browser) |
| Across different networks | yes | no — same local network | via a temporary public room |
| Where the bytes go | your own Cloudflare R2 | device to device, no server | peer-to-peer, public signalling server |
| Left behind after transfer | 30 days (or permanently in the archive pool), browsable | nothing | nothing |
| Setup | deploy once, ~5 min | install, then open | just open the page |
| Per-item size limit | 50 MB (500 MB in the archive pool) | bounded by disk | bounded by the connection |

**Choose LocalSend if** both devices are on the same Wi-Fi, both in front of you, and the file is large. It is peer-to-peer, has no practical size ceiling, and needs no internet at all.

**Choose PairDrop if** you want zero setup and would rather not deploy anything. It is the shortest path from nothing to a transferred file.

**Choose shotsync if** you keep sending yourself screenshots and want them still there when you sit back down hours later, on a different machine, on a different network — and you would rather they lived in your own Cloudflare account than on a public image host. It replaces the habit of messaging things to yourself, not AirDrop.

**Do not choose shotsync if** you need per-user accounts: one shared token unlocks the whole pool. See the "Security model & limitations" section below before deploying.

## Features

- Cross-device image + text + file pool (a shared clipboard + screenshot drop)
- PWA gallery — "Add to Home Screen", no native app, no App Store
- Client-side HEIC→JPEG + thumbnail generation (mobile-friendly; the Worker does no image processing)
- Signed, expiring public share links (HMAC-SHA256, 7 days)
- Per-item save/download + multi-select batch delete
- Single-token auth, constant-time compare, token never in URLs
- 30-day auto-retention for the transit pool via R2 lifecycle
- Optional **archive pool**: files up to 500 MB uploaded directly to R2 via presigned URLs, never auto-deleted, one-tap promote from the transit pool
- Shows per-pool + total usage, and warns before an upload would exceed R2's 10 GB free storage allowance
- Runs entirely on the Cloudflare free tier (Workers + R2)
- ~100 tests (Vitest + `@cloudflare/vitest-pool-workers`)

## Deploy your own (~5 min)

Prereqs: a Cloudflare account, Node 18+, and **R2 enabled** (Dashboard → R2 → enable; Cloudflare asks for a card even on the free tier — the free allowance is not charged).

Every setting lives in one `.env` file; one command applies all of it:

```bash
git clone https://github.com/Defiabell/shotsync
cd shotsync
npm install
npx wrangler login

cp .env.example .env   # then fill it in (see the table below)
npm run setup          # bucket + CORS + secrets + deploy, in one go
```

| `.env` key | What it is |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID (Dashboard right sidebar, or `npx wrangler whoami`). Optional if you fill in `R2_S3_ENDPOINT` yourself. |
| `WORKER_ORIGIN` | Your Worker's public URL, e.g. `https://shotsync.<your-subdomain>.workers.dev` — used to lock the R2 CORS rule to your origin. You also need a **workers.dev subdomain** (Dashboard → Workers & Pages, one-time) or a custom domain. |
| `AUTH_TOKEN` | The shared access token each device types in on first use. Leave empty and `npm run setup` generates one and saves it back to `.env`. |
| `R2_BUCKET` | Bucket name; must match `bucket_name` in `wrangler.toml` (default `shotsync`). |
| `R2_S3_ENDPOINT` | Per-bucket S3 endpoint; derived automatically from the account ID when empty — normally leave it empty. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Optional — enables the [archive pool](#archive-pool-optional). |

`npm run setup` is idempotent: change any value in `.env` and re-run it. On a fresh install it generates `AUTH_TOKEN` for you (and writes it back to `.env`), creates the bucket, applies a CORS rule scoped to your origin, sets the secrets, and deploys. The only thing it can't do from the CLI is the R2 lifecycle rules — one dashboard step, [below](#lifecycle-rules-transit-pool--staging).

### Lifecycle rules (transit pool + staging)

The one setup step that must happen in the dashboard (wrangler can't manage lifecycle rules): the transit pool's 30-day cleanup is an **R2 lifecycle rule**. With the archive pool, rules must be **prefix-scoped**; a whole-bucket rule would delete your archive too.

Dashboard → R2 → bucket `shotsync` → Settings → Object lifecycle rules. Create (or fix) these rules:

| Rule | Prefix | Action |
| --- | --- | --- |
| Transit cleanup | `full/` | delete 30 days after creation |
| Transit thumbs | `thumb/` | delete 30 days after creation |
| Staging backstop | `a/inbox/` | delete 1 day after creation |
| Archive | `a/full/`, `a/thumb/` | **no rule — leave alone** |

⚠️ If you deployed earlier and created a whole-bucket "delete after 30 days" rule, **delete or scope it before uploading anything to the archive** — a bucket-wide rule permanently destroys archived files.

### Archive pool (optional)

By default the app is transit-only. To enable the archive pool (permanent storage, 500 MB per file), you create an R2 API token and add it to `.env`. Large files are uploaded **directly from the browser to R2** via a presigned URL, so the Worker never handles the bytes.

1. **Create an R2 API token**: Dashboard → R2 → *Manage R2 API Tokens* → Create API Token → permission **Object Read & Write**, scoped to only the `shotsync` bucket. Copy the Access Key ID and Secret Access Key.

2. **Fill them into `.env`** and re-run setup:

   ```bash
   # .env
   R2_ACCESS_KEY_ID=<access key id>
   R2_SECRET_ACCESS_KEY=<secret access key>
   ```

   ```bash
   npm run setup
   ```

   That's it — the script derives the S3 endpoint from your account ID, applies the bucket CORS rule scoped to your `WORKER_ORIGIN` (in the exact format the R2 API expects — lowercase Cloudflare-API JSON, not S3-style PascalCase), and sets the secrets. The generated `cors.json` is left in the repo root if you want to inspect it.

Notes:

- Transit items get a **转存归档** (promote to archive) button in the viewer — a zero-transfer server-side copy; the 30-day clock stops for that item. Share links (`/s/...`) keep working after promotion.
- Archive images **≤ 50 MB** get client-generated thumbnails; larger files show as file-icon cards.
- Before any upload, if `file size + current usage > 10 GB` the app asks you to confirm — beyond that point R2 storage may start costing money.
- The [live demo](https://shotsync-demo.defiabell.workers.dev) is transit-only (no R2 credentials are configured), so the archive tab and promote button are hidden there.

## Using it

The UI labels are in Chinese; the English in parentheses below maps each step to the button you'll see.

### 1. First time, on each device
1. Open your Worker URL (e.g. `https://shotsync.<subdomain>.workers.dev`).
2. Enter your `AUTH_TOKEN` when prompted — it's saved in `localStorage`, so you won't be asked again on that device.
3. (Optional) In Safari: **Share → Add to Home Screen** to install it as a PWA. It then runs full-screen like an app.

The gallery shows every item newest-first and auto-refreshes every ~20 s, so anything uploaded from another device appears within seconds.

### 2. Add things to the pool
- **Image** — tap **`+ 图片`** (Add image): pick from photos or camera. It's converted to JPEG and thumbnailed in your browser, then uploaded.
- **Text** — tap **`✎ 文字`** (Text), paste/type a snippet, then **`发送`** (Send). It becomes a text card — a cross-device clipboard.
- **File** — tap **`+ 文件`** (Add file): select a PDF, video, audio file, archive, document, or any other file. Its original name and MIME type are retained; each file is limited to 50 MB.
- **Archive** — tap the **`归档`** (Archive) tab, then **`+ 归档`**: same kinds of files but up to 500 MB each, never auto-deleted. Large files upload directly from your browser to R2 (requires the [archive pool setup](#archive-pool-optional)). Small images also generate thumbnails.
- **Promote** — anything in the transit pool can be kept: open it and tap **`转存归档`** (Promote to archive) to copy it into the archive pool; it stops counting toward the 30-day cleanup.
- **Mac screenshots, automatically** — install the [Mac menu-bar app](mac/README.md): every screenshot uploads on its own.
- **iOS share sheet** — set up the [Shortcut](shortcut/README.md) to push an image from any app's share sheet.

### 3. Open one item (tap it)
Tap any thumbnail/card to open it full-screen, then:
- **`保存` / `复制` / `下载`** (Save / Copy / Download) — image: save to Photos (mobile) or download (desktop); text: copy to clipboard; files: download or use the system share sheet.
- **`分享`** (Share) — mint a **7-day public link** to just that item, copied to your clipboard. Anyone with the link can view that one item; the rest of the pool stays private.
- **`删除`** (Delete) — remove this item.
- **`关闭`** (Close) — back to the gallery.

### 4. Delete many at once
1. Tap **`选择`** (Select) to enter selection mode.
2. Tap items to check them (blue outline); tap again to uncheck.
3. Tap **`删除选中 (N)`** (Delete selected) → confirm. Or **`取消`** (Cancel) to leave without deleting.

## Security model & limitations (please read)

- **Single shared token.** Anyone with the URL **and** token can view/upload/delete. This is a single-user / trusted-circle tool, not multi-tenant. Rotate by changing `AUTH_TOKEN` in `.env` and re-running `npm run setup` — note this also invalidates all live share links, since the token is the link signing key.
- **Share links are public** until they expire (7 days): anyone with the link can see that one item.
- **Two pools with different retention.** The transit pool auto-deletes after 30 days by design (via the lifecycle rule above); the archive pool is permanent and counts toward R2's 10 GB free allowance — the app warns before an upload would exceed it, but it can still cost money past that.
- **The UI is currently in Chinese.** i18n PRs welcome.
- The Worker stores received bytes as-is (no server-side image processing); format conversion and thumbnails happen on the client.

## Development

```bash
npm test          # Vitest (workers pool) — full suite
npx tsc --noEmit  # type-check
npm run dev       # local dev — `npm run setup` writes .dev.vars from your .env
```

## Community

- [LinuxDO](https://linux.do/) — a friendly Chinese dev community

## License

[MIT](LICENSE)
