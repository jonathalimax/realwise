/**
 * Draws the shareable card (percentages only, never amounts) on a canvas and hands it to the share sheet, or downloads
 * it where files cannot be shared. Nothing leaves the device: the image is built in the browser.
 */
export async function shareSummaryCard({ value, caption, footer }) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#10b981');
  grad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const font = (weight, size) => `${weight} ${size}px "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = font(800, 34);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('R E A L W I S E', 90, 140);

  ctx.fillStyle = '#ffffff';
  ctx.font = font(800, 330);
  ctx.fillText(value, 80, 720);

  ctx.font = font(700, 72);
  const words = caption.split(' ');
  let line = '';
  let y = 840;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > W - 180 && line) {
      ctx.fillText(line, 90, y);
      line = word;
      y += 92;
    } else line = test;
  }
  ctx.fillText(line, 90, y);

  if (footer) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = font(700, 48);
    ctx.fillText(footer, 90, H - 120);
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;
  const file = new File([blob], 'meu-resumo-realwise.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Meu resumo no Realwise' });
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return true; // the user closed the share sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
