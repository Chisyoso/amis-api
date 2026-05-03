const express = require("express");
const { createCanvas, loadImage, registerFont } = require("canvas");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

const WIDTH = 1600;
const HEIGHT = 1000;

registerFont(path.join(__dirname, "assets/fonts/Poppins-Bold.ttf"), { family: "PoppinsBold" });
registerFont(path.join(__dirname, "assets/fonts/Poppins-Regular.ttf"), { family: "Poppins" });

const DEFAULT_AVATAR = path.join(__dirname, "assets/avatar.png");
const DEFAULT_5V5_BG = path.join(__dirname, "assets/bg.png");

const imageCache = new Map();

async function loadImageSafe(src) {
  if (!src) return null;
  if (imageCache.has(src)) return imageCache.get(src);

  try {
    let img;

    if (!src.startsWith("http")) {
      if (!fs.existsSync(src)) return null;
      img = await loadImage(src);
    } else {
      const res = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } });
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
    glow: `hsla(${hue1},90%,65%,0.35)`,
    strong: `hsl(${hue1},85%,60%)`
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

function getPositionCoords(pos, type) {
  const t = normalizeType(type);

  if (t === "5" || t === "5v5") {
    if (pos === "cf") return { x: 800, y: 165 };
    if (pos === "rw") return { x: 1300, y: 420 };
    if (pos === "cm") return { x: 800, y: 470 };
    if (pos === "lw") return { x: 370, y: 420 };
    if (pos === "gk") return { x: 800, y: 820 };
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

function drawFieldLines(ctx) {
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;
  ctx.strokeRect(WIDTH - 350, 100, 300, HEIGHT - 200);
  ctx.strokeRect(WIDTH - 200, HEIGHT / 2 - 120, 150, 240);

  ctx.beginPath();
  ctx.arc(WIDTH - 260, HEIGHT / 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
}

async function drawFiveVFivePlayer(ctx, player, x, y) {
  const avatarURL = player.avatar || DEFAULT_AVATAR;
  const nameRaw = player.name || "?";
  const styleRaw = player.style || "?";

  const size = 150;
  const palette = paletteFromSeed(`${nameRaw}|${styleRaw}|${avatarURL}`);

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 30;

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
  ctx.arc(x, y, size / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = palette.strong;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 10, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 24px PoppinsBold";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const style = truncateText(ctx, styleRaw, 140);

  const boxW = Math.max(110, ctx.measureText(style).width + 40);
  const boxH = 60;

  const bx = x + size / 2 - 10;
  const by = y - 40;

  const grad = ctx.createLinearGradient(bx, by, bx, by + boxH);
  grad.addColorStop(0, palette.strong);
  grad.addColorStop(1, "#000");

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 20;

  roundedRect(ctx, bx, by, boxW, boxH, 14);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.fillText(style, bx + boxW / 2, by + boxH / 2);

  ctx.font = "bold 28px PoppinsBold";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const name = truncateText(ctx, nameRaw, 260);

  const nameW = ctx.measureText(name).width + 40;
  const nameH = 50;

  const nx = x - nameW / 2;
  const ny = y + size / 2 + 20;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundedRect(ctx, nx, ny, nameW, nameH, 14);
  ctx.fill();

  ctx.strokeStyle = palette.strong;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.fillText(name, x, ny + nameH / 2);
}

app.get("/formation", async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const isFive = type === "5" || type === "5v5";

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    let bg = await loadImageSafe(safeDecode(req.query.stadium));
    if (!bg) bg = await loadImageSafe(DEFAULT_5V5_BG);

    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      if (!isFive) drawFieldLines(ctx);
    }

    const positions = getFormation(type);

    await Promise.all(positions.map(async (pos) => {
      const player = {
        avatar: safeDecode(req.query[pos + "Avatar"]),
        name: safeDecode(req.query[pos + "Name"]),
        style: safeDecode(req.query[pos + "Style"])
      };

      const { x, y } = getPositionCoords(pos, type);
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