const express = require("express");
const compression = require("compression");
const { createCanvas, loadImage, registerFont } = require("canvas");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { LRUCache } = require("lru-cache");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(compression());

const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 750;
const SCALE = TARGET_WIDTH / 1600;

const assetCache = new LRUCache({ max: 30, ttl: 1000 * 60 * 10 });
const responseCache = new LRUCache({ max: 15, ttl: 1000 * 60 * 5 });

registerFont(path.join(__dirname, "assets/fonts/Poppins-Bold.ttf"), { family: "PoppinsBold" });
registerFont(path.join(__dirname, "assets/fonts/Poppins-Regular.ttf"), { family: "Poppins" });

const DEFAULT_AVATAR = path.join(__dirname, "assets/avatar.png");
const DEFAULT_5V5_BG = path.join(__dirname, "assets/bg.png");

const MAX_FILE_SIZE = 2 * 1024 * 1024;

async function loadImageSafe(src) {
  if (!src) return null;
  if (assetCache.has(src)) return assetCache.get(src);

  try {
    let img;
    if (!src.startsWith("http")) {
      if (!fs.existsSync(src)) return null;
      img = await loadImage(src);
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(src, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) return null;

      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
        console.warn(`[Bloqueado] Imagen superó el límite de 2MB: ${src}`);
        return null;
      }

      const buffer = await res.buffer();

      if (buffer.length > MAX_FILE_SIZE) return null;

      img = await loadImage(buffer);
    }

    assetCache.set(src, img);
    return img;
  } catch (err) {
    return null;
  }
}

function safeDecode(v) {
  if (!v) return "";
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
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
  if (t === "3" || t === "3v3") return ["rw", "cf", "lw"];
  if (t === "4" || t === "4v4") return ["rw", "cf", "lw", "gk"];
  if (t === "5" || t === "5v5") return ["cf", "rw", "cm", "lw", "gk"];
  if (t === "8" || t === "8v8") return ["rw", "drw", "cf", "dcf", "lw", "dlw", "cm", "gk"];
  return ["cf", "rw", "cm", "lw", "gk"];
}

function getPositionCoords(pos, type) {
  const t = normalizeType(type);
  let coords = { x: 800, y: 500 };

  if (t === "5" || t === "5v5") {
    if (pos === "cf") coords = { x: 800, y: 165 };
    else if (pos === "rw") coords = { x: 1300, y: 420 };
    else if (pos === "cm") coords = { x: 800, y: 470 };
    else if (pos === "lw") coords = { x: 370, y: 420 };
    else if (pos === "gk") coords = { x: 800, y: 820 };
  } else {
    if (pos === "rw") coords = { x: 1600 / 2 - 110, y: 120 };
    else if (pos === "drw") coords = { x: 1600 / 2 + 110, y: 120 };
    else if (pos === "cf") coords = { x: 250, y: 1000 / 2 - 120 };
    else if (pos === "dcf") coords = { x: 250, y: 1000 / 2 + 120 };
    else if (pos === "lw") coords = { x: 1600 / 2 - 110, y: 1000 - 160 };
    else if (pos === "dlw") coords = { x: 1600 / 2 + 110, y: 1000 - 160 };
    else if (pos === "cm") coords = { x: 1600 / 2, y: 1000 / 2 };
    else if (pos === "gk") coords = { x: 1600 - 220, y: 1000 / 2 };
  }

  return { x: coords.x * SCALE, y: coords.y * SCALE };
}

function drawFieldLines(ctx) {
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5 * SCALE;
  ctx.strokeRect((1600 - 350) * SCALE, 100 * SCALE, 300 * SCALE, (1000 - 200) * SCALE);
  ctx.strokeRect((1600 - 200) * SCALE, (1000 / 2 - 120) * SCALE, 150 * SCALE, 240 * SCALE);
  ctx.beginPath();
  ctx.arc((1600 - 260) * SCALE, (1000 / 2) * SCALE, 6 * SCALE, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
}

function getFirstQuery(reqQuery, keys) {
  for (const key of keys) {
    if (reqQuery[key] !== undefined && reqQuery[key] !== null && String(reqQuery[key]).trim() !== "") {
      return reqQuery[key];
    }
  }
  return "";
}

function drawContainImage(ctx, img, x, y, boxW, boxH) {
  const ratio = Math.min(boxW / img.width, boxH / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
}

function drawLevelBadge(ctx, x, y, levelValue) {
  const levelText = String(levelValue || "").trim();
  if (!levelText) return;

  ctx.save();
  ctx.font = `bold ${Math.round(18 * SCALE)}px PoppinsBold`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textW = ctx.measureText(levelText).width;
  const diameter = Math.max(34 * SCALE, Math.min(54 * SCALE, textW + 18 * SCALE));
  const r = diameter / 2;

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 10 * SCALE;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#15b84a";
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2 * SCALE;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.fillText(levelText, x, y + (1 * SCALE));
  ctx.restore();
}

async function drawFiveVFivePlayer(ctx, player, x, y) {
  const avatarURL = player.avatar || DEFAULT_AVATAR;
  const accessoryURL = player.accessory || "";
  const levelValue = player.level || "";
  const nameRaw = player.name || "?";
  const styleRaw = player.style || "?";
  const size = 150 * SCALE;
  const palette = paletteFromSeed(`${nameRaw}|${styleRaw}|${avatarURL}`);

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 30 * SCALE;
  ctx.beginPath();
  ctx.arc(x, y, size / 2 + (14 * SCALE), 0, Math.PI * 2);
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

  const accessory = await loadImageSafe(accessoryURL);
  if (accessory) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.clip();

    const overlaySize = size * 0.62;
    drawContainImage(ctx, accessory, x, y, overlaySize, overlaySize);

    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + (4 * SCALE), 0, Math.PI * 2);
  ctx.strokeStyle = palette.strong;
  ctx.lineWidth = 4 * SCALE;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + (10 * SCALE), 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2 * SCALE;
  ctx.stroke();

  drawLevelBadge(
    ctx,
    x + (size / 2) + (22 * SCALE),
    y + (size / 2) - (18 * SCALE),
    levelValue
  );

  ctx.font = `bold ${Math.round(24 * SCALE)}px PoppinsBold`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const style = truncateText(ctx, styleRaw, 140 * SCALE);
  const boxW = Math.max(110 * SCALE, ctx.measureText(style).width + (40 * SCALE));
  const boxH = 60 * SCALE;
  const bx = x + size / 2 - (10 * SCALE);
  const by = y - (40 * SCALE);

  const grad = ctx.createLinearGradient(bx, by, bx, by + boxH);
  grad.addColorStop(0, palette.strong);
  grad.addColorStop(1, "#000");

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 20 * SCALE;
  roundedRect(ctx, bx, by, boxW, boxH, 14 * SCALE);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2 * SCALE;
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.fillText(style, bx + boxW / 2, by + boxH / 2);

  ctx.font = `bold ${Math.round(28 * SCALE)}px PoppinsBold`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const name = truncateText(ctx, nameRaw, 260 * SCALE);
  const nameW = ctx.measureText(name).width + (40 * SCALE);
  const nameH = 50 * SCALE;
  const nx = x - nameW / 2;
  const ny = y + size / 2 + (20 * SCALE);

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundedRect(ctx, nx, ny, nameW, nameH, 14 * SCALE);
  ctx.fill();

  ctx.strokeStyle = palette.strong;
  ctx.lineWidth = 2 * SCALE;
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.fillText(name, x, ny + nameH / 2);
}

app.get("/formation", async (req, res) => {
  const cacheKey = JSON.stringify(req.query);
  if (responseCache.has(cacheKey)) {
    res.set("Content-Type", "image/webp");
    return res.send(responseCache.get(cacheKey));
  }

  try {
    const type = normalizeType(req.query.type);
    const isFive = type === "5" || type === "5v5";

    const canvas = createCanvas(TARGET_WIDTH, TARGET_HEIGHT);
    const ctx = canvas.getContext("2d");

    let bg = await loadImageSafe(safeDecode(req.query.stadium));
    if (!bg) bg = await loadImageSafe(DEFAULT_5V5_BG);

    if (bg) {
      ctx.drawImage(bg, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      if (!isFive) drawFieldLines(ctx);
    }

    const positions = getFormation(type);

    for (const pos of positions) {
      const player = {
        avatar: safeDecode(req.query[pos + "Avatar"]),
        accessory: safeDecode(
          getFirstQuery(req.query, [
            pos + "AvatarObjet",
            pos + "AvatarObjeto",
            pos + "AvatarObject",
            pos + "Objet",
            pos + "Objeto",
            pos + "Object"
          ])
        ),
        level: safeDecode(req.query[pos + "Level"]),
        name: safeDecode(req.query[pos + "Name"]),
        style: safeDecode(req.query[pos + "Style"])
      };

      const { x, y } = getPositionCoords(pos, type);
      await drawFiveVFivePlayer(ctx, player, x, y);
    }

    const webpBuffer = canvas.toBuffer("image/webp", { quality: 0.44 });
    responseCache.set(cacheKey, webpBuffer);

    res.set("Content-Type", "image/webp");
    res.send(webpBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generando imagen");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 VERSION PRO: Caching Seguro, Secuencial y Comprimido");
});