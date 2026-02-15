const express = require("express");
const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");

const app = express();

const WIDTH = 1280;
const HEIGHT = 720;

app.get("/formation", async (req, res) => {
  try {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    const bg = await loadImage(path.join(__dirname, "IMG_2478.jpeg"));
    ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);

    async function drawPlayer(x, y, avatar, name, style) {
      if (!avatar || avatar === "") return;

      const img = await loadImage(avatar);

      const size = 120;
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);

      if (name) {
        ctx.font = "28px Sans";
        ctx.textAlign = "center";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "black";
        ctx.fillStyle = "white";
        ctx.strokeText(name, x, y + 90);
        ctx.fillText(name, x, y + 90);
      }

      if (style) {
        ctx.font = "22px Sans";
        ctx.strokeText(style, x, y + 120);
        ctx.fillText(style, x, y + 120);
      }
    }

    await drawPlayer(
      640, 180,
      req.query.cfAvatar,
      req.query.cfName,
      req.query.cfStyle
    );

    await drawPlayer(
      640, 350,
      req.query.cmAvatar,
      req.query.cmName,
      req.query.cmStyle
    );

    await drawPlayer(
      300, 250,
      req.query.lwAvatar,
      req.query.lwName,
      req.query.lwStyle
    );

    await drawPlayer(
      640, 520,
      req.query.gkAvatar,
      req.query.gkName,
      req.query.gkStyle
    );

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());
  } catch (err) {
    res.send("Error: " + err.message);
  }
});

app.listen(3000, () => console.log("API encendida"));
