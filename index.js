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
  try { return decodeURIComponent(v || ""); } catch { return v || ""; }
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
    fill: `hsla(${hue}, 85%, 60%, 0.18)`,
    stroke: `hsla(${hue}, 90%, 70%, 0.5)`,
    text: `white`,
    glow: `hsla(${hue}, 90%, 65%, 0.25)`
  };
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
function getFormation(type) {
  if (type == "3") return ["cf","cm","gk"];
  if (type == "4") return ["cf","rw","lw","gk"];
  if (type == "5") return ["cf","rw","cm","lw","gk"];
  if (type == "8") return ["cf","dcf","rw","drw","lw","dlw","cm","gk"];
  return ["cf","rw","cm","lw","gk"];
}

// =========================
// POSICIONES (VERTICAL REAL)
// =========================
function getPositionCoords(pos) {

  // 🔥 SWAPS
  if (pos === "rw") pos = "gk";
  else if (pos === "gk") pos = "rw";

  if (pos === "cf") pos = "lw";
  else if (pos === "lw") pos = "cf";

  // =========================
  // BASE VERTICAL
  // =========================
  if (pos === "cf") return { x: WIDTH / 2, y: 140 };
  if (pos === "rw") return { x: WIDTH - 260, y: HEIGHT / 2 };
  if (pos === "lw") return { x: WIDTH / 2, y: HEIGHT - 160 };
  if (pos === "cm") return { x: WIDTH / 2, y: HEIGHT / 2 };
  if (pos === "gk") return { x: 260, y: HEIGHT / 2 };

  // =========================
  // DUPLICADOS (8v8)
  // =========================
  if (pos === "drw") return { x: WIDTH - 420, y: HEIGHT / 2 };
  if (pos === "dcf") return { x: WIDTH / 2, y: 280 };
  if (pos === "dlw") return { x: WIDTH / 2, y: HEIGHT - 320 };

  return { x: WIDTH / 2, y: HEIGHT / 2 };
}

// =========================
// JUGADOR NUEVO
// =========================
async function drawPlayer(ctx, player, x, y) {

  const size = 150; // 🔥 MÁS PEQUEÑO

  const palette = paletteFromSeed(player.name + player.style);

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 12, 0, Math.PI * 2);
  ctx.fillStyle = palette.fill;
  ctx.fill();

  const avatar = await loadImageSafe(player.avatar);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  // estilo badge
  ctx.fillStyle = palette.stroke;
  ctx.fillRect(x + 50, y + 10, 80, 40);

  ctx.fillStyle = "white";
  ctx.font = "20px Sans";
  ctx.fillText(player.style, x + 90, y + 35);

  // nombre
  ctx.font = "bold 26px Sans";
  ctx.textAlign = "center";
  ctx.fillText(player.name, x, y + 100);
}

// =========================
// API
// =========================
app.get("/formation", async (req, res) => {
  try {

    const type = req.query.type || "5";
    const positions = getFormation(type);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // =========================
    // FONDO SIEMPRE IMAGEN
    // =========================
    let stadium = safeDecode(req.query.stadium);
    let bg = null;

    if (stadium && stadium !== "0") {
      bg = await loadImageSafe(stadium);
    }

    if (!bg) {
      bg = await loadImageSafe(DEFAULT_5V5_BG);
    }

    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    }

    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    // =========================
    // JUGADORES
    // =========================
    for (const pos of positions) {

      const player = {
        avatar: safeDecode(req.query[pos + "Avatar"]) || DEFAULT_AVATAR,
        name: safeDecode(req.query[pos + "Name"]) || "?",
        style: safeDecode(req.query[pos + "Style"]) || "?"
      };

      const { x, y } = getPositionCoords(pos);

      await drawPlayer(ctx, player, x, y);
    }

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());

  } catch (e) {
    console.log(e);
    res.status(500).send("error");
  }
});

app.listen(PORT, () => console.log("API lista"));