const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

const DEFAULT_AVATAR = "https://i.imgur.com/5hxFpJV.png";
const DEFAULT_STADIUM = "0";

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
  return ["rw","cf","cm","gk","lw"];
}

// =========================
// POSICIONES DINÁMICAS
// =========================
function getPositionCoords(pos) {

  if (pos === "rw") return { x: WIDTH / 2 - 110, y: 120 };
  if (pos === "drw") return { x: WIDTH / 2 + 110, y: 120 };

  if (pos === "cf") return { x: 250, y: HEIGHT / 2 - 120 };
  if (pos === "dcf") return { x: 250, y: HEIGHT / 2 + 120 };

  if (pos === "lw") return { x: WIDTH / 2 - 110, y: HEIGHT - 160 };
  if (pos === "dlw") return { x: WIDTH / 2 + 110, y: HEIGHT - 160 };

  if (pos.startsWith("rw")) {
    let n = parseInt(pos.replace("rw","")) || 1;
    return { x: WIDTH / 2 + (n-1)*220 - 110, y: 120 };
  }

  if (pos.startsWith("cf")) {
    let n = parseInt(pos.replace("cf","")) || 1;
    return { x: 250, y: HEIGHT / 2 + (n-1)*160 - 80 };
  }

  if (pos.startsWith("lw")) {
    let n = parseInt(pos.replace("lw","")) || 1;
    return { x: WIDTH / 2 + (n-1)*220 - 110, y: HEIGHT - 160 };
  }

  return basePositions[pos] || { x: WIDTH/2, y: HEIGHT/2 };
}

async function loadAvatar(url) {
  try {
    const res = await fetch(url);
    const buffer = await res.buffer();
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function decode(v) {
  return decodeURIComponent(v || "");
}

// =========================
// API
// =========================
app.get("/formation", async (req, res) => {
  try {

    const type = req.query.type;
    let activePositions = getFormation(type);

    Object.keys(req.query).forEach(key => {
      let match = key.match(/(rw|cf|lw)[0-9]+Name/);
      if (match) {
        let pos = match[1] + key.match(/[0-9]+/)[0];
        if (!activePositions.includes(pos)) {
          activePositions.push(pos);
        }
      }
    });

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // =========================
    // 🏟️ ESTADIO
    // =========================
    let stadium = decode(req.query.stadium) || DEFAULT_STADIUM;

    if (stadium !== "0" && stadium !== "?") {
      const bg = await loadAvatar(stadium);
      if (bg) {
        ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
      }
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      grad.addColorStop(0, "#3a9d23");
      grad.addColorStop(1, "#2e7d32");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      for (let i = 0; i < WIDTH; i += 80) {
        ctx.fillStyle =
          i % 160 === 0
            ? "rgba(255,255,255,0.04)"
            : "rgba(0,0,0,0.04)";
        ctx.fillRect(i, 0, 80, HEIGHT);
      }

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

      ctx.beginPath();
      ctx.moveTo(WIDTH - 350, 100);
      ctx.lineTo(WIDTH - 350, HEIGHT - 100);
      ctx.stroke();
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

      const avatar = await loadAvatar(avatarURL);
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
      ctx.ellipse(x, y + size / 2, 60, 18, 0, 0, Math.PI * 2);
      ctx.fill();

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

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());

  } catch (err) {
    console.log(err);
    res.status(500).send("Error generando imagen");
  }
});

app.listen(PORT, () => console.log("API estadio PRO lista 🏟️🔥"));