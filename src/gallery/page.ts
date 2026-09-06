// The demo variant is derived once at module load (see the bottom of this file)
// by flipping the DEMO const the inline script declares.
export const galleryHTML = /* html */ `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>shotsync</title>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#111111">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #111; color: #eee; font: 15px/1.4 -apple-system, system-ui, sans-serif; }
  header { position: sticky; top: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
           padding: 10px 14px; background: #181818; border-bottom: 1px solid #2a2a2a; }
  header h1 { font-size: 16px; margin: 0; flex: 1; }
  button { background: #2b6cff; color: #fff; border: 0; border-radius: 8px; padding: 8px 12px; font-size: 14px; }
  #grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; padding: 6px; }
  #grid img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: #222; cursor: pointer; }
  #gate { position: fixed; inset: 0; display: flex; flex-direction: column; gap: 12px;
          align-items: center; justify-content: center; background: #111; padding: 24px; }
  #gate input { padding: 10px; border-radius: 8px; border: 1px solid #333; background: #1c1c1c; color: #eee; width: min(360px, 90vw); }
  .hidden { display: none !important; }
  #toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
           background: #333; padding: 10px 16px; border-radius: 20px; opacity: 0; transition: opacity .2s; }
  #toast.show { opacity: 1; }
  #grid .txtcell { width: 100%; aspect-ratio: 1; border-radius: 6px; background: #1c2030; color: #cdd3e0;
                   padding: 8px; font-size: 12px; line-height: 1.35; overflow: hidden; cursor: pointer;
                   white-space: pre-wrap; word-break: break-word; }
  #grid .filecell { width: 100%; aspect-ratio: 1; border-radius: 6px; background: #24221c; color: #eee;
                    padding: 10px; display: flex; flex-direction: column; justify-content: center; gap: 5px;
                    overflow: hidden; cursor: pointer; }
  #grid .filecell .icon { font-size: 28px; line-height: 1; }
  #grid .filecell .name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #grid .filecell .meta { color: #aaa; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #viewerText { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 16px; white-space: pre-wrap;
                word-break: break-word; color: #eee; font: 14px/1.6 ui-monospace, monospace; }
  #compose { position: fixed; inset: 0; z-index: 11; background: rgba(0,0,0,.92);
             display: flex; flex-direction: column; gap: 10px; padding: 12px; }
  #compose textarea { flex: 1; min-height: 0; resize: none; padding: 12px; border-radius: 8px;
                      border: 1px solid #333; background: #1c1c1c; color: #eee; font-size: 15px; }
  #compose .row { display: flex; justify-content: flex-end; gap: 10px; }
  #grid .sel { outline: 3px solid #2b6cff; outline-offset: -3px; opacity: .8; }
  /* Pool switcher: a full-width segmented control on its own row — the two
     pools are different destinations with different retention, so switching
     must read as a mode change, not another action button. */
  #tabs { display: flex; flex-basis: 100%; background: #222; border-radius: 10px; padding: 3px; gap: 3px; }
  .tab { flex: 1; background: transparent; color: #bbb; padding: 8px 0; font-size: 15px; line-height: 1.2; }
  .tab small { display: block; font-size: 10px; color: #888; }
  .tab.on { background: #2b6cff; color: #fff; }
  .tab.on small { color: #cfe0ff; }
  .tab#tabArchive.on { background: #c9a227; color: #1a1a1a; }
  .tab#tabArchive.on small { color: #4a3b0a; }
  /* Where the next upload lands — tinted to match the active pool. */
  #poolHint { flex-basis: 100%; font-size: 12px; padding: 5px 9px; border-radius: 6px;
              color: #8ab4ff; background: rgba(43,108,255,.1); border: 1px solid rgba(43,108,255,.25); }
  #poolHint.arch { color: #e0b93f; background: rgba(201,162,39,.1); border-color: rgba(201,162,39,.3); }
  /* Usage meter under the header: transit blue + archive amber segments. */
  #usage { width: 100%; }
  #usageText { font-size: 12px; color: #aaa; }
  #usageBar { display: flex; height: 3px; margin-top: 3px; background: #2a2a2a; border-radius: 2px; overflow: hidden; }
  #usageTransit { background: #2b6cff; height: 100%; }
  #usageArchive { background: #c9a227; height: 100%; }
  /* Archive cards carry the same amber so the two pools read apart at a glance. */
  #grid .arch { outline: 3px solid #c9a227; outline-offset: -3px; }
  #grid .arch .badge { position: relative; margin-left: auto; color: #c9a227; font-size: 10px;
                       border: 1px solid #c9a227; border-radius: 4px; padding: 0 4px; align-self: flex-start; }
  #grid .txtcell.arch .badge { align-self: flex-end; }
  #promoteBtn { background: #c9a227; }
</style>
<!-- Inline so the browser never requests /favicon.ico, which this Worker does
     not serve and which showed up as a 404 on every desktop page load. -->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232b6cff'/%3E%3Cpath d='M9 20.5l5-9 4 6 2-3 3 6z' fill='%23fff'/%3E%3Ccircle cx='11.5' cy='11' r='2' fill='%23fff'/%3E%3C/svg%3E">
</head>
<body>
  <div id="gate" class="hidden">
    <div>输入访问 token</div>
    <input id="tokenInput" type="password" placeholder="Bearer token" autocomplete="off">
    <button id="tokenSave">进入相册</button>
    <div id="gateErr" style="color:#ff6b6b"></div>
  </div>

  <header class="hidden" id="bar">
    <h1>shotsync</h1>
    <div id="tabs">
      <button class="tab on" id="tabTransit">中转<small>30 天清理</small></button>
      <button class="tab" id="tabArchive">归档<small>永久保存</small></button>
    </div>
    <div id="poolHint">上传到中转池 · 30 天后自动清理 · 单文件 ≤ 50MB</div>
    <input id="imageInput" type="file" accept="image/*" multiple class="hidden">
    <input id="fileInput" type="file" multiple class="hidden">
    <button id="textBtn" style="background:#444">✎ 文字</button>
    <button id="uploadBtn">+ 图片</button>
    <button id="fileBtn">+ 文件</button>
    <button id="selectBtn" style="background:#444">选择</button>
    <button id="delSelBtn" class="hidden" style="background:#d23">删除选中</button>
    <button id="cancelSelBtn" class="hidden" style="background:#444">取消</button>
    <div id="usage" style="flex-basis:100%">
      <span id="usageText">用量加载中…</span>
      <div id="usageBar"><div id="usageTransit"></div><div id="usageArchive"></div></div>
    </div>
  </header>
  <main id="grid"></main>
  <div id="toast"></div>

  <div id="compose" class="hidden">
    <textarea id="composeText" placeholder="粘贴或输入文字，发送到图池…"></textarea>
    <div class="row">
      <button id="composeSend">发送</button>
      <button id="composeCancel" style="background:#444">取消</button>
    </div>
  </div>

  <div id="viewer" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,.95);display:flex;flex-direction:column;z-index:10">
    <div style="display:flex;justify-content:flex-end;gap:10px;padding:10px">
      <button id="promoteBtn" class="hidden">转存归档</button>
      <button id="shareBtn" style="background:#0a8a5f">分享</button>
      <button id="saveBtn" style="background:#2b6cff">保存</button>
      <button id="delBtn" style="background:#d23">删除</button>
      <button id="closeBtn" style="background:#444">关闭</button>
    </div>
    <img id="viewerImg" class="hidden" style="flex:1;min-height:0;object-fit:contain;width:100%">
    <pre id="viewerText" class="hidden"></pre>
    <div id="viewerFile" class="hidden" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center">
      <div style="font-size:56px">📄</div><strong id="viewerFileName"></strong><span id="viewerFileMeta" style="color:#aaa"></span>
    </div>
  </div>

<script>
const DEMO = false; // the DEMO_MODE worker serves this page with "true" (see index.ts)
// Demo chrome switches to English for non-Chinese browsers (HN/Reddit visitors).
// Normal pools are unaffected: DEMO_EN is always false when DEMO is false.
const DEMO_EN = DEMO && !((navigator.language || "").toLowerCase().startsWith("zh"));
const TOKEN_KEY = "shotsync_token";
let token = localStorage.getItem(TOKEN_KEY) || "";

// Pool constants mirror src/ids.ts. The transit cap doubles as the routing
// threshold: anything bigger cannot transit the Worker anyway (its 100 MB
// request-body ceiling is well above what R2's lifecycle turns over daily).
const MAX_TRANSIT_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const QUOTA_BYTES = 10 * 1024 ** 3;
const THUMB_MAX_BYTES = 50 * 1024 * 1024; // archive images up to this get a thumbnail

const $ = (s) => document.querySelector(s);
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1800); }
function authHeaders() { return { authorization: "Bearer " + token }; }

async function apiOk() {
  const res = await fetch("/api/list?limit=1", { headers: authHeaders() });
  return res.ok;
}

function showGate(err) { $("#gate").classList.remove("hidden"); $("#bar").classList.add("hidden"); if (err) $("#gateErr").textContent = err; }
function showApp() { $("#gate").classList.add("hidden"); $("#bar").classList.remove("hidden"); }

$("#tokenSave").onclick = async () => {
  token = $("#tokenInput").value.trim();
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
  if (await apiOk()) { showApp(); setupUpload(); refreshUsage(true); await initFeed(); }
  else { localStorage.removeItem(TOKEN_KEY); showGate("token 无效"); }
};

// Task 10-12 implementation:

// Full viewer: shows an image or a text item, with delete + save/copy
let currentId = null, currentKind = "image", currentItem = null;

const DISPLAYABLE_IMAGES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
function isImage(item) { return DISPLAYABLE_IMAGES.has((item.contentType || "").toLowerCase()); }
function isText(item) { return (item.contentType || "").toLowerCase() === "text/plain"; }
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(n >= 10 ? 0 : 1) : n) + " " + units[i];
}
function fileIcon(type) {
  if (type === "application/pdf") return "📕";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type.includes("zip") || type.includes("compressed") || type.includes("archive")) return "🗜️";
  return "📄";
}

async function openFull(item) {
  currentId = item.id; currentItem = item;
  const v = $("#viewer"), img = $("#viewerImg"), txt = $("#viewerText"), file = $("#viewerFile");
  img.removeAttribute("src"); img.classList.add("hidden");
  txt.textContent = ""; txt.classList.add("hidden");
  file.classList.add("hidden");
  v.classList.remove("hidden");
  // Only transit items can be promoted; archive items are already permanent.
  $("#promoteBtn").classList.toggle("hidden", !(item.pool === "transit" && !DEMO));
  currentKind = isText(item) ? "text" : isImage(item) ? "image" : "file";
  if (currentKind === "file") {
    $("#viewerFileName").textContent = item.name || "未命名文件";
    $("#viewerFileMeta").textContent = [item.contentType || "application/octet-stream", formatBytes(item.size)].filter(Boolean).join(" · ");
    file.querySelector("div").textContent = fileIcon(item.contentType || "");
    file.classList.remove("hidden");
    $("#saveBtn").textContent = "下载";
    return;
  }
  try {
    const res = await fetch("/i/" + item.id + "?size=full", { headers: authHeaders() });
    if (!res.ok) return;
    if (currentKind === "text") {
      txt.textContent = await res.text();
      txt.classList.remove("hidden");
    } else {
      const url = URL.createObjectURL(await res.blob());
      img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
      img.src = url; img.classList.remove("hidden");
    }
    $("#saveBtn").textContent = currentKind === "text"
      ? (DEMO_EN ? "Copy" : "复制")
      : (DEMO_EN ? "Save" : "保存");
  } catch {}
}

document.querySelector("#closeBtn").onclick = () => document.querySelector("#viewer").classList.add("hidden");

// Transit → archive: server-side copy, id unchanged, cell hops to the archive
// tab on its next load.
document.querySelector("#promoteBtn").onclick = async () => {
  if (!currentId) return;
  try {
    const res = await fetch("/api/promote/" + currentId, { method: "POST", headers: authHeaders() });
    if (res.status === 503) { toast("此部署未配置归档存储"); return; }
    if (!res.ok) { toast("转存失败"); return; }
    const cell = document.querySelector('#grid [data-id="' + currentId + '"]');
    if (cell) cell.remove();
    feed().knownIds.delete(currentId);
    document.querySelector("#viewer").classList.add("hidden");
    toast("已转存归档");
    refreshUsage(true);
  } catch { toast("转存失败"); }
};

// Mint a public, signed, 7-day link for the current item and copy it to the
// clipboard. Copy (not the OS share sheet) because the desktop share sheet has
// no "copy link" entry; clipboard works on both desktop and mobile. If the
// clipboard API is blocked, fall back to a prompt() showing the URL to copy.
document.querySelector("#shareBtn").onclick = async () => {
  if (!currentId) return;
  try {
    const res = await fetch("/api/share/" + currentId, { method: "POST", headers: authHeaders() });
    if (!res.ok) { toast("生成链接失败"); return; }
    const { url } = await res.json();
    try {
      await navigator.clipboard.writeText(url);
      toast("链接已复制（7天有效）");
    } catch {
      prompt("分享链接（7天有效），选中复制：", url);
    }
  } catch { toast("生成链接失败"); }
};

// Save/download the current full image. Mobile: Web Share (save to Photos / forward).
// Desktop: always a plain anchor download — the desktop share sheet is
// unreliable with non-ASCII filenames (archive items keep their original
// names, unlike transit uploads) and its failures/cancels surface as nothing
// happening at all. Re-fetches the blob (viewer URL is revoked on load).
document.querySelector("#saveBtn").onclick = async () => {
  if (!currentId) return;
  if (currentKind === "text") {
    try { await navigator.clipboard.writeText($("#viewerText").textContent); toast(DEMO_EN ? "Copied" : "已复制"); }
    catch { toast(DEMO_EN ? "Copy failed — long-press to select" : "复制失败，请长按选择"); }
    return;
  }
  toast(DEMO_EN ? "Preparing download…" : "准备下载…");
  try {
    const res = await fetch("/i/" + currentId + "?size=full", { headers: authHeaders() });
    if (!res.ok) { toast(DEMO_EN ? "Save failed" : "保存失败"); return; }
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "bin").replace("jpeg", "jpg");
    const name = (currentItem && currentItem.name) || currentId + "." + ext;
    const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
    // Keep native sharing only where its real value lies — saving images to
    // Photos on a phone. If it errors (not user-cancelled), fall back to the
    // anchor download instead of dying silently.
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (currentKind !== "file" && mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // user closed the share sheet
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    // Generous grace period: revoking too early can cut off a large in-flight
    // download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(DEMO_EN ? "Download started" : "已开始下载");
  } catch (e) {
    if (e && e.name !== "AbortError") toast(DEMO_EN ? "Save failed" : "保存失败"); // ignore user-cancelled share
  }
};

document.querySelector("#delBtn").onclick = async () => {
  if (!currentId || !confirm("删除这条？")) return;
  const res = await fetch("/api/img/" + currentId, { method: "DELETE", headers: authHeaders() });
  if (res.ok) {
    const cell = document.querySelector('#grid [data-id="' + currentId + '"]');
    if (cell) cell.remove();
    feed().knownIds.delete(currentId);
    document.querySelector("#viewer").classList.add("hidden");
    toast("已删除");
    refreshUsage(true);
  } else { toast("删除失败"); }
};

// Task 10: Gallery feed with lazy thumbnail loading, infinite scroll, and polling.
// Each pool keeps its own cursor + seen-ids so switching tabs never mixes feeds.
let activePool = "transit";
const feeds = {
  transit: { cursor: null, knownIds: new Set() },
  archive: { cursor: null, knownIds: new Set() },
};
const feed = () => feeds[activePool];
let loading = false, pollTimer = null;
let contentObserver;

// Multi-select batch delete: tap cells to select, then "delete selected".
let selectMode = false; const selected = new Set();
function toggleSelect(el) {
  const id = el.dataset.id;
  if (selected.has(id)) { selected.delete(id); el.classList.remove("sel"); }
  else { selected.add(id); el.classList.add("sel"); }
  $("#delSelBtn").textContent = "删除选中 (" + selected.size + ")";
}
// One place decides which action buttons are visible: selection mode replaces
// them with delete/cancel, and the archive tab hides 文字 (text is a transit
// clipboard feature; archive accepts files and images only).
function updateActionBar() {
  const archive = activePool === "archive";
  $("#selectBtn").classList.toggle("hidden", selectMode);
  $("#delSelBtn").classList.toggle("hidden", !selectMode);
  $("#cancelSelBtn").classList.toggle("hidden", !selectMode);
  $("#textBtn").classList.toggle("hidden", selectMode || archive);
  $("#uploadBtn").classList.toggle("hidden", selectMode);
  $("#fileBtn").classList.toggle("hidden", selectMode);
  const hint = $("#poolHint");
  hint.textContent = archive
    ? "上传到归档池 · 永久保存 · 单文件 ≤ 500MB"
    : "上传到中转池 · 30 天后自动清理 · 单文件 ≤ 50MB";
  hint.classList.toggle("arch", archive);
}
function enterSelect() {
  selectMode = true; selected.clear();
  $("#delSelBtn").textContent = "删除选中 (0)";
  updateActionBar();
}
function exitSelect() {
  selectMode = false; selected.clear();
  document.querySelectorAll("#grid .sel").forEach((e) => e.classList.remove("sel"));
  updateActionBar();
}
async function deleteSelected() {
  if (!selected.size) { exitSelect(); return; }
  if (!confirm("删除选中的 " + selected.size + " 项？")) return;
  const ids = [...selected];
  let ok = 0;
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch("/api/img/" + id, { method: "DELETE", headers: authHeaders() });
      if (res.ok) {
        ok++;
        const cell = document.querySelector('#grid [data-id="' + id + '"]');
        if (cell) cell.remove();
        feed().knownIds.delete(id);
      }
    } catch {}
  }));
  exitSelect();
  toast("已删除 " + ok + " 项");
  refreshUsage(true);
}

async function fetchPage(c) {
  const poolQs = "&pool=" + activePool;
  const qs = c ? "?cursor=" + encodeURIComponent(c) + "&limit=40" + poolQs : "?limit=40" + poolQs;
  const res = await fetch("/api/list" + qs, { headers: authHeaders() });
  if (!res.ok) throw new Error("list failed");
  return res.json();
}

async function loadThumb(img) {
  const id = img.dataset.id;
  try {
    const res = await fetch("/i/" + id + "?size=thumb", { headers: authHeaders() });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    img.src = url;
  } catch {}
}

async function loadTextSnippet(card) {
  try {
    const res = await fetch("/i/" + card.dataset.id, { headers: authHeaders() });
    if (!res.ok) return;
    card.textContent = (await res.text()).slice(0, 140);
  } catch {}
}

function makeCell(item) {
  // Archive images without a thumbnail must not render as an <img>: the
  // server's thumb fallback would stream the full (possibly 500 MB) image.
  // They fall into the file-card branch instead.
  const text = isText(item), image = isImage(item) && (item.hasThumb || item.pool !== "archive");
  const el = document.createElement(image ? "img" : "div");
  el.dataset.id = item.id;
  el.dataset.kind = text ? "text" : image ? "image" : "file";
  if (item.pool === "archive") el.classList.add("arch");
  if (text) {
    el.className = "txtcell";
    // /api/list now carries the preview, so the card renders its real text on
    // first paint. The "…" placeholder and the lazy fetch remain for items the
    // server did not inline (past MAX_INLINE_SNIPPETS, or a failed read).
    el.textContent = item.snippet || "…";
    if (item.pool === "archive") appendBadge(el);
  } else if (!image) {
    el.className = "filecell";
    const icon = document.createElement("div"); icon.className = "icon"; icon.textContent = fileIcon(item.contentType || "");
    const name = document.createElement("div"); name.className = "name"; name.textContent = item.name || "未命名文件";
    const meta = document.createElement("div"); meta.className = "meta";
    meta.textContent = [item.contentType || "application/octet-stream", formatBytes(item.size)].filter(Boolean).join(" · ");
    el.append(icon, name, meta);
    if (item.pool === "archive") appendBadge(el);
  }
  el.onclick = () => { if (selectMode) toggleSelect(el); else openFull(item); };
  // Nothing left to load for a text card that already has its snippet —
  // observing it would fire one pointless request per card.
  if (image || (text && !item.snippet)) contentObserver.observe(el);
  return el;
}

function appendBadge(el) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "归档";
  el.appendChild(badge);
}

function appendItems(items, prepend) {
  const grid = document.querySelector("#grid");
  const knownIds = feed().knownIds;
  for (const it of items) {
    if (knownIds.has(it.id)) continue;
    knownIds.add(it.id);
    const cell = makeCell(it);
    if (prepend) grid.prepend(cell); else grid.append(cell);
  }
}

async function loadMore() {
  const f = feed();
  if (loading || f.cursor === false) return;
  loading = true;
  try {
    const { items, cursor: next } = await fetchPage(f.cursor);
    appendItems(items, false);
    f.cursor = next || false;
  } finally { loading = false; }
}

async function poll() {
  try {
    const { items } = await fetchPage(null);
    // Server returns newest-first; reverse the new batch so prepending yields newest at top.
    appendItems(items.filter((i) => !feed().knownIds.has(i.id)).reverse(), true);
  } catch {}
}

async function renderActivePool() {
  feed().cursor = null;
  feed().knownIds = new Set();
  document.querySelector("#grid").innerHTML = "";
  await loadMore();
}

function switchPool(pool) {
  if (activePool === pool) return;
  if (selectMode) exitSelect();
  activePool = pool;
  $("#tabTransit").classList.toggle("on", pool === "transit");
  $("#tabArchive").classList.toggle("on", pool === "archive");
  // Button labels describe what you pick ("+ 图片" / "+ 文件"); the destination
  // is what the active tab + hint strip say, not a per-button prefix.
  updateActionBar();
  renderActivePool();
}

async function initFeed() {
  contentObserver = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      if (e.target.dataset.kind === "text") loadTextSnippet(e.target);
      else if (e.target.dataset.kind === "image") loadThumb(e.target);
      contentObserver.unobserve(e.target);
    }
  }, { rootMargin: "200px" });

  await renderActivePool();

  window.onscroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) loadMore();
  };
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 20000);
}

function fitDims(w, h, maxEdge) {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return { w, h };
  const s = maxEdge / longEdge;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

// ---- Usage meter + quota guard ------------------------------------------

let usageCache = null, usageAt = 0;
async function refreshUsage(force) {
  if (!force && usageCache && Date.now() - usageAt < 60000) return usageCache;
  try {
    const res = await fetch("/api/usage", { headers: authHeaders() });
    if (res.ok) { usageCache = await res.json(); usageAt = Date.now(); renderUsage(); }
  } catch {}
  return usageCache;
}

function renderUsage() {
  const u = usageCache;
  if (!u) return;
  const total = u.quotaBytes || QUOTA_BYTES;
  $("#usageText").textContent = "中转 " + formatBytes(u.transitBytes) + " · 归档 " + formatBytes(u.archiveBytes)
    + (u.stagingBytes ? " · 待提交 " + formatBytes(u.stagingBytes) : "")
    + " / " + formatBytes(total);
  $("#usageTransit").style.width = Math.min(100, u.transitBytes / total * 100) + "%";
  $("#usageArchive").style.width = Math.min(100, u.archiveBytes / total * 100) + "%";
}

// Second confirmation before an upload pushes the pool past the R2 free tier.
async function quotaConfirm(sizeBytes) {
  const u = await refreshUsage(true);
  if (u && u.totalBytes + sizeBytes > (u.quotaBytes || QUOTA_BYTES)) {
    return confirm("这将超出 10GB 免费存储额度，R2 可能产生费用。仍要上传？");
  }
  return true;
}

// ---- Uploads -------------------------------------------------------------

async function encode(bitmap, maxEdge, type, quality) {
  const { w, h } = maxEdge ? fitDims(bitmap.width, bitmap.height, maxEdge)
                           : { w: bitmap.width, h: bitmap.height };
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function uploadOne(file) {
  const bitmap = await createImageBitmap(file);          // Browser decodes (including HEIC on iOS)
  let full, thumb;
  try {
    full = await encode(bitmap, null, "image/jpeg", 0.92);
    thumb = await encode(bitmap, 480, "image/jpeg", 0.7);
  } finally {
    bitmap.close();                                      // release decoded pixel buffer (mobile memory)
  }
  const fd = new FormData();
  fd.set("full", full, "u.jpg");
  fd.set("thumb", thumb, "t.jpg");
  const res = await fetch("/api/upload", { method: "POST", headers: { ...authHeaders(), "x-source": "pwa" }, body: fd });
  if (!res.ok) throw new Error("upload failed");
  return (await res.json()).id;
}

async function sendText(text) {
  if (!text.trim()) return false;
  const fd = new FormData();
  fd.set("full", new Blob([text], { type: "text/plain" }), "note.txt");
  const res = await fetch("/api/upload", { method: "POST", headers: { ...authHeaders(), "x-source": "pwa" }, body: fd });
  if (!res.ok) { toast("文字发送失败"); return false; }
  return true;
}

// Archive upload: the file goes browser → R2 directly through a presigned PUT
// (500 MB cannot transit the Worker). The PUT must carry NO auth header and a
// type-less Blob body — the signature covers only the URL, and a Content-Type
// header the browser adds on its own would break it. The real content type and
// filename ride along on commit, which server-side-copies the staged object
// into its final a/full/<id> key.
async function uploadArchive(file) {
  const mime = ((file.type || "application/octet-stream").split(";")[0] || "application/octet-stream").toLowerCase();
  const initRes = await fetch("/api/archive/init", {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ contentType: mime, origName: file.name || "", size: file.size }),
  });
  if (initRes.status === 503) { toast("此部署未配置归档存储"); return; }
  if (!initRes.ok) throw new Error("init failed");
  const { id, uploadUrl } = await initRes.json();

  let hasThumb = false;
  if (mime.startsWith("image/") && file.size <= THUMB_MAX_BYTES) {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const thumb = await encode(bitmap, 480, "image/jpeg", 0.7);
        const fd = new FormData();
        fd.set("thumb", thumb, "t.jpg");
        const thumbRes = await fetch("/api/archive/thumb?id=" + id, { method: "POST", headers: authHeaders(), body: fd });
        hasThumb = thumbRes.ok;
      } finally { bitmap.close(); }
    } catch { /* not decodable in this browser — ship the file card instead */ }
  }

  toast("归档上传中…");
  try {
    const put = await fetch(uploadUrl, { method: "PUT", body: new Blob([file]) });
    if (!put.ok) throw new Error("direct upload failed");
    const commit = await fetch("/api/archive/commit", {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ id, contentType: mime, origName: file.name || "", hasThumb }),
    });
    if (!commit.ok) throw new Error("commit failed");
  } catch (e) {
    // Best-effort cleanup of the staged object; the a/inbox/ lifecycle rule is
    // the backstop when even this doesn't make it out.
    try {
      await fetch("/api/archive/abort", {
        method: "POST", headers: { ...authHeaders(), "content-type": "application/json" },
        keepalive: true, body: JSON.stringify({ id }),
      });
    } catch {}
    throw e;
  }
}

// Files bigger than the transit cap must go through the archive's direct-to-R2
// path; on the archive tab everything does, so the tab doubles as a destination
// selector. Transit images keep the JPEG conversion (uploadOne); transit files
// upload verbatim, as they always have.
function routeUpload(file, isImageIntake) {
  if (activePool === "archive" || file.size > MAX_TRANSIT_BYTES) return uploadArchive(file);
  return isImageIntake ? uploadOne(file) : uploadTransitFile(file);
}

async function uploadTransitFile(file) {
  const fd = new FormData();
  fd.set("full", file, file.name || "upload");
  const res = await fetch("/api/upload", { method: "POST", headers: { ...authHeaders(), "x-source": "pwa-file" }, body: fd });
  if (!res.ok) throw new Error("upload failed");
}

function setupUpload() {
  const imageInput = $("#imageInput"), fileInput = $("#fileInput");
  $("#uploadBtn").onclick = () => imageInput.click();
  imageInput.onchange = async () => {
    const files = [...imageInput.files];
    imageInput.value = "";
    let ok = 0;
    for (const f of files) {
      try {
        if (!(await quotaConfirm(f.size))) { toast("已取消上传"); continue; }
        await routeUpload(f, true); ok++;
      } catch { toast("有图上传失败"); }
    }
    if (ok > 0) toast(ok === files.length ? "上传完成" : ok + "/" + files.length + " 上传成功");
    await poll();
    refreshUsage(true);
  };

  $("#fileBtn").onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    let ok = 0;
    for (const file of files) {
      try {
        if (!(await quotaConfirm(file.size))) { toast("已取消上传"); continue; }
        await routeUpload(file, false); ok++;
      } catch { toast("有文件上传失败"); }
    }
    if (ok > 0) toast(ok === files.length ? "上传完成" : ok + "/" + files.length + " 上传成功");
    await poll();
    refreshUsage(true);
  };

  const compose = $("#compose"), composeText = $("#composeText");
  $("#textBtn").onclick = () => { composeText.value = ""; compose.classList.remove("hidden"); composeText.focus(); };
  $("#composeCancel").onclick = () => compose.classList.add("hidden");
  $("#composeSend").onclick = async () => {
    if (await sendText(composeText.value)) { compose.classList.add("hidden"); toast("已发送"); await poll(); refreshUsage(true); }
  };

  $("#tabTransit").onclick = () => switchPool("transit");
  $("#tabArchive").onclick = () => switchPool("archive");

  $("#selectBtn").onclick = enterSelect;
  $("#cancelSelBtn").onclick = exitSelect;
  $("#delSelBtn").onclick = deleteSelected;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// Read-only demo pool: no token gate, no write affordances, a link back to the repo.
async function enterDemo() {
  showApp();
  ["#uploadBtn", "#textBtn", "#selectBtn", "#shareBtn", "#delBtn", "#promoteBtn", "#tabArchive", "#poolHint"].forEach((s) => $(s).classList.add("hidden"));
  if (DEMO_EN) document.documentElement.lang = "en";
  $("#bar h1").textContent = DEMO_EN ? "shotsync · read-only demo" : "shotsync · 只读演示池";
  $("#closeBtn").textContent = DEMO_EN ? "Close" : "关闭";
  const link = document.createElement("a");
  link.href = "https://github.com/Defiabell/shotsync";
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = DEMO_EN ? "Deploy your own in ~5 min →" : "5 分钟部署自己的 →";
  link.style.cssText = "color:#8ab4ff;font-size:13px;text-decoration:none;white-space:nowrap";
  $("#bar").appendChild(link);
  await initFeed();
}

(async function boot() {
  if (DEMO) { await enterDemo(); return; }
  if (token && await apiOk()) { showApp(); setupUpload(); refreshUsage(true); await initFeed(); }
  else { showGate(); }
})();
</script>
</body>
</html>`;

export const galleryDemoHTML = galleryHTML.replace("const DEMO = false", "const DEMO = true");
