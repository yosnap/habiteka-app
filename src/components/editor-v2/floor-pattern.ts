import type { FloorFinish } from '@/lib/editor-document/schema';

/** Shared world-scale repeat tile for Konva and Three; deterministic, no network assets. */
export function createFloorPattern(finish: FloorFinish): HTMLCanvasElement | undefined {
  if (finish.texture !== 'wood' && finish.texture !== 'tile') return undefined;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d'); if (!ctx) return undefined;
  ctx.fillStyle = finish.color; ctx.fillRect(0, 0, 256, 256);
  if (finish.texture === 'tile') {
    ctx.strokeStyle = '#ddd9cf'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeStyle = '#00000012'; ctx.lineWidth = 1; ctx.strokeRect(5, 5, 246, 246);
  } else {
    for (let plank = 0; plank < 4; plank++) {
      ctx.fillStyle = plank % 2 ? '#ffffff12' : '#0000000a'; ctx.fillRect(plank * 64, 0, 64, 256);
      ctx.strokeStyle = '#00000040'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(plank * 64, 0); ctx.lineTo(plank * 64, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(plank * 64, plank % 2 ? 128 : 0); ctx.lineTo((plank + 1) * 64, plank % 2 ? 128 : 0); ctx.stroke();
    }
    for (let i = 0; i < 96; i++) {
      const x = (i * 73.31) % 256, y = (i * 47.13) % 256;
      ctx.strokeStyle = i % 2 ? '#ffffff13' : '#00000013'; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 2, y + 20, x - 2, y + 40, x, y + 70); ctx.stroke();
    }
  }
  return canvas;
}
