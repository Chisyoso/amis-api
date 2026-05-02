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
// UTILIDADES
// =========================
function safeDecode(v) {
  if (v === undefined || v === null) return "";
  try {
    return decodeURIComponent(String(v));
  } catch {
    return String(v);
  }
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
    fill: `hsla(${hue1}, 85%, 60%, 0.18)`,
    stroke: `hsla(${hue1}, 90%, 70%, 0.45)`,
    text: `hsla(${hue2}, 100%, 96%, 0.98)`,
    glow: `hsla(${hue1}, 90%, 65%, 0.22)`
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

async function loadImageSafe(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!res.ok) return null;

    const buffer = await res.buffer();
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

// =========================
// FORMACIONES
// =========================
function normalizeType(type) {
  return String(type || "5").toLowerCase(); // DEFAULT 5V5
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
// COORDENADAS
// =========================
function getPositionCoords(pos, type) {
  const t = normalizeType(type);

  if (t === "5" || t === "5v5") {
    if (pos === "cf") return { x: 800, y: 165 };
    if (pos === "rw") return { x: 370, y: 400 };
    if (pos === "cm") return { x: 800, y: 470 };
    if (pos === "lw") return { x: 800, y: 820 };
    if (pos === "gk") return { x: 1370, y: 420 };

    return { x: WIDTH / 2, y: HEIGHT / 2 };
  }

  // LEGACY
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
// LEGACY FIELD
// =========================
function drawFieldLines(ctx) {
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;

  ctx.strokeRect(WIDTH - 350, 100, 300, HEIGHT - 200);
  ctx.strokeRect(WIDTH - 200, HEIGHT / 2 - 120, 150, 240);

  ctx.beginPath();
  ctx.arc(WIDTH - 260, HEIGHT / 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(WIDTH - 300, HEIGHT / 2, 120, 0.7 * Math.PI, 1.3 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(WIDTH - 40, HEIGHT / 2 - 150, 20, 300);
}

// =========================
// 5V5 PLAYER DRAW
// =========================
async function drawFiveVFivePlayer(ctx, player, x, y) {
  const avatarURL = player.avatar || DEFAULT_AVATAR;
  const name = player.name || "?";
  const style = player.style || "?";

  const size = 150; // MÁS PEQUEÑO
  const palette = paletteFromSeed(`${name}|${style}|${avatarURL}`);

  // Glow
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

    ctx.drawImage(
      avatar,
      x - size / 2,
      y - size / 2,
      size,
      size
    );

    ctx.restore();
  }

  // BORDE BLANCO
  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 2, 0, Math.PI * 2);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;
  ctx.stroke();

  // Badge style
  const badgeW = Math.max(120, Math.min(260, style.length * 18 + 42));
  const badgeH = 54;

  const bx = x + size / 2 - 10;
  const by = y + 25;

  roundedRect(ctx, bx, by, badgeW, badgeH, 15);
  ctx.fillStyle = palette.fill;
  ctx.fill();

  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 24px Sans";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 5;
  ctx.strokeText(style, bx + badgeW / 2, by + badgeH / 2);

  ctx.fillStyle = palette.text;
  ctx.fillText(style, bx + badgeW / 2, by + badgeH / 2);

  // Nombre
  ctx.font = "bold 28px Sans";
  ctx.textAlign = "center";

  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = 7;
  ctx.strokeText(name, x, y + 110);

  ctx.fillStyle = "white";
  ctx.fillText(name, x, y + 110);
}

// =========================
// LEGACY PLAYER DRAW
// =========================
async function drawLegacyPlayer(ctx, player, x, y) {
  const avatar = await loadImageSafe(player.avatar);

  const size = 170;

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 18, 0, Math.PI * 2);
  ctx.fillStyle = "#00e676";
  ctx.fill();

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  ctx.font = "bold 30px Sans";
  ctx.textAlign = "center";

  ctx.strokeStyle = "black";
  ctx.lineWidth = 8;
  ctx.strokeText(player.name, x, y + 115);

  ctx.fillStyle = "white";
  ctx.fillText(player.name, x, y + 115);

  ctx.font = "22px Sans";
  ctx.strokeText(player.style, x, y + 145);
  ctx.fillText(player.style, x, y + 145);
}

// =========================
// API
// =========================
app.get("/formation", async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const isFive = type === "5" || type === "5v5";

    const activePositions = getFormation(type);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    let stadium = safeDecode(req.query.stadium);
    let bg = null;

    if (stadium && stadium !== "0" && stadium !== "?") {
      bg = await loadImageSafe(stadium);
    }

    if (!bg && isFive) {
      bg = await loadImageSafe(DEFAULT_5V5_BG);
    }

    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      if (!isFive) drawFieldLines(ctx);
    }

    for (const pos of activePositions) {
      const player = {
        avatar: safeDecode(req.query[pos + "Avatar"]) || DEFAULT_AVATAR,
        name: safeDecode(req.query[pos + "Name"]) || "?",
        style: safeDecode(req.query[pos + "Style"]) || "?"
      };

      const { x, y } = getPositionCoords(pos, type);

      if (isFive) {
        await drawFiveVFivePlayer(ctx, player, x, y);
      } else {
        await drawLegacyPlayer(ctx, player, x, y);
      }
    }

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generando imagen");
  }
});

app.listen(PORT, () => {
  console.log("API estadio PRO lista 🏟️🔥");
});