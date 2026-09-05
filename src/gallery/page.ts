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
    <input id="imageInput" type="file" accept="image/*" multiple class="hidden">
    <input id="fileInput" type="file" multiple class="hidden">
    <button id="textBtn" style="background:#444">✎ 文字</button>
    <button id="uploadBtn">+ 图片</button>
    <button id="fileBtn">+ 文件</button>
    <button id="selectBtn" style="background:#444">选择</button>
    <button id="delSelBtn" class="hidden" style="background:#d23">删除选中</button>
    <button id="cancelSelBtn" class="hidden" style="background:#444">取消</button>
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
  if (await apiOk()) { showApp(); setupUpload(); await initFeed(); }
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
// Desktop or no-share: trigger a file download. Re-fetches the blob (viewer URL is revoked on load).
document.querySelector("#saveBtn").onclick = async () => {
  if (!currentId) return;
  if (currentKind === "text") {
    try { await navigator.clipboard.writeText($("#viewerText").textContent); toast(DEMO_EN ? "Copied" : "已复制"); }
    catch { toast(DEMO_EN ? "Copy failed — long-press to select" : "复制失败，请长按选择"); }
    return;
  }
  try {
    const res = await fetch("/i/" + currentId + "?size=full", { headers: authHeaders() });
    if (!res.ok) { toast(DEMO_EN ? "Save failed" : "保存失败"); return; }
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "bin").replace("jpeg", "jpg");
    const name = (currentItem && currentItem.name) || currentId + "." + ext;
    const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
    // A generic file's primary action is download. Desktop Chrome may report
    // that it can share files but then show no useful save action, leaving the
    // user with a "下载" button that appears to do nothing. Keep native sharing
    // for images (useful for saving to Photos on mobile), but always trigger a
    // normal browser download for files.
    if (currentKind !== "file" && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
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
    knownIds.delete(currentId);
    document.querySelector("#viewer").classList.add("hidden");
    toast("已删除");
  } else { toast("删除失败"); }
};

// Task 10: Gallery feed with lazy thumbnail loading, infinite scroll, and polling
let cursor = null, loading = false, knownIds = new Set(), pollTimer = null;
let contentObserver;

// Multi-select batch delete: tap cells to select, then "delete selected".
let selectMode = false; const selected = new Set();
function toggleSelect(el) {
  const id = el.dataset.id;
  if (selected.has(id)) { selected.delete(id); el.classList.remove("sel"); }
  else { selected.add(id); el.classList.add("sel"); }
  $("#delSelBtn").textContent = "删除选中 (" + selected.size + ")";
}
function enterSelect() {
  selectMode = true; selected.clear();
  $("#selectBtn").classList.add("hidden"); $("#textBtn").classList.add("hidden"); $("#uploadBtn").classList.add("hidden"); $("#fileBtn").classList.add("hidden");
  $("#delSelBtn").classList.remove("hidden"); $("#cancelSelBtn").classList.remove("hidden");
  $("#delSelBtn").textContent = "删除选中 (0)";
}
function exitSelect() {
  selectMode = false; selected.clear();
  document.querySelectorAll("#grid .sel").forEach((e) => e.classList.remove("sel"));
  $("#selectBtn").classList.remove("hidden"); $("#textBtn").classList.remove("hidden"); $("#uploadBtn").classList.remove("hidden"); $("#fileBtn").classList.remove("hidden");
  $("#delSelBtn").classList.add("hidden"); $("#cancelSelBtn").classList.add("hidden");
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
        knownIds.delete(id);
      }
    } catch {}
  }));
  exitSelect();
  toast("已删除 " + ok + " 项");
}

async function fetchPage(c) {
  const qs = c ? "?cursor=" + encodeURIComponent(c) + "&limit=40" : "?limit=40";
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
  const text = isText(item), image = isImage(item);
  const el = document.createElement(image ? "img" : "div");
  el.dataset.id = item.id;
  el.dataset.kind = text ? "text" : image ? "image" : "file";
  if (text) {
    el.className = "txtcell";
    // /api/list now carries the preview, so the card renders its real text on
    // first paint. The "…" placeholder and the lazy fetch remain for items the
    // server did not inline (past MAX_INLINE_SNIPPETS, or a failed read).
    el.textContent = item.snippet || "…";
  } else if (!image) {
    el.className = "filecell";
    const icon = document.createElement("div"); icon.className = "icon"; icon.textContent = fileIcon(item.contentType || "");
    const name = document.createElement("div"); name.className = "name"; name.textContent = item.name || "未命名文件";
    const meta = document.createElement("div"); meta.className = "meta";
    meta.textContent = [item.contentType || "application/octet-stream", formatBytes(item.size)].filter(Boolean).join(" · ");
    el.append(icon, name, meta);
  }
  el.onclick = () => { if (selectMode) toggleSelect(el); else openFull(item); };
  // Nothing left to load for a text card that already has its snippet —
  // observing it would fire one pointless request per card.
  if (image || (text && !item.snippet)) contentObserver.observe(el);
  return el;
}

function appendItems(items, prepend) {
  const grid = document.querySelector("#grid");
  for (const it of items) {
    if (knownIds.has(it.id)) continue;
    knownIds.add(it.id);
    const cell = makeCell(it);
    if (prepend) grid.prepend(cell); else grid.append(cell);
  }
}

async function loadMore() {
  if (loading || cursor === false) return;
  loading = true;
  try {
    const { items, cursor: next } = await fetchPage(cursor);
    appendItems(items, false);
    cursor = next || false;
  } finally { loading = false; }
}

async function poll() {
  try {
    const { items } = await fetchPage(null);
    // Server returns newest-first; reverse the new batch so prepending yields newest at top.
    appendItems(items.filter((i) => !knownIds.has(i.id)).reverse(), true);
  } catch {}
}

async function initFeed() {
  contentObserver = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      if (e.target.dataset.kind === "text") loadTextSnippet(e.target);
      else if (e.target.dataset.kind === "image") loadThumb(e.target);
      contentObserver.unobserve(e.target);
    }
  }, { rootMargin: "200px" });

  cursor = null; knownIds = new Set();
  document.querySelector("#grid").innerHTML = "";
  await loadMore();

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

function setupUpload() {
  const imageInput = $("#imageInput"), fileInput = $("#fileInput");
  $("#uploadBtn").onclick = () => imageInput.click();
  imageInput.onchange = async () => {
    const files = [...imageInput.files];
    imageInput.value = "";
    let ok = 0;
    for (const f of files) {
      try { await uploadOne(f); ok++; } catch { toast("有图上传失败"); }
    }
    if (ok > 0) toast(ok === files.length ? "上传完成" : ok + "/" + files.length + " 上传成功");
    await poll();
  };

  $("#fileBtn").onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    let ok = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.set("full", file, file.name || "upload");
      try {
        const res = await fetch("/api/upload", { method: "POST", headers: { ...authHeaders(), "x-source": "pwa-file" }, body: fd });
        if (!res.ok) throw new Error("upload failed");
        ok++;
      } catch { toast("有文件上传失败"); }
    }
    if (ok > 0) toast(ok === files.length ? "上传完成" : ok + "/" + files.length + " 上传成功");
    await poll();
  };

  const compose = $("#compose"), composeText = $("#composeText");
  $("#textBtn").onclick = () => { composeText.value = ""; compose.classList.remove("hidden"); composeText.focus(); };
  $("#composeCancel").onclick = () => compose.classList.add("hidden");
  $("#composeSend").onclick = async () => {
    if (await sendText(composeText.value)) { compose.classList.add("hidden"); toast("已发送"); await poll(); }
  };

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
  ["#uploadBtn", "#textBtn", "#selectBtn", "#shareBtn", "#delBtn"].forEach((s) => $(s).classList.add("hidden"));
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
  if (token && await apiOk()) { showApp(); setupUpload(); await initFeed(); }
  else { showGate(); }
})();
</script>
</body>
</html>`;

export const galleryDemoHTML = galleryHTML.replace("const DEMO = false", "const DEMO = true");
