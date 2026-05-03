const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

const WIDTH = 1600;
const HEIGHT = 1000;

// 🔥 ahora puedes usar LOCAL o URL
const DEFAULT_AVATAR = path.join(__dirname, "assets/avatar.png");
const DEFAULT_5V5_BG = path.join(__dirname, "assets/bg.png");

const imageCache = new Map();

// =========================
// LOAD ROBUSTO (URL + LOCAL)
// =========================
async function loadImageSafe(src) {
  if (!src) return null;

  if (imageCache.has(src)) {
    return imageCache.get(src);
  }

  try {
    let img;

    // 🔥 LOCAL FILE
    if (!src.startsWith("http")) {
      if (!fs.existsSync(src)) {
        console.log("❌ no existe:", src);
        return null;
      }
      img = await loadImage(src);
    } 
    // 🌐 URL
    else {
      const res = await fetch(src, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      if (!res.ok) {
        console.log("❌ error HTTP:", src);
        return null;
      }

      const buffer = await res.buffer();
      img = await loadImage(buffer);
    }

    imageCache.set(src, img);
    return img;

  } catch (e) {
    console.log("❌ fallo cargando:", src);
    return null;
  }
}

// =========================
// UTILIDADES (NO TOCADAS)
// =========================
function safeDecode(v) {
  if (!v) return "";
  try { return decodeURIComponent(v); } catch { return v; }
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
  const hue2 = (hue1 + 35 + (h % 40)) % 360;

  return {
    fill: `hsla(${hue1},85%,60%,0.18)`,
    stroke: `hsla(${hue1},90%,70%,0.45)`,
    text: `hsla(${hue2},100%,96%,0.98)`,
    glow: `hsla(${hue1},90%,65%,0.22)`
  };
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// =========================
// FORMACIONES (SIN CAMBIOS)
// =========================
function normalizeType(type) {
  return String(type || "5").toLowerCase();
}

function getFormation(type) {
  const t = normalizeType(type);

  if (t === "3" || t === "3v3") return ["rw","cf","lw"];
  if (t === "4" || t === "4v4") return ["rw","cf","lw","gk"];
  if (t === "5" || t === "5v5") return ["cf","rw","cm","lw","gk"];
  if (t === "8" || t === "8v8") return ["rw","drw","cf","dcf","lw","dlw","cm","gk"];

  return ["cf","rw","cm","lw","gk"];
}

// =========================
// COORDS (SIN CAMBIOS)
// =========================
function getPositionCoords(pos, type) {
  if (type === "5" || type === "5v5") {
    if (pos === "cf") return { x: 800, y: 165 };
    if (pos === "rw") return { x: 1300, y: 420 };
    if (pos === "cm") return { x: 800, y: 470 };
    if (pos === "lw") return { x: 370, y: 420 };
    if (pos === "gk") return { x: 800, y: 820 };
  }
  return { x: WIDTH / 2, y: HEIGHT / 2 };
}

// =========================
// PLAYER (NO BORRADO)
// =========================
async function drawFiveVFivePlayer(ctx, player, x, y) {
  const avatarURL = player.avatar || DEFAULT_AVATAR;
  const name = player.name || "?";
  const style = player.style || "?";

  const size = 150;
  const palette = paletteFromSeed(`${name}|${style}|${avatarURL}`);

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 18;

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 14, 0, Math.PI * 2);
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.restore();

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
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;
  ctx.stroke();

  const badgeW = Math.max(120, Math.min(260, style.length * 18 + 42));
  const badgeH = 54;

  const bx = x + size / 2 - 10;
  const by = y + 25;

  roundedRect(ctx, bx, by, badgeW, badgeH, 15);
  ctx.fillStyle = palette.fill;
  ctx.fill();

  ctx.strokeStyle = palette.stroke;
  ctx.stroke();

  ctx.font = "bold 24px Sans";
  ctx.fillStyle = palette.text;
  ctx.fillText(style, bx + badgeW / 2, by + badgeH / 2);

  ctx.font = "bold 28px Sans";
  ctx.fillStyle = "white";
  ctx.fillText(name, x, y + 110);
}

// =========================
// ENDPOINT (FIX REAL)
// =========================
app.get("/formation", async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const isFive = type === "5" || type === "5v5";

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    let stadium = safeDecode(req.query.stadium);

    let bg = await loadImageSafe(stadium);

    // 🔥 fallback REAL
    if (!bg) {
      console.log("⚠️ fallback fondo");
      bg = await loadImageSafe(DEFAULT_5V5_BG);
    }

    // 🔥 nunca queda vacío
    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    const positions = getFormation(type);

    await Promise.all(positions.map(async (pos) => {
      const player = {
        avatar: safeDecode(req.query[pos + "Avatar"]),
        name: safeDecode(req.query[pos + "Name"]),
        style: safeDecode(req.query[pos + "Style"])
      };

      const { x, y } = getPositionCoords(pos, type);

      if (isFive) {
        await drawFiveVFivePlayer(ctx, player, x, y);
      }
    }));

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 VERSION PRO ESTABLE");
});