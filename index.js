const express = require("express");
const { createCanvas, loadImage } = require("canvas");

const app = express();

app.get("/formation", async (req, res) => {
  try {
    const canvas = createCanvas(900, 600);
    const ctx = canvas.getContext("2d");

    const bg = await loadImage("./IMG_2478.jpeg");
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    async function drawPlayer(avatar, name, x, y) {
      if (!avatar || !name || name === "?") return;

      try {
        const img = await loadImage(avatar);

        ctx.drawImage(img, x, y, 90, 90);

        ctx.font = "bold 26px Arial";
        ctx.textAlign = "center";

        ctx.lineWidth = 5;
        ctx.strokeStyle = "black";
        ctx.strokeText(name, x + 45, y + 115);

        ctx.fillStyle = "white";
        ctx.fillText(name, x + 45, y + 115);
      } catch {}
    }

    await drawPlayer(req.query.cfAvatar, req.query.cfName, 405, 170);
    await drawPlayer(req.query.cmAvatar, req.query.cmName, 405, 250);
    await drawPlayer(req.query.lwAvatar, req.query.lwName, 150, 360);
    await drawPlayer(req.query.gkAvatar, req.query.gkName, 700, 230);

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());
  } catch (err) {
    res.status(500).send("error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API encendida en puerto " + PORT));
