import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const icon = new URL('../public/icon.svg', import.meta.url);
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(fileURLToPath(icon)).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url)));
  console.log(`Created ${name}`);
}
