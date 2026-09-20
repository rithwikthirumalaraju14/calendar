// Adapted from the user's Night Garden: final_one/lunar-surface.js.
// Project the lunar map onto a softly lit disk once, without a continuous render loop.
export function paintLunarSurface(canvas, image) {
  const context = canvas?.getContext('2d');
  if (!context || !image?.naturalWidth) return false;
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) return false;
  sourceContext.drawImage(image, 0, 0);
  let pixels;
  try {
    pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
  } catch {
    return false;
  }
  const size = canvas.width;
  const radius = size / 2 - 1;
  const result = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const ny = (size / 2 - y - 0.5) / radius;
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5 - size / 2) / radius;
      const distance = nx * nx + ny * ny;
      if (distance >= 1) continue;
      const nz = Math.sqrt(1 - distance);
      const u = 0.5 + Math.atan2(nx, nz) / (Math.PI * 2);
      const v = 0.5 - Math.asin(ny) / Math.PI;
      const sx = Math.min(source.width - 1, Math.floor(u * source.width));
      const sy = Math.min(source.height - 1, Math.floor(v * source.height));
      const sample = (sy * source.width + sx) * 4;
      const offset = (y * size + x) * 4;
      const light = 0.56 + 0.44 * Math.max(0, -nx * 0.45 + ny * 0.35 + nz * 0.82);
      result.data[offset] = pixels[sample] * light * 1.22;
      result.data[offset + 1] = pixels[sample + 1] * light * 1.2;
      result.data[offset + 2] = pixels[sample + 2] * light * 1.22;
      result.data[offset + 3] = Math.min(1, (1 - Math.sqrt(distance)) * radius) * 255;
    }
  }
  context.putImageData(result, 0, 0);
  return true;
}
