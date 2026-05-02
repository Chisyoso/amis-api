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
  try { return decodeURIComponent(v || ""); }
  catch { return v || ""; }
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
  const hue = h % 360;
  return {
    fill: `hsla(${hue}, 85%, 60%, 0.22)`,
    stroke: `hsla(${hue}, 90%, 70%, 0.55)`,
    text: `white`,
    glow: `hsla(${hue}, 90%, 65%, 0.28)`
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
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(await res.buffer());
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

  if (t === "3") return ["rw","cf","lw"];
  if (t === "4") return ["rw","cf","lw","gk"];
  if (t === "5") return ["cf","rw","cm","lw","gk"];
  if (t === "8") return ["rw","drw","cf","dcf","lw","dlw","cm","gk"];

  return ["cf","rw","cm","lw","gk"];
}

// =========================
// 🔥 COORDENADAS CORRECTAS (LO IMPORTANTE)
// =========================
function getPositionCoords(pos, type) {

  // 🔥 SWAPS
  if (pos === "rw") pos = "gk";
  else if (pos === "gk") pos = "rw";

  if (pos === "cf") pos = "lw";
  else if (pos === "lw") pos = "cf";

  // =========================
  // VERTICAL REAL (CORREGIDO)
  // =========================

  // 🔥 ARRIBA
  if (pos === "lw") return { x: WIDTH / 2, y: 145 };

  // 🔥 MEDIO
  if (pos === "cm") return { x: WIDTH / 2, y: 430 };

  // 🔥 ABAJO (CF AHORA AQUÍ)
  if (pos === "cf") return { x: WIDTH / 2, y: 735 };

  // 🔥 LATERALES (MÁS CENTRADOS)
  if (pos === "rw") return { x: WIDTH - 400, y: HEIGHT / 2 };
  if (pos === "gk") return { x: 400, y: HEIGHT / 2 };

  // 🔥 DUPLICADOS (8v8)
  if (pos === "drw") return { x: WIDTH - 550, y: HEIGHT / 2 };
  if (pos === "dcf") return { x: WIDTH / 2, y: 300 };
  if (pos === "dlw") return { x: WIDTH / 2, y: HEIGHT - 300 };

  return { x: WIDTH / 2, y: HEIGHT / 2 };
}

// =========================
// JUGADOR
// =========================
async function drawPlayer(ctx, player, x, y) {

  const size = 170;
  const palette = paletteFromSeed(player.name + player.style);

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 20;

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 12, 0, Math.PI * 2);
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.restore();

  const avatar = await loadImageSafe(player.avatar);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + size / 2 + 15, 60, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // badge
  roundedRect(ctx, x + 40, y + 20, 110, 45, 12);
  ctx.fillStyle = palette.fill;
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "bold 20px Sans";
  ctx.fillText(player.style, x + 95, y + 50);

  ctx.font = "bold 28px Sans";
  ctx.textAlign = "center";
  ctx.fillText(player.name, x, y + 110);
}

// =========================
// API
// =========================
app.get("/formation", async (req, res) => {
  try {

    const type = normalizeType(req.query.type);
    const positions = getFormation(type);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // 🔥 FONDO SIEMPRE IMAGEN
    let stadium = safeDecode(req.query.stadium);
    let bg = null;

    if (stadium && stadium !== "0" && stadium !== "?") {
      bg = await loadImageSafe(stadium);
    }

    if (!bg) {
      bg = await loadImageSafe(DEFAULT_5V5_BG);
    }

    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    }

    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // jugadores
    for (const pos of positions) {

      const player = {
        avatar: safeDecode(req.query[pos + "Avatar"]) || DEFAULT_AVATAR,
        name: safeDecode(req.query[pos + "Name"]) || "?",
        style: safeDecode(req.query[pos + "Style"]) || "?"
      };

      const { x, y } = getPositionCoords(pos, type);
      await drawPlayer(ctx, player, x, y);
    }

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());

  } catch (err) {
    console.log(err);
    res.status(500).send("Error generando imagen");
  }
});

app.listen(PORT, () => console.log("API estadio PRO lista 🏟️🔥"));