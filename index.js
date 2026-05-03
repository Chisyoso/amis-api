const express = require("express");
const { createCanvas, loadImage } = require("canvas");

const DEFAULT_AVATAR = "https://i.imgur.com/4jduEyb.png";
const DEFAULT_5V5_BG = "https://i.imgur.com/dRSz8QM.png";

const app = express();
const PORT = process.env.PORT || 8080;

const WIDTH = 1600;
const HEIGHT = 1000;

const imageCache = new Map();

// SAFE IMAGE LOADER (FLY FIX)
async function loadImageSafe(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const img = await loadImage(buffer);

    imageCache.set(url, img);
    return img;

  } catch {
    return null;
  }
}

// utils simples
function safeDecode(v) {
  try { return decodeURIComponent(String(v || "")); }
  catch { return String(v || ""); }
}

function normalizeType(t) {
  return String(t || "5").toLowerCase();
}

function getFormation(type) {
  if (type === "3" || type === "3v3") return ["rw","cf","lw"];
  if (type === "4" || type === "4v4") return ["rw","cf","lw","gk"];
  if (type === "8" || type === "8v8") return ["rw","drw","cf","dcf","lw","dlw","cm","gk"];
  return ["cf","rw","cm","lw","gk"];
}

function getPositionCoords(pos) {
  const map = {
    cf: { x: 800, y: 165 },
    rw: { x: 1300, y: 420 },
    lw: { x: 370, y: 420 },
    cm: { x: 800, y: 470 },
    gk: { x: 800, y: 820 }
  };
  return map[pos] || { x: WIDTH/2, y: HEIGHT/2 };
}

// ROUTE
app.get("/formation", async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const formation = getFormation(type);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    let bg = await loadImageSafe(DEFAULT_5V5_BG);
    if (bg) ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);

    await Promise.all(
      formation.map(async (pos) => {
        const player = {
          avatar: safeDecode(req.query[pos + "Avatar"]) || DEFAULT_AVATAR,
          name: safeDecode(req.query[pos + "Name"]) || "?"
        };

        const img = await loadImageSafe(player.avatar);
        const { x, y } = getPositionCoords(pos);

        if (img) {
          ctx.drawImage(img, x - 75, y - 75, 150, 150);
        }

        ctx.fillStyle = "white";
        ctx.fillText(player.name, x, y + 100);
      })
    );

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (e) {
    console.error(e);
    res.status(500).send("error");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("API OK", PORT);
});