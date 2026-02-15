const express = require("express");
const { createCanvas, loadImage, registerFont } = require("canvas");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const BACKGROUND = path.join(__dirname, "IMG_2478.jpeg");

// posiciones ejemplo (ajusta si quieres)
const positions = {
  cf: { x: 960, y: 260 },
  cm: { x: 960, y: 540 },
  lw: { x: 420, y: 360 },
  gk: { x: 960, y: 820 }
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

      ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);

      ctx.textAlign = "center";

      ctx.lineWidth = 6;
      ctx.strokeStyle = "black";
      ctx.fillStyle = "white";

      ctx.font = "bold 28px Sans";

      ctx.strokeText(name, x, y + 100);
      ctx.fillText(name, x, y + 100);

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
