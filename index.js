const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

const DEFAULT_AVATAR = "https://i.imgur.com/4jduEyb.png";
const DEFAULT_5V5_BG = "https://i.imgur.com/dRSz8QM.png";

const app = express();
const PORT = process.env.PORT || 8080;

const WIDTH = 1600;
const HEIGHT = 1000;

const imageCache = new Map();

// =========================
// FETCH ROBUSTO (🔥 CLAVE REAL)
// =========================
async function fetchBuffer(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.log("❌ Error HTTP:", url);
      return null;
    }

    return await res.buffer();
  } catch (e) {
    console.log("❌ Fetch fallo:", url);
    return null;
  }
}

// =========================
// LOAD IMAGE SEGURO
// =========================
async function loadImageSafe(url) {
  if (!url) return null;

  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  const buffer = await fetchBuffer(url);
  if (!buffer) return null;

  try {
    const img = await loadImage(buffer);
    imageCache.set(url, img);
    return img;
  } catch {
    console.log("❌ Canvas no pudo cargar:", url);
    return null;
  }
}

// =========================
// UTILS
// =========================
function safeDecode(v) {
  if (!v) return "";
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function normalizeType(type) {
  return String(type || "5").toLowerCase();
}

function getFormation(type) {
  const t = normalizeType(type);

  if (t === "3") return ["rw", "cf", "lw"];
  if (t === "4") return ["rw", "cf", "lw", "gk"];
  if (t === "5") return ["cf", "rw", "cm", "lw", "gk"];

  return ["cf", "rw", "cm", "lw", "gk"];
}

function getCoords(pos) {
  const map = {
    cf: { x: 800, y: 165 },
    rw: { x: 1300, y: 420 },
    cm: { x: 800, y: 470 },
    lw: { x: 370, y: 420 },
    gk: { x: 800, y: 820 }
  };
  return map[pos] || { x: 800, y: 500 };
}

// =========================
// ENDPOINT
// =========================
app.get("/formation", async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const positions = getFormation(type);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    let stadium = safeDecode(req.query.stadium);

    // 🔥 INTENTA cargar fondo
    let bg = await loadImageSafe(stadium);

    // 🔥 FALLBACK FORZADO
    if (!bg) {
      console.log("⚠️ usando fondo por defecto");
      bg = await loadImageSafe(DEFAULT_5V5_BG);
    }

    // 🔥 SI TODO FALLA → COLOR
    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // jugadores
    await Promise.all(
      positions.map(async (pos) => {
        const avatar = safeDecode(req.query[pos + "Avatar"]) || DEFAULT_AVATAR;
        const name = safeDecode(req.query[pos + "Name"]) || "?";

        const img = await loadImageSafe(avatar);
        const { x, y } = getCoords(pos);

        if (img) {
          ctx.drawImage(img, x - 50, y - 50, 100, 100);
        }

        ctx.fillStyle = "white";
        ctx.fillText(name, x, y + 70);
      })
    );

    res.set("Content-Type", "image/png");
    res.send(canvas.toBuffer());

  } catch (e) {
    console.error(e);
    res.status(500).send("Error");
  }
});

// 🔥 IMPORTANTE PARA FLY
app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 VERSION FINAL FUNCIONANDO");
});