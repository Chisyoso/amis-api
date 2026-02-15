const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const BACKGROUND = path.join(__dirname, "IMG_2478.jpeg");

// coordenadas basadas en TU fondo
const positions = {
  rw: { x: 960, y: 120 },
  cf: { x: 400, y: 420 },
  cm: { x: 960, y: 420 },
  gk: { x: 1500, y: 420 },
  lw: { x: 960, y: 760 }
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
    const bg = await loadImage(BACKGROUND);

    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    for (const pos in positions) {
      const avatarURL = decodeURIComponent(req.query[pos + "Avatar"] || "");
      const name = decodeURIComponent(req.query[pos + "Name"] || "?");
      const style = decodeURIComponent(req.query[pos + "Style"] || "");

      if (!avatarURL || name === "?") continue;

      const avatar = await loadAvatar(avatarURL);
      if (!avatar) continue;

      const { x, y } = positions[pos];

      const size = 150;

      // avatar
      ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);

      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "black";
      ctx.fillStyle = "white";

      // nombre
      ctx.font = "bold 28px Sans";
      ctx.strokeText(name, x, y + 100);
      ctx.fillText(name, x, y + 100);

      // estilo
      ctx.font = "20px Sans";
      ctx.strokeText(style, x, y + 130);
      ctx.fillText(style, x, y + 130);
    }

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());

  } catch (e) {
    console.log(e);
    res.status(500).send("Error generando imagen");
  }
});

app.listen(PORT, () => console.log("API encendida en puerto", PORT));
