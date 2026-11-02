#!/usr/bin/env node
// Genera el logo de Pitirre que la app muestra en Ajustes (móvil) y en el inicio (escritorio):
// flutter/assets/logo_light.png para el tema claro y flutter/assets/logo_dark.png para el oscuro.
// Uso, desde la raíz del repositorio: node res/pitirre/generar-logo.js
// Requiere Node con el paquete playwright y su Chromium; la letra se descarga de Google Fonts.
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const TILE = fs.readFileSync(path.join(__dirname, 'pitirre.svg'), 'utf8').trim();

async function wordmark(page, color) {
  await page.setContent('<!doctype html><html><head>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&display=block">' +
    '<style>html,body{margin:0;background:transparent}' +
    '#w{display:inline-flex;align-items:center;gap:22px;height:120px;padding:0 6px;' +
    `font:800 80px 'Plus Jakarta Sans',sans-serif;letter-spacing:-2px;color:${color}}` +
    '#w svg{width:104px;height:104px;flex:0 0 auto}</style></head>' +
    `<body><div id="w">${TILE}<span>Pitirre</span></div></body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page.locator('#w').screenshot({ omitBackground: true });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, color] of [['logo_light.png', '#0A2A44'], ['logo_dark.png', '#EAF4FB']]) {
    const rel = 'flutter/assets/' + file;
    fs.writeFileSync(path.join(ROOT, rel), await wordmark(page, color));
    console.log('escrito', rel);
  }
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
