const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

const DEFAULT_AVATAR = "https://i.imgur.com/4jduEyb.png";
const DEFAULT_5V5_BG = "https://i.imgur.com/dRSz8QM.png";

const app = express();
const PORT = process.env.PORT || 3000;

const WIDTH = 1600;
const HEIGHT = 1000;

// =========================
// CACHE GLOBAL
// =========================
const imageCache = new Map();
const colorCache = new Map();

// 🔥 PRELOAD CRÍTICO (FONDO EN RAM)
let bgMain = null;
(async () => {
  try {
    bgMain = await loadImage(DEFAULT_5V5_BG);
    imageCache.set(DEFAULT_5V5_BG, bgMain);
    console.log("🔥 Background listo en RAM");
  } catch {}
})();

// =========================
// UTILS (SIN CAMBIOS GRANDES)
// =========================
function safeDecode(v) {
  if (!v) return "";
  try { return decodeURIComponent(String(v)); } catch { return String(v); }
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function paletteFromSeed(seed) {
  const h = hashString(seed || "?");
  const hue = h % 360;

  return {
    fill: `hsla(${hue}, 85%, 60%, 0.18)`,
    stroke: `hsla(${hue}, 90%, 70%, 0.45)`,
    text: `hsla(${(hue + 30) % 360}, 100%, 96%, 0.98)`,
    glow: `hsla(${hue}, 90%, 65%, 0.10)`
  };
}

function randomBorderColor(seed) {
  if (colorCache.has(seed)) return colorCache.get(seed);
  const h = hashString(seed) % 360;
  const c = `hsl(${h},100%,65%)`;
  colorCache.set(seed, c);
  return c;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  const rr = Math.min(r, w/2, h/2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// =========================
// IMAGE CACHE (OPTIMIZADO)
// =========================
async function loadImageSafe(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const buffer = await res.buffer();
    const img = await loadImage(buffer);

    imageCache.set(url, img);
    return img;
  } catch {
    return null;
  }
}

// =========================
// FORMACIONES
// =========================
function normalizeType(t){ return String(t||"5").toLowerCase(); }

function getFormation(type){
  const t = normalizeType(type);
  if(t==="3"||t==="3v3") return ["rw","cf","lw"];
  if(t==="4"||t==="4v4") return ["rw","cf","lw","gk"];
  if(t==="8"||t==="8v8") return ["rw","drw","cf","dcf","lw","dlw","cm","gk"];
  return ["cf","rw","cm","lw","gk"];
}

function getPositionCoords(pos,type){
  const t = normalizeType(type);

  if(t==="5"||t==="5v5"){
    if(pos==="cf") return {x:800,y:165};
    if(pos==="rw") return {x:1300,y:420};
    if(pos==="cm") return {x:800,y:470};
    if(pos==="lw") return {x:370,y:420};
    if(pos==="gk") return {x:800,y:820};
  }

  return {x:WIDTH/2,y:HEIGHT/2};
}

// =========================
// DRAW PLAYER (SIN ASYNC)
// =========================
function drawPlayer(ctx, player, x, y, avatar) {
  const size = 150;
  const seed = player.name + player.style;

  const palette = paletteFromSeed(seed);
  const border = randomBorderColor(seed);

  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.arc(x,y,size/2+14,0,Math.PI*2);
  ctx.fillStyle = palette.fill;
  ctx.fill();

  ctx.shadowBlur = 0;

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x,y,size/2,0,Math.PI*2);
    ctx.clip();
    ctx.drawImage(avatar,x-size/2,y-size/2,size,size);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(x,y,size/2+2,0,Math.PI*2);
  ctx.strokeStyle = border;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.font = "bold 26px Sans";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText(player.name,x,y+110);
}

// =========================
// API ULTRA FAST
// =========================
app.get("/formation", async (req,res)=>{
  try{
    const type = normalizeType(req.query.type);
    const positions = getFormation(type);

    const canvas = createCanvas(WIDTH,HEIGHT);
    const ctx = canvas.getContext("2d");

    // 🔥 FONDO DIRECTO RAM
    ctx.drawImage(bgMain,0,0,WIDTH,HEIGHT);

    // 🔥 PRELOAD AVATARS EN PARALELO (CLAVE REAL)
    const players = await Promise.all(
      positions.map(async (pos)=>{
        const avatarUrl = req.query[pos+"Avatar"] || DEFAULT_AVATAR;

        const avatar =
          imageCache.get(avatarUrl) ||
          await loadImageSafe(avatarUrl);

        return {
          pos,
          avatar,
          player:{
            name: safeDecode(req.query[pos+"Name"])||"?",
            style: safeDecode(req.query[pos+"Style"])||"?"
          }
        };
      })
    );

    // 🔥 DRAW SYNC (SIN AWAIT)
    for(const p of players){
      const {x,y} = getPositionCoords(p.pos,type);
      drawPlayer(ctx,p.player,x,y,p.avatar);
    }

    res.set("Content-Type","image/png");
    res.send(canvas.toBuffer("image/png"));

  }catch(e){
    console.error(e);
    res.status(500).send("Error");
  }
});

app.listen(PORT,()=>console.log("⚡ ULTRA FAST MODE ON"));