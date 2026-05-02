const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

const DEFAULT_AVATAR = "https://i.imgur.com/4jduEyb.png";
const NEW_BG_5V5 = "https://i.imgur.com/dRSz8QM.png";

const app = express();
const PORT = process.env.PORT || 3000;

const WIDTH = 1600;
const HEIGHT = 1000;

// =========================
// POSICIONES BASE
// =========================
const basePositions = {
  rw: { x: WIDTH / 2, y: 120 },
  cf: { x: 250, y: HEIGHT / 2 },
  cm: { x: WIDTH / 2, y: HEIGHT / 2 },
  gk: { x: WIDTH - 220, y: HEIGHT / 2 },
  lw: { x: WIDTH / 2, y: HEIGHT - 160 }
};

// =========================
// FORMACIONES
// =========================
function getFormation(type) {
  if (type === "3") return ["rw", "cf", "lw"];
  if (type === "4") return ["rw", "cf", "lw", "gk"];
  if (type === "8") return ["rw","drw","cf","dcf","lw","dlw","cm","gk"];
  return ["rw","cf","cm","gk","lw"]; // 5v5
}

// =========================
// POSICIONES
// =========================
function getPositionCoords(pos) {

  if (pos === "rw") return { x: WIDTH / 2 - 110, y: 120 };
  if (pos === "drw") return { x: WIDTH / 2 + 110, y: 120 };

  if (pos === "cf") return { x: 250, y: HEIGHT / 2 - 120 };
  if (pos === "dcf") return { x: 250, y: HEIGHT / 2 + 120 };

  if (pos === "lw") return { x: WIDTH / 2 - 110, y: HEIGHT - 160 };
  if (pos === "dlw") return { x: WIDTH / 2 + 110, y: HEIGHT - 160 };

  return basePositions[pos] || { x: WIDTH/2, y: HEIGHT/2 };
}

// =========================
// UTIL
// =========================
async function loadImageSafe(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
    if (!res.ok) throw new Error();
    const buffer = await res.buffer();
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function decode(v) {
  return decodeURIComponent(v || "");
}

function randomColor() {
  const colors = [
    "rgba(0,255,200,0.8)",
    "rgba(0,150,255,0.8)",
    "rgba(255,80,80,0.8)",
    "rgba(255,200,0,0.8)",
    "rgba(180,0,255,0.8)"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// =========================
// DIBUJAR PLAYER NUEVO (5v5)
// =========================
async function drawPlayerCard(ctx, x, y, avatarURL, name, style) {

  const size = 150;
  const avatar = await loadImageSafe(avatarURL);

  // círculo avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, size/2, 0, Math.PI*2);
  ctx.clip();

  if (avatar) {
    ctx.drawImage(avatar, x - size/2, y - size/2, size, size);
  }

  ctx.restore();

  // borde suave
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, size/2, 0, Math.PI*2);
  ctx.stroke();

  // barra nombre (transparente)
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x - 80, y + 70, 160, 35);

  ctx.font = "bold 20px Sans";
  ctx.textAlign = "center";
  ctx.fillStyle = "white";
  ctx.fillText(name, x, y + 95);

  // badge estilo
  ctx.fillStyle = randomColor();
  ctx.fillRect(x + 50, y - 20, 70, 35);

  ctx.fillStyle = "white";
  ctx.font = "bold 16px Sans";
  ctx.fillText(style, x + 85, y + 5);
}

// =========================
// API
// =========================
app.get("/formation", async (req, res) => {
  try {

    const type = req.query.type;
    let activePositions = getFormation(type);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // =========================
    // FONDO
    // =========================
    let bg = null;

    // 🔥 SI ES 5v5 → NUEVO DISEÑO
    if (type == "5") {
      bg = await loadImageSafe(NEW_BG_5V5);
    } else {
      let stadium = decode(req.query.stadium);
      if (stadium && stadium !== "0" && stadium !== "?") {
        bg = await loadImageSafe(stadium);
      }
    }

    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = "#2e7d32";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // =========================
    // JUGADORES
    // =========================
    for (const pos of activePositions) {

      let baseKey = pos.replace(/[0-9]/g, "");

      let avatarURL = decode(req.query[pos + "Avatar"]) || decode(req.query[baseKey + "Avatar"]);
      let name = decode(req.query[pos + "Name"]) || decode(req.query[baseKey + "Name"]);
      let style = decode(req.query[pos + "Style"]) || decode(req.query[baseKey + "Style"]);

      if (!name) name = "?";
      if (!style) style = "?";
      if (!avatarURL || avatarURL === "?") avatarURL = DEFAULT_AVATAR;

      const { x, y } = getPositionCoords(pos);

      if (type == "5") {
        await drawPlayerCard(ctx, x, y, avatarURL, name, style);
      } else {
        // diseño viejo
        const size = 170;

        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = "#00e676";
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

        ctx.fillStyle = "white";
        ctx.font = "bold 24px Sans";
        ctx.textAlign = "center";
        ctx.fillText(name, x, y + 110);
      }
    }

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());

  } catch (err) {
    console.log(err);
    res.status(500).send("Error generando imagen");
  }
});

app.listen(PORT, () => console.log("API estadio PRO lista 🏟️🔥"));