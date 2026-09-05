#!/usr/bin/env python3
"""Generate the sample images seeded into the public demo pool.

Outputs JPEGs into demo/assets/. Pure PIL, no other deps:
    python3 scripts/gen-demo-assets.py
The results are committed, so this only needs to rerun when changing the set.
"""
from __future__ import annotations

import pathlib

from PIL import Image, ImageDraw, ImageFont

OUT = pathlib.Path(__file__).resolve().parent.parent / "demo" / "assets"
OUT.mkdir(parents=True, exist_ok=True)


def font(size: int, mono: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        ["/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Monaco.ttf"]
        if mono
        else ["/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/HelveticaNeue.ttc"]
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def save(img: Image.Image, name: str) -> None:
    img.convert("RGB").save(OUT / name, "JPEG", quality=88)
    print(f"wrote {OUT / name}")


def terminal() -> None:
    img = Image.new("RGB", (1200, 760), "#101216")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([16, 16, 1184, 744], 12, fill="#15181e", outline="#2a2f3a")
    for i, c in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        d.ellipse([40 + i * 26, 36, 54 + i * 26, 50], fill=c)
    mono = font(20, mono=True)
    lines = [
        ("$ npm run build", "#8ab4ff"),
        ("", "#ddd"),
        ("vite v7.3.2 building for production...", "#9aa4b2"),
        ("transforming (697) node_modules/react-dom/index.js", "#9aa4b2"),
        ("✓ 697 modules transformed.", "#5dd579"),
        ("dist/assets/index-Dk29xA.css   12.20 kB │ gzip:  3.06 kB", "#ddd"),
        ("dist/assets/index-B92kfz.js   452.20 kB │ gzip: 133.14 kB", "#ddd"),
        ("✓ built in 1.45s", "#5dd579"),
        ("", "#ddd"),
        ("$ npm test", "#8ab4ff"),
        ("Test Files  11 passed (11)", "#5dd579"),
        ("     Tests  56 passed (56)", "#5dd579"),
        ("  Duration  1.68s", "#9aa4b2"),
        ("", "#ddd"),
        ("$ █", "#8ab4ff"),
    ]
    y = 80
    for text, color in lines:
        d.text((48, y), text, font=mono, fill=color)
        y += 42
    save(img, "01-terminal.jpg")


def chart() -> None:
    img = Image.new("RGB", (1200, 760), "#ffffff")
    d = ImageDraw.Draw(img)
    d.text((60, 40), "Weekly Active Users", font=font(34), fill="#111")
    d.text((60, 88), "Last 12 weeks · production", font=font(20), fill="#888")
    left, top, right, bottom = 80, 150, 1140, 680
    for i in range(5):
        y = top + (bottom - top) * i // 4
        d.line([left, y, right, y], fill="#e8e8e8", width=2)
        d.text((left - 16, y - 10), f"{(4 - i) * 2}k", font=font(16), fill="#999", anchor="ra")
    values = [2.1, 2.4, 2.3, 2.9, 3.4, 3.2, 3.9, 4.6, 4.4, 5.3, 6.1, 6.8]
    step = (right - left) / (len(values) - 1)
    pts = [
        (left + i * step, bottom - (v / 8.0) * (bottom - top))
        for i, v in enumerate(values)
    ]
    for i, (x, y) in enumerate(pts):
        d.rectangle([x - 14, y, x + 14, bottom], fill="#dbe7ff")
        if i:
            d.line([pts[i - 1], (x, y)], fill="#2b6cff", width=5)
    for x, y in pts:
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill="#2b6cff", outline="#fff", width=3)
    save(img, "02-chart.jpg")


def sunset() -> None:
    w, h = 1200, 800
    img = Image.new("RGB", (w, h))
    top_c, mid_c, bot_c = (255, 154, 61), (233, 78, 119), (63, 43, 108)
    for y in range(h):
        t = y / h
        if t < 0.5:
            k = t / 0.5
            c = tuple(int(top_c[i] + (mid_c[i] - top_c[i]) * k) for i in range(3))
        else:
            k = (t - 0.5) / 0.5
            c = tuple(int(mid_c[i] + (bot_c[i] - mid_c[i]) * k) for i in range(3))
        ImageDraw.Draw(img).line([(0, y), (w, y)], fill=c)
    d = ImageDraw.Draw(img)
    d.ellipse([w // 2 - 90, 240, w // 2 + 90, 420], fill=(255, 236, 179))
    d.polygon([(0, 640), (210, 460), (390, 620), (540, 500), (760, 660), (0, 800)], fill=(28, 20, 48))
    d.polygon([(520, 680), (760, 520), (980, 650), (1200, 540), (1200, 800), (400, 800)], fill=(18, 13, 34))
    save(img, "03-sunset.jpg")


def kanban() -> None:
    img = Image.new("RGB", (1200, 760), "#f5f6f8")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1200, 64], fill="#ffffff")
    d.text((40, 18), "Sprint Board · Week 32", font=font(24), fill="#222")
    cols = [("Todo", ["调研 R2 生命周期规则", "写 README 英文版"]),
            ("Doing", ["PWA 离线缓存", "分享链接过期页"]),
            ("Done", ["缩略图懒加载", "多选批量删除", "30 天自动清理"])]
    x = 40
    card_font = font(19)
    for title, cards in cols:
        d.rounded_rectangle([x, 100, x + 350, 700], 10, fill="#ebedf1")
        d.text((x + 18, 116), title, font=font(21), fill="#555")
        y = 160
        for c in cards:
            d.rounded_rectangle([x + 14, y, x + 336, y + 78], 8, fill="#ffffff", outline="#dfe2e8")
            d.text((x + 30, y + 26), c, font=card_font, fill="#333")
            y += 96
        x += 380
    save(img, "04-board.jpg")


def code() -> None:
    img = Image.new("RGB", (1200, 760), "#0d1117")
    d = ImageDraw.Draw(img)
    mono = font(20, mono=True)
    lines = [
        ("1", "export async function handleUpload(req, env) {", "#c9d1d9"),
        ("2", "  if (!isAuthed(req, env)) return err(401);", "#c9d1d9"),
        ("3", "", "#c9d1d9"),
        ("4", "  const form = await req.formData();", "#c9d1d9"),
        ("5", "  const full = form.get('full');", "#c9d1d9"),
        ("6", "  const id = makeId(Date.now(), randSuffix());", "#79c0ff"),
        ("7", "", "#c9d1d9"),
        ("8", "  await env.BUCKET.put(fullKey(id), full.stream(), {", "#c9d1d9"),
        ("9", "    httpMetadata: { contentType: full.type },", "#a5d6ff"),
        ("10", "  });", "#c9d1d9"),
        ("11", "", "#c9d1d9"),
        ("12", "  return json({ id });  // 30-day transit pool", "#8b949e"),
        ("13", "}", "#c9d1d9"),
    ]
    y = 70
    for num, text, color in lines:
        d.text((70, y), num, font=mono, fill="#484f58", anchor="ra")
        d.text((100, y), text, font=mono, fill=color)
        y += 48
    save(img, "05-code.jpg")


def phone_note() -> None:
    img = Image.new("RGB", (760, 1300), "#111")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 760, 90], fill="#181818")
    d.text((40, 30), "备忘 · 周末出行", font=font(28), fill="#eee")
    items = ["📍 集合：西湖文化广场 B 口", "🕘 周六 9:30", "🎒 带充电宝 / 防晒 / 水",
             "🚗 老王开车，四个人", "🍜 中午：知味观（已订）", "📷 记得带相机"]
    y = 140
    for it in items:
        d.rounded_rectangle([32, y, 728, y + 120], 14, fill="#1d2027")
        d.text((60, y + 42), it, font=font(26), fill="#dfe3ea")
        y += 148
    save(img, "06-note.jpg")


if __name__ == "__main__":
    terminal()
    chart()
    sunset()
    kanban()
    code()
    phone_note()
