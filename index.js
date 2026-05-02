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
    fill: `hsla(${hue1}, 85%, 60%, 0.22)`,
    stroke: `hsla(${hue1}, 90%, 70%, 0.55)`,
    text: `hsla(${hue2}, 100%, 96%, 0.98)`,
    glow: `hsla(${hue1}, 90%, 65%, 0.28)`
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
  return String(type || "8").toLowerCase();
}

function getFormation(type) {
  const t = normalizeType(type);

  if (t === "3" || t === "3v3") return ["rw", "cf", "lw"];
  if (t === "4" || t === "4v4") return ["rw", "cf", "lw", "gk"];
  if (t === "5" || t === "5v5") return ["cf", "rw", "cm", "lw", "gk"];
  if (t === "8" || t === "8v8") return ["rw", "drw", "cf", "dcf", "lw", "dlw", "cm", "gk"];

  return ["rw", "cf", "cm", "gk", "lw"];
}

// =========================
// COORDENADAS
// =========================
function getPositionCoords(pos, type) {
  const t = normalizeType(type);

  // 5v5: muy cerca, estilo tarjeta/close-up
  if (t === "5" || t === "5v5") {
    if (pos === "cf") return { x: WIDTH / 2, y: 145 };
    if (pos === "rw") return { x: 340, y: 360 };
    if (pos === "cm") return { x: WIDTH / 2, y: 430 };
    if (pos === "lw") return { x: WIDTH / 2, y: 735 };
    if (pos === "gk") return { x: WIDTH - 250, y: 365 };

    if (pos.startsWith("rw")) {
      const n = parseInt(pos.replace("rw", "")) || 1;
      return { x: WIDTH / 2 + (n - 1) * 190 - 80, y: 160 };
    }

    if (pos.startsWith("cf")) {
      const n = parseInt(pos.replace("cf", "")) || 1;
      return { x: WIDTH / 2, y: 160 + (n - 1) * 120 };
    }

    if (pos.startsWith("lw")) {
      const n = parseInt(pos.replace("lw", "")) || 1;
      return { x: WIDTH / 2 + (n - 1) * 190 - 80, y: HEIGHT - 250 };
    }

    return { x: WIDTH / 2, y: HEIGHT / 2 };
  }

  // 8v8 y demás: mantener sistema actual
  if (pos === "rw") return { x: WIDTH / 2 - 110, y: 120 };
  if (pos === "drw") return { x: WIDTH / 2 + 110, y: 120 };

  if (pos === "cf") return { x: 250, y: HEIGHT / 2 - 120 };
  if (pos === "dcf") return { x: 250, y: HEIGHT / 2 + 120 };

  if (pos === "lw") return { x: WIDTH / 2 - 110, y: HEIGHT - 160 };
  if (pos === "dlw") return { x: WIDTH / 2 + 110, y: HEIGHT - 160 };

  if (pos.startsWith("rw")) {
    const n = parseInt(pos.replace("rw", "")) || 1;
    return { x: WIDTH / 2 + (n - 1) * 220 - 110, y: 120 };
  }

  if (pos.startsWith("cf")) {
    const n = parseInt(pos.replace("cf", "")) || 1;
    return { x: 250, y: HEIGHT / 2 + (n - 1) * 160 - 80 };
  }

  if (pos.startsWith("lw")) {
    const n = parseInt(pos.replace("lw", "")) || 1;
    return { x: WIDTH / 2 + (n - 1) * 220 - 110, y: HEIGHT - 160 };
  }

  return { x: WIDTH / 2, y: HEIGHT / 2 };
}

// =========================
// CANCHA / ESTADIO LEGACY
// =========================
function drawFieldLines(ctx) {
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;

  // área grande
  ctx.strokeRect(WIDTH - 350, 100, 300, HEIGHT - 200);

  // área chica
  ctx.strokeRect(WIDTH - 200, HEIGHT / 2 - 120, 150, 240);

  // punto penal
  ctx.beginPath();
  ctx.arc(WIDTH - 260, HEIGHT / 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  // media luna
  ctx.beginPath();
  ctx.arc(WIDTH - 300, HEIGHT / 2, 120, 0.7 * Math.PI, 1.3 * Math.PI);
  ctx.stroke();

  // portería
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(WIDTH - 40, HEIGHT / 2 - 150, 20, 300);

  // línea lateral
  ctx.beginPath();
  ctx.moveTo(WIDTH - 350, 100);
  ctx.lineTo(WIDTH - 350, HEIGHT - 100);
  ctx.stroke();
}

function drawFallback5v5Pitch(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#1f6d22");
  bg.addColorStop(1, "#16581d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < WIDTH; i += 90) {
    ctx.fillStyle = i % 180 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(i, 0, 90, HEIGHT);
  }

  // líneas simples, suaves
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.roundRect(70, 70, WIDTH - 140, HEIGHT - 140, 32);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 70);
  ctx.lineTo(WIDTH / 2, HEIGHT - 70);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, 110, 0, Math.PI * 2);
  ctx.stroke();

  // área derecha (estilo imagen de ejemplo)
  ctx.strokeRect(WIDTH - 220, HEIGHT / 2 - 150, 130, 300);
  ctx.strokeRect(WIDTH - 110, HEIGHT / 2 - 90, 40, 180);
}

// =========================
// DISEÑO 5v5
// =========================
async function drawFiveVFivePlayer(ctx, player, x, y) {
  const avatarURL = player.avatar || DEFAULT_AVATAR;
  const name = player.name || "?";
  const style = player.style || "?";

  const size = 220;
  const palette = paletteFromSeed(`${name}|${style}|${avatarURL}`);

  // glow suave
  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 28;

  // anillo externo translúcido
  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 18, 0, Math.PI * 2);
  ctx.fillStyle = palette.fill;
  ctx.fill();

  // borde
  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 12, 0, Math.PI * 2);
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 6;
  ctx.stroke();
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

  // sombra inferior
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y + size / 2 + 20, 70, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // badge de style, reemplaza el 9.9
  const badgeText = style === "?" ? "?" : style;
  const badgeW = Math.max(120, Math.min(260, badgeText.length * 18 + 42));
  const badgeH = 58;

  const badgeOnRight = x < WIDTH / 2 + 80;
  const bx = badgeOnRight ? x + size / 2 - 6 : x - size / 2 - badgeW + 6;
  const by = y + 42;

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 18;
  roundedRect(ctx, bx, by, badgeW, badgeH, 18);
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = palette.stroke;
  ctx.stroke();
  ctx.restore();

  ctx.font = "bold 26px Sans";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.text;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 5;
  ctx.strokeText(badgeText, bx + badgeW / 2, by + badgeH / 2 + 1);
  ctx.fillText(badgeText, bx + badgeW / 2, by + badgeH / 2 + 1);

  // nombre abajo
  ctx.font = "bold 34px Sans";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.fillStyle = "white";
  ctx.lineWidth = 8;
  ctx.strokeText(name, x, y + 148);
  ctx.fillText(name, x, y + 148);
}

// =========================
// DISEÑO LEGACY
// =========================
async function drawLegacyPlayer(ctx, player, x, y) {
  const avatarURL = player.avatar || DEFAULT_AVATAR;
  const name = player.name || "?";
  const style = player.style || "?";

  const size = 170;

  let statusColor = "#ff5252";
  if (name !== "?" || avatarURL !== DEFAULT_AVATAR) {
    statusColor = "#00e676";
  } else if (style !== "?") {
    statusColor = "#ffd600";
  }

  ctx.beginPath();
  ctx.arc(x, y, size / 2 + 18, 0, Math.PI * 2);
  ctx.fillStyle = statusColor;
  ctx.fill();

  const avatar = await loadImageSafe(avatarURL);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + size / 2, 60, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // texto
  ctx.textAlign = "center";
  ctx.strokeStyle = "black";
  ctx.fillStyle = "white";
  ctx.lineWidth = 8;

  ctx.font = "bold 30px Sans";
  ctx.strokeText(name, x, y + 115);
  ctx.fillText(name, x, y + 115);

  ctx.font = "22px Sans";
  ctx.strokeText(style, x, y + 145);
  ctx.fillText(style, x, y + 145);
}

// =========================
// API
// =========================
app.get("/formation", async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    let activePositions = getFormation(type);

    Object.keys(req.query).forEach((key) => {
      const match = key.match(/(rw|cf|lw)[0-9]+Name/);
      if (match) {
        const pos = match[1] + key.match(/[0-9]+/)[0];
        if (!activePositions.includes(pos)) activePositions.push(pos);
      }
    });

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // =========================
    // FONDO
    // =========================
    let stadium = safeDecode(req.query.stadium);
    let bg = null;

    const isFive = type === "5" || type === "5v5";

    if (isFive) {
      if (stadium && stadium !== "0" && stadium !== "?") {
        bg = await loadImageSafe(stadium);
      }
      if (!bg) {
        bg = await loadImageSafe(DEFAULT_5V5_BG);
      }

      if (bg) {
        ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
      } else {
        drawFallback5v5Pitch(ctx);
      }

      // overlay muy suave para que se vea el fondo
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      if (stadium && stadium !== "0" && stadium !== "?") {
        bg = await loadImageSafe(stadium);
      }

      if (bg) {
        ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        grad.addColorStop(0, "#3a9d23");
        grad.addColorStop(1, "#2e7d32");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        for (let i = 0; i < WIDTH; i += 80) {
          ctx.fillStyle = i % 160 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
          ctx.fillRect(i, 0, 80, HEIGHT);
        }
      }

      drawFieldLines(ctx);
    }

    // =========================
    // JUGADORES
    // =========================
    for (const pos of activePositions) {
      const baseKey = pos.replace(/[0-9]/g, "");

      const avatarURL =
        safeDecode(req.query[pos + "Avatar"]) ||
        safeDecode(req.query[baseKey + "Avatar"]);

      const name =
        safeDecode(req.query[pos + "Name"]) ||
        safeDecode(req.query[baseKey + "Name"]);

      const style =
        safeDecode(req.query[pos + "Style"]) ||
        safeDecode(req.query[baseKey + "Style"]);

      const player = {
        avatar: !avatarURL || avatarURL === "?" ? DEFAULT_AVATAR : avatarURL,
        name: name || "?",
        style: style || "?"
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
    console.log(err);
    res.status(500).send("Error generando imagen");
  }
});

app.listen(PORT, () => console.log("API estadio PRO lista 🏟️🔥"));