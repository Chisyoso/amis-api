const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// tamaño fijo para precisión
const WIDTH = 1600;
const HEIGHT = 1000;

// posiciones perfectamente simétricas
const positions = {
  rw: { x: WIDTH / 2, y: 120 },
  cf: { x: 250, y: HEIGHT / 2 },
  cm: { x: WIDTH / 2, y: HEIGHT / 2 },
  gk: { x: WIDTH - 250, y: HEIGHT / 2 },
  lw: { x: WIDTH / 2, y: HEIGHT - 120 }
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

app.get("/formation", async (req, res) => {
  try {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // fondo verde limpio
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // circulo central
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2, 120, 0, Math.PI * 2);
    ctx.stroke();

    for (const pos in positions) {
      const avatarURL = decodeURIComponent(req.query[pos + "Avatar"] || "");
      const name = decodeURIComponent(req.query[pos + "Name"] || "?");
      const style = decodeURIComponent(req.query[pos + "Style"] || "");

      if (!avatarURL || name === "?") continue;

      const avatar = await loadAvatar(avatarURL);
      if (!avatar) continue;

      const { x, y } = positions[pos];
      const size = 170;

      // avatar centrado
      ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);

      ctx.textAlign = "center";
      ctx.strokeStyle = "black";
      ctx.fillStyle = "white";
      ctx.lineWidth = 7;

      // nombre
      ctx.font = "bold 30px Sans";
      ctx.strokeText(name, x, y + 110);
      ctx.fillText(name, x, y + 110);

      // estilo
      ctx.font = "22px Sans";
      ctx.strokeText(style, x, y + 140);
      ctx.fillText(style, x, y + 140);
    }

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());

  } catch (err) {
    console.log(err);
    res.status(500).send("Error generando imagen");
  }
});

app.listen(PORT, () => console.log("API lista 🔥"));
