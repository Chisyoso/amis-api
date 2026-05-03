const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

const DEFAULT_AVATAR = "https://i.imgur.com/4jduEyb.png";
const DEFAULT_5V5_BG = "https://i.imgur.com/dRSz8QM.png";

const app = express();
const PORT = process.env.PORT || 3000;

const WIDTH = 1600;
const HEIGHT = 1000;

// =========================
// CACHE
// =========================
const imageCache = new Map();
const colorCache = new Map();

// 🔥 PRELOAD DEL FONDO (CLAVE PARA VELOCIDAD + FIABILIDAD)
(async () => {
  try {
    const img = await loadImage(DEFAULT_5V5_BG);
    imageCache.set(DEFAULT_5V5_BG, img);
    console.log("BG precargado ⚡");
  } catch {}
})();

// =========================
// UTILIDADES
// =========================
function safeDecode(v) {
  if (!v) return "";
  try { return decodeURIComponent(String(v)); } catch { return String(v); }
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function paletteFromSeed(seed) {
  const h = hashString(seed || "?");
  const hue1 = h % 360;
  const hue2 = (hue1 + 35) % 360;

  return {
    fill: `hsla(${hue1}, 85%, 60%, 0.18)`,
    stroke: `hsla(${hue1}, 90%, 70%, 0.45)`,
    text: `hsla(${hue2}, 100%, 96%, 0.98)`,
    glow: `hsla(${hue1}, 90%, 65%, 0.12)`
  };
}

function randomBorderColor(seed) {
  if (colorCache.has(seed)) return colorCache.get(seed);

  const h = Math.abs(hashString(seed)) % 360;
  const color = `hsl(${h}, 100%, 65%)`;

  colorCache.set(seed, color);
  return color;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// =========================
// IMAGE CACHE OPTIMIZADO
// =========================
async function loadImageSafe(url) {
  if (!url) return null;

  if (imageCache.has(url)) return imageCache.get(url);

  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;

    const buffer = await res.buffer();
    const img = await loadImage(buffer);

    imageCache.set(url, img);
    return img;
  } catch {
    return null;
  }
}

// =========================
// FORMACIONES
// =========================
function normalizeType(type) {
  return String(type || "5").toLowerCase();
}

function getFormation(type) {
  const t = normalizeType(type);

  if (t === "3" || t === "3v3") return ["rw", "cf", "lw"];
  if (t === "4" || t === "4v4") return ["rw", "cf", "lw", "gk"];
  if (t === "5" || t === "5v5") return ["cf", "rw", "cm", "lw", "gk"];
  if (t === "8" || t === "8v8") return ["rw","drw","cf","dcf","lw","dlw","cm","gk"];

  return ["cf", "rw", "cm", "lw", "gk"];
}

// =========================
// COORDS
// =========================
function getPositionCoords(pos, type) {
  const t = normalizeType(type);

  if (t === "5" || t === "5v5") {
    if (pos === "cf") return { x: 800, y: 165 };
    if (pos === "rw") return { x: 1300, y: 420 };
    if (pos === "cm") return { x: 800, y: 470 };
    if (pos === "lw") return { x: 370, y: 420 };
    if (pos === "gk") return { x: 800, y: 820 };
    return { x: WIDTH / 2, y: HEIGHT / 2 };
  }

  if (pos === "rw") return { x: WIDTH / 2 - 110, y: 120 };
  if (pos === "drw") return { x: WIDTH / 2 + 110, y: 120 };
  if (pos === "cf") return { x: 250, y: HEIGHT / 2 - 120 };
  if (pos === "dcf") return { x: 250, y: HEIGHT / 2 + 120 };
  if (pos === "lw") return { x: WIDTH / 2 - 110, y: HEIGHT - 160 };
  if (pos === "dlw") return { x: WIDTH / 2 + 110, y: HEIGHT - 160 };
  if (pos === "cm") return { x: WIDTH / 2, y: HEIGHT / 2 };
  if (pos === "gk") return { x: WIDTH - 220, y: HEIGHT / 2 };

  return { x: WIDTH / 2, y: HEIGHT / 2 };
}

// =========================
// PLAYER DRAW
// =========================
async function drawFiveVFivePlayer(ctx, player, x, y) {
  const avatarURL = player.avatar || DEFAULT_AVATAR;
  const name = player.name || "?";
  const style = player.style || "?";

  const size = 150;
  const seed = `${name}|${style}|${avatarURL}`;

  const palette = paletteFromSeed(seed);
  const border = randomBorderColor(seed);

  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 14, 0, Math.PI * 2);
  ctx.fillStyle = palette.fill;
  ctx.fill();

  ctx.shadowBlur = 0;

  const avatar = await loadImageSafe(avatarURL);

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 2, 0, Math.PI * 2);
  ctx.strokeStyle = border;
  ctx.lineWidth = 4;
  ctx.stroke();

  const badgeW = Math.max(120, Math.min(260, style.length * 16 + 40));
  const badgeH = 52;

  const bx = x + size / 2 - 10;
  const by = y + 25;

  roundedRect(ctx, bx, by, badgeW, badgeH, 14);
  ctx.fillStyle = palette.fill;
  ctx.fill();

  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 22px Sans";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = palette.text;
  ctx.fillText(style, bx + badgeW / 2, by + badgeH / 2);

  ctx.font = "bold 26px Sans";
  ctx.fillStyle = "white";
  ctx.fillText(name, x, y + 110);
}

// =========================
// API FIXED
// =========================
app.get("/formation", async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const isFive = type === "5" || type === "5v5";
    const positions = getFormation(type);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    let bg = null;

    const stadium = req.query.stadium;

    // 🔥 FIX CLAVE: fallback seguro + cache
    if (stadium && imageCache.has(stadium)) {
      bg = imageCache.get(stadium);
    } else if (stadium) {
      bg = await loadImageSafe(stadium);
      if (bg) imageCache.set(stadium, bg);
    }

    if (!bg) {
      bg = imageCache.get(DEFAULT_5V5_BG);
    }

    if (!bg) {
      bg = await loadImageSafe(DEFAULT_5V5_BG);
      imageCache.set(DEFAULT_5V5_BG, bg);
    }

    ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);

    await Promise.all(
      positions.map(async (pos) => {
        const player = {
          avatar: safeDecode(req.query[pos + "Avatar"]) || DEFAULT_AVATAR,
          name: safeDecode(req.query[pos + "Name"]) || "?",
          style: safeDecode(req.query[pos + "Style"]) || "?"
        };

        const { x, y } = getPositionCoords(pos, type);

        if (isFive) await drawFiveVFivePlayer(ctx, player, x, y);
      })
    );

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (e) {
    console.error(e);
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => {
  console.log("⚡ API ULTRA FIXED + FAST + STABLE");
});