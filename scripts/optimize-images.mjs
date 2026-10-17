#!/usr/bin/env node
/**
 * Optimizes raster images in static/ by converting PNG/JPG/JPEG to WebP
 * (quality 80, max width 1600) and removing the originals.
 * Run with:  node scripts/optimize-images.mjs
 */
import { readdirSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { join, extname, dirname, basename } from 'node:path';
import sharp from 'sharp';

const ROOTS = ['static/images', 'static/projects'];
const MAX_WIDTH = 1600;
const QUALITY = 80;
const RASTER = new Set(['.png', '.jpg', '.jpeg']);

/** @param {string} dir @param {string[]} files */
function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

let converted = 0;
let skipped = 0;
let failed = 0;

for (const root of ROOTS) {
  if (!existsSync(root)) continue;
  for (const file of walk(root)) {
    if (!RASTER.has(extname(file).toLowerCase())) continue;
    if (basename(file).startsWith('.')) continue; // .DS_Store etc.

    const out = file.slice(0, -(extname(file).length)) + '.webp';
    try {
      const meta = await sharp(file).metadata();
      const width = meta.width ?? 0;
      const pipeline = sharp(file).rotate();
      if (width > MAX_WIDTH) pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
      await pipeline.webp({ quality: QUALITY }).toFile(out);
      unlinkSync(file);
      const before = statSync(file).size;
      const after = statSync(out).size;
      console.log(
        `  ✓ ${file.replace('static/', '')}  ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB  (-${Math.round((1 - after / before) * 100)}%)`
      );
      converted++;
    } catch (e) {
      console.error(`  ✗ ${file}: ${e.message}`);
      failed++;
    }
  }
}

console.log(`\nDone: ${converted} converted, ${skipped} skipped, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
