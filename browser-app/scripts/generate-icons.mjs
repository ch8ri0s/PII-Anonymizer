#!/usr/bin/env node
/**
 * Generate PWA icons from SVG source
 *
 * This script creates PNG icons at required sizes for PWA manifest.
 * Requires: sharp (npm install sharp --save-dev)
 *
 * Usage: node scripts/generate-icons.mjs
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, '../public');
const ICONS_DIR = join(PUBLIC_DIR, 'icons');
const SVG_SOURCE = join(ICONS_DIR, 'icon.svg');

// Icon sizes to generate
const ICON_SIZES = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-maskable-192.png', maskable: true },
  { size: 512, name: 'icon-maskable-512.png', maskable: true },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32.png' },
  { size: 16, name: 'favicon-16.png' },
];

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Check if sharp is available
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.log('sharp not installed. Creating placeholder PNGs...');
    console.log('Run: npm install sharp --save-dev to generate proper icons');
    await createPlaceholderIcons();
    return;
  }

  // Read SVG source
  const svgBuffer = await readFile(SVG_SOURCE);

  for (const { size, name, maskable } of ICON_SIZES) {
    const outputPath = join(ICONS_DIR, name);

    let image = sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } });

    // For maskable icons, add padding (safe area is 80% of icon)
    if (maskable) {
      const padding = Math.floor(size * 0.1); // 10% padding on each side
      const innerSize = size - (padding * 2);

      image = sharp(svgBuffer)
        .resize(innerSize, innerSize)
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 79, g: 70, b: 229, alpha: 1 }, // theme color background
        });
    }

    await image.png().toFile(outputPath);
    console.log(`  Created: ${name} (${size}x${size})`);
  }

  console.log('Icon generation complete!');
}

async function createPlaceholderIcons() {
  // Create simple placeholder PNGs (single-color squares) when sharp isn't available
  // These are minimal valid PNGs that can be replaced later

  // Minimal 1x1 PNG (indigo color #4F46E5)
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0x98, 0x8D, 0xCD, 0x01,
    0x00, 0x02, 0x29, 0x00, 0xEB, 0x8C, 0x04, 0xE3,
    0x9F, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);

  for (const { name } of ICON_SIZES) {
    const outputPath = join(ICONS_DIR, name);
    await writeFile(outputPath, minimalPNG);
    console.log(`  Created placeholder: ${name}`);
  }

  console.log('\nNote: These are placeholder icons. For production, install sharp and re-run:');
  console.log('  npm install sharp --save-dev');
  console.log('  node scripts/generate-icons.mjs');
}

generateIcons().catch(console.error);
