const express = require("express");
const { createCanvas, loadImage } = require("canvas");

const app = express();

app.get("/formation", async (req, res) => {
  const canvas = createCanvas(900, 600);
  const ctx = canvas.getContext("2d");

  const bg = await loadImage("./fondo.png");
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  async function drawPlayer(avatar, name, x, y) {
    if (!avatar || !name || name === "?") return;

    const img = await loadImage(avatar);

    ctx.drawImage(img, x, y, 90, 90);

    ctx.font = "28px Arial";
    ctx.textAlign = "center";

    ctx.lineWidth = 5;
    ctx.strokeStyle = "black";
    ctx.strokeText(name, x + 45, y + 120);

    ctx.fillStyle = "white";
    ctx.fillText(name, x + 45, y + 120);
  }

  await drawPlayer(req.query.cfAvatar, req.query.cfName, 405, 180);
  await drawPlayer(req.query.cmAvatar, req.query.cmName, 405, 260);
  await drawPlayer(req.query.lwAvatar, req.query.lwName, 150, 350);
  await drawPlayer(req.query.gkAvatar, req.query.gkName, 700, 230);

  res.set("Content-Type", "image/png");
  res.send(canvas.toBuffer());
});

app.listen(3000);
