import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../public/wallet-icon.svg');
const svg = readFileSync(svgPath);

await sharp(svg).resize(192, 192).png().toFile(join(__dirname, '../public/pwa-192x192.png'));
console.log('Generated pwa-192x192.png');

await sharp(svg).resize(512, 512).png().toFile(join(__dirname, '../public/pwa-512x512.png'));
console.log('Generated pwa-512x512.png');
