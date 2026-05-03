const express = require("express");
const { createCanvas, loadImage, registerFont } = require("canvas");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

const WIDTH = 1600;
const HEIGHT = 1000;

// 🔥 FUENTES PRO
registerFont(path.join(__dirname, "assets/fonts/Poppins-Bold.ttf"), { family: "PoppinsBold" });
registerFont(path.join(__dirname, "assets/fonts/Poppins-Regular.ttf"), { family: "Poppins" });

const DEFAULT_AVATAR = path.join(__dirname, "assets/avatar.png");
const DEFAULT_5V5_BG = path.join(__dirname, "assets/bg.png");

const imageCache = new Map();

// =========================
// LOAD ROBUSTO
// =========================
async function loadImageSafe(src) {
  if (!src) return null;

  if (imageCache.has(src)) return imageCache.get(src);

  try {
    let img;

    if (!src.startsWith("http")) {
      if (!fs.existsSync(src)) return null;
      img = await loadImage(src);
    } else {
      const res = await fetch(src);
      if (!res.ok) return null;
      const buffer = await res.buffer();
      img = await loadImage(buffer);
    }

    imageCache.set(src, img);
    return img;
  } catch {
    return null;
  }
}

// =========================
// UTILS
// =========================
function safeDecode(v) {
  if (!v) return "";
  try { return decodeURIComponent(v); } catch { return v; }
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  while (text.length > 0 && ctx.measureText(text + "...").width > maxWidth) {
    text = text.slice(0, -1);
  }
  return text + "...";
}

// =========================
// FORMATION
// =========================
function normalizeType(type) {
  return String(type || "5").toLowerCase();
}

function getFormation(type) {
  if (type === "5" || type === "5v5") return ["cf","rw","cm","lw","gk"];
  return ["cf","rw","cm","lw","gk"];
}

function getPositionCoords(pos) {
  if (pos === "cf") return { x: 800, y: 165 };
  if (pos === "rw") return { x: 1300, y: 420 };
  if (pos === "cm") return { x: 800, y: 470 };
  if (pos === "lw") return { x: 370, y: 420 };
  if (pos === "gk") return { x: 800, y: 820 };
}

// =========================
// PLAYER DRAW PRO
// =========================
async function drawFiveVFivePlayer(ctx, player, x, y) {
  const size = 150;
  const avatar = await loadImageSafe(player.avatar || DEFAULT_AVATAR);

  // AVATAR
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  // BORDE
  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 3, 0, Math.PI * 2);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;
  ctx.stroke();

  // =====================
  // STYLE BADGE (MEJORADO)
  // =====================
  ctx.font = "bold 22px PoppinsBold";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const style = truncateText(ctx, player.style || "?", 180);

  const badgeW = ctx.measureText(style).width + 40;
  const badgeH = 42;

  const bx = x + size / 2 + 10;
  const by = y - 10;

  // fondo badge
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.roundRect(bx, by, badgeW, badgeH, 12);
  ctx.fill();

  // texto style
  ctx.fillStyle = "#00ffcc";
  ctx.fillText(style, bx + badgeW / 2, by + badgeH / 2);

  // =====================
  // NAME (CENTRADO REAL)
  // =====================
  ctx.font = "bold 30px PoppinsBold";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  let name = truncateText(ctx, player.name || "?", 250);

  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillText(name, x + 2, y + size / 2 + 12);

  // texto
  ctx.fillStyle = "white";
  ctx.fillText(name, x, y + size / 2 + 10);
}

// =========================
// ENDPOINT
// =========================
app.get("/formation", async (req, res) => {
  try {
    const type = normalizeType(req.query.type);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    let bg = await loadImageSafe(safeDecode(req.query.stadium));

    if (!bg) bg = await loadImageSafe(DEFAULT_5V5_BG);

    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    const positions = getFormation(type);

    await Promise.all(positions.map(async (pos) => {
      const player = {
        avatar: safeDecode(req.query[pos + "Avatar"]),
        name: safeDecode(req.query[pos + "Name"]),
        style: safeDecode(req.query[pos + "Style"])
      };

      const { x, y } = getPositionCoords(pos);

      await drawFiveVFivePlayer(ctx, player, x, y);
    }));

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 VERSION PRO FINAL");
});