const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

const DEFAULT_AVATAR = "https://i.imgur.com/5hxFpJV.png";

const app = express();
const PORT = process.env.PORT || 3000;

const WIDTH = 1600;
const HEIGHT = 1000;

const positions = {
  rw: { x: WIDTH / 2, y: 120 },
  cf: { x: 250, y: HEIGHT / 2 },
  cm: { x: WIDTH / 2, y: HEIGHT / 2 },
  gk: { x: WIDTH - 220, y: HEIGHT / 2 },
  lw: { x: WIDTH / 2, y: HEIGHT - 160 }
};

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

app.get("/formation", async (req, res) => {
  try {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // =========================
    // CÉSPED
    // =========================
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, "#3a9d23");
    grad.addColorStop(1, "#2e7d32");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // rayas verticales
    for (let i = 0; i < WIDTH; i += 80) {
      ctx.fillStyle =
        i % 160 === 0
          ? "rgba(255,255,255,0.04)"
          : "rgba(0,0,0,0.04)";
      ctx.fillRect(i, 0, 80, HEIGHT);
    }

    ctx.strokeStyle = "white";
    ctx.lineWidth = 5;

    // área derecha
    ctx.strokeRect(WIDTH - 350, 100, 300, HEIGHT - 200);
    ctx.strokeRect(WIDTH - 200, HEIGHT / 2 - 120, 150, 240);

    ctx.beginPath();
    ctx.arc(WIDTH - 260, HEIGHT / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(WIDTH - 300, HEIGHT / 2, 120, 0.7 * Math.PI, 1.3 * Math.PI);
    ctx.stroke();

    // portería
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(WIDTH - 40, HEIGHT / 2 - 150, 20, 300);

    // =========================
    // LINEAS DE SAQUE
    // =========================
    ctx.beginPath();
    ctx.moveTo(WIDTH - 350, 100);
    ctx.lineTo(WIDTH - 350, HEIGHT - 100);
    ctx.stroke();

    // =========================
    // JUGADORES
    // =========================
    for (const pos in positions) {
      let avatarURL = decode(req.query[pos + "Avatar"]);
      let name = decode(req.query[pos + "Name"]);
      let style = decode(req.query[pos + "Style"]);

      if (!name) name = "?";
      if (!style) style = "?";

      if (!avatarURL || avatarURL === "?") avatarURL = DEFAULT_AVATAR;

      const avatar = await loadAvatar(avatarURL);
      if (!avatar) continue;

      const { x, y } = positions[pos];
      const size = 170;

      // =====================
      // ESTADO COLOR
      // =====================
      let statusColor = "red";

      if (
        avatarURL !== DEFAULT_AVATAR ||
        name !== "?"
      ) {
        statusColor = "green";
      } else if (style !== "?") {
        statusColor = "yellow";
      }

      // sombra
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(x, y + size / 2, 60, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // avatar
      ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);

      // =====================
      // CÍRCULO PRO
      // =====================
      ctx.beginPath();
      ctx.arc(x, y + size / 2 + 35, 22, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = "white";
      ctx.stroke();

      // textos
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