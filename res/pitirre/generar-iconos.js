#!/usr/bin/env node
// Genera los íconos de Pitirre para Windows, Android y Flutter a partir de los SVG de esta carpeta.
// Uso, desde la raíz del repositorio: node res/pitirre/generar-iconos.js
// Requiere Node con el paquete playwright y su Chromium.
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const ANDROID_RES = path.join(ROOT, 'flutter/android/app/src/main/res');
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const readSvg = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8').trim();
const TILE = readSvg('pitirre.svg');
const FIGURE = readSvg('pitirre-figura.svg');
const MONO = readSvg('pitirre-mono.svg');

const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

// Places 24x24 artwork so that the point (cx, cy) lands on the canvas centre, scaled by s.
function place(svg, s, cx = 12, cy = 12) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    `<g transform="translate(12 12) scale(${s}) translate(${-cx} ${-cy})">${inner(svg)}</g></svg>`;
}

// Rounded tile with a transparent margin of `pad` pixels on a `size` canvas.
const padded = (svg, size, pad) => place(svg, (size - 2 * pad) / size);

// Same backdrop as the tile, cut to a circle, with the figure on top.
function roundTile(figureScale) {
  const defs = TILE.match(/<defs>[\s\S]*?<\/defs>/)[0];
  const figure = place(FIGURE, figureScale);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' + defs +
    '<circle cx="12" cy="12" r="12" fill="url(#cq-g)"/>' + inner(figure) + '</svg>';
}

async function rasterize(page, svg, size) {
  const out = await page.evaluate(async ({ svg, size }) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let raw = '';
    for (let i = 0; i < data.length; i += 0x8000) {
      raw += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
    }
    return { png: canvas.toDataURL('image/png').split(',')[1], rgba: btoa(raw) };
  }, { svg, size });
  return { size, png: Buffer.from(out.png, 'base64'), rgba: Buffer.from(out.rgba, 'base64') };
}

// Bounding box and enclosing radius of the visible pixels, in 24-unit artwork coordinates.
async function measure(page, svg) {
  const n = 1200;
  const { rgba } = await rasterize(page, svg, n);
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (rgba[(y * n + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
  }
  const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
  let r = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (rgba[(y * n + x) * 4 + 3] > 8) {
        r = Math.max(r, Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
      }
    }
  }
  const k = 24 / n;
  return { cx: cx * k, cy: cy * k, w: (x1 - x0 + 1) * k, h: (y1 - y0 + 1) * k, r: r * k };
}

// Windows ICO: 32-bit BMP entries below 256 px (as the stock icons use), PNG for 256 px.
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const blobs = images.map(({ size, png, rgba }) => {
    if (size >= 256) return png;
    const maskRow = Math.ceil(size / 32) * 4;
    const dib = Buffer.alloc(40 + size * size * 4 + maskRow * size);
    dib.writeUInt32LE(40, 0);
    dib.writeInt32LE(size, 4);
    dib.writeInt32LE(size * 2, 8);
    dib.writeUInt16LE(1, 12);
    dib.writeUInt16LE(32, 14);
    dib.writeUInt32LE(size * size * 4 + maskRow * size, 20);
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * size * 4;
      for (let x = 0; x < size; x++) {
        const s = src + x * 4, d = 40 + (y * size + x) * 4;
        dib[d] = rgba[s + 2];
        dib[d + 1] = rgba[s + 1];
        dib[d + 2] = rgba[s];
        dib[d + 3] = rgba[s + 3];
        if (rgba[s + 3] === 0) {
          dib[40 + size * size * 4 + y * maskRow + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }
    return dib;
  });
  let offset = header.length;
  images.forEach(({ size }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(blobs[i].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += blobs[i].length;
  });
  return Buffer.concat([header, ...blobs]);
}

function write(rel, data) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log('escrito', rel);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');

  // Windows: app and packer icons keep a small margin, the tray icon uses the full canvas.
  const appSizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
  const appIcons = [];
  for (const size of appSizes) {
    appIcons.push(await rasterize(page, padded(TILE, size, Math.max(1, Math.round(size / 16))), size));
  }
  const appIco = ico(appIcons);
  write('res/icon.ico', appIco);
  write('flutter/windows/runner/resources/app_icon.ico', appIco);
  const trayIcons = [];
  for (const size of [16, 20, 24, 32]) trayIcons.push(await rasterize(page, TILE, size));
  write('res/tray-icon.ico', ico(trayIcons));

  // Flutter: icon.svg is drawn by flutter_svg in the tab bar and the connection manager.
  write('flutter/assets/icon.svg', TILE + '\n');

  // Android adaptive icon: 108 dp layers, artwork inside the 66 dp safe circle.
  const fig = await measure(page, FIGURE);
  const safe = (33 / 108) * 24;
  const adaptiveScale = safe / fig.r;
  const statScale = Math.min(22 / 24 * 24 / fig.w, 22 / 24 * 24 / fig.h);
  for (const [density, k] of Object.entries(DENSITIES)) {
    const dir = `flutter/android/app/src/main/res/mipmap-${density}`;
    const legacy = Math.round(48 * k);
    const margin = Math.round(2 * k);
    write(`${dir}/ic_launcher.png`, (await rasterize(page, padded(TILE, legacy, margin), legacy)).png);
    write(`${dir}/ic_launcher_round.png`,
      (await rasterize(page, place(roundTile(0.86), (legacy - 2 * margin) / legacy), legacy)).png);
    const layer = Math.round(108 * k);
    write(`${dir}/ic_launcher_foreground.png`,
      (await rasterize(page, place(FIGURE, adaptiveScale, fig.cx, fig.cy), layer)).png);
    write(`${dir}/ic_launcher_monochrome.png`,
      (await rasterize(page, place(MONO, adaptiveScale, fig.cx, fig.cy), layer)).png);
    const stat = Math.round(24 * k);
    write(`${dir}/ic_stat_logo.png`,
      (await rasterize(page, place(MONO, statScale, fig.cx, fig.cy), stat)).png);
  }
  console.log('figura', JSON.stringify(fig), 'escala adaptativa', adaptiveScale.toFixed(4),
    'escala notificación', statScale.toFixed(4));
  await browser.close();
  if (!fs.existsSync(ANDROID_RES)) throw new Error('No se encontró ' + ANDROID_RES);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
