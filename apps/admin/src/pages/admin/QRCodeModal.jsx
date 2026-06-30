import { useEffect, useRef, useState } from 'react';
import { X, Copy, Download } from 'lucide-react';

const SCALE = 2; // retina quality

function formatDiscountLabel(coupon) {
  if (coupon.discountType === 'percentage') return `${coupon.discountValue}% OFF`;
  return `R$ ${(coupon.discountValue / 100).toFixed(2).replace('.', ',')} OFF`;
}

function buildQrUrl(code) {
  const data = encodeURIComponent(`https://realwise.com.br/promo/${code}`);
  return `https://api.qrserver.com/v1/create-qr-code/?data=${data}&size=600x600&bgcolor=ffffff&color=000000&qzone=1`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function clipRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.clip();
}

function drawPoster(canvas, qrImage, logoImage, coupon) {
  const ctx = canvas.getContext('2d');
  const W = 400 * SCALE;
  const H = 640 * SCALE;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = '400px';
  canvas.style.height = '640px';
  ctx.scale(SCALE, SCALE);

  const cW = 400; // logical coords
  const cH = 640;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, cH);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(1, '#1e293b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cW, cH);

  // ── Logo (circular crop from logo.png) ──
  const logoSize = 72;
  const logoX = cW / 2 - logoSize / 2;
  const logoY = 36;
  ctx.save();
  clipRoundRect(ctx, logoX, logoY, logoSize, logoSize, 18);
  ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
  ctx.restore();

  // ── "Controle suas finanças" title ──
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('Controle suas finanças', cW / 2, logoY + logoSize + 32);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('com desconto exclusivo', cW / 2, logoY + logoSize + 54);

  // ── Discount badge ──
  const label = formatDiscountLabel(coupon);
  const badgeY = logoY + logoSize + 76;
  const badgeH = 52;
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 20;
  const badgeGrad = ctx.createLinearGradient(60, badgeY, cW - 60, badgeY);
  badgeGrad.addColorStop(0, '#059669');
  badgeGrad.addColorStop(1, '#10b981');
  ctx.fillStyle = badgeGrad;
  roundRect(ctx, 60, badgeY, cW - 120, badgeH, badgeH / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(label, cW / 2, badgeY + 34);

  // ── QR code (white card) ──
  const qrSize = 210;
  const qrCardPad = 14;
  const qrX = (cW - qrSize) / 2;
  const qrY = badgeY + badgeH + 28;
  // white card with subtle shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - qrCardPad, qrY - qrCardPad, qrSize + qrCardPad * 2, qrSize + qrCardPad * 2, 16);
  ctx.shadowBlur = 0;
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // ── Coupon code pill ──
  const code = coupon.code;
  ctx.font = 'bold 20px monospace';
  const textWidth = ctx.measureText(code).width;
  const pillW = Math.max(textWidth + 44, 160);
  const pillX = (cW - pillW) / 2;
  const pillY = qrY + qrSize + qrCardPad + 20;
  const pillH = 40;
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect?.(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.stroke();
  ctx.fillStyle = '#6ee7b7';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(code, cW / 2, pillY + 27);

  // ── Expiry ──
  let copyrightY = cH - 20;
  if (coupon.validUntil) {
    const d = coupon.validUntil.toDate?.() || new Date(coupon.validUntil);
    ctx.fillStyle = '#475569';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`Válido até ${d.toLocaleDateString('pt-BR')}`, cW / 2, pillY + pillH + 18);
    copyrightY = cH - 16;
  }

  // ── © Realwise footer ──
  ctx.fillStyle = '#334155';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('© Realwise · realwise.com.br', cW / 2, copyrightY);
}

export default function QRCodeModal({ coupon, onClose }) {
  const canvasRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const promoUrl = `https://realwise.com.br/promo/${coupon.code}`;

  useEffect(() => {
    setLoading(true);
    setError('');

    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';

    const logoImg = new Image();
    logoImg.src = '/logo.png';

    let cancelled = false;

    Promise.all([
      new Promise((res, rej) => { qrImg.onload = res; qrImg.onerror = rej; }),
      new Promise((res, rej) => { logoImg.onload = res; logoImg.onerror = rej; }),
    ]).then(() => {
      if (cancelled) return;
      try {
        drawPoster(canvasRef.current, qrImg, logoImg, coupon);
        setPreviewUrl(canvasRef.current.toDataURL('image/png'));
        setLoading(false);
      } catch {
        setError('Não foi possível gerar o pôster. Tente novamente.');
        setLoading(false);
      }
    }).catch(() => {
      if (cancelled) return;
      setError('Não foi possível carregar os recursos. Verifique sua conexão.');
      setLoading(false);
    });

    qrImg.src = buildQrUrl(coupon.code);

    return () => { cancelled = true; };
  }, [coupon, attempt]);

  function handleDownload() {
    try {
      canvasRef.current.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr-${coupon.code}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch {
      // canvas tainted or unavailable
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(promoUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">QR Code — {coupon.code}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden canvas for drawing */}
        <canvas ref={canvasRef} style={{ position: 'absolute', left: '-9999px' }} />

        {loading && (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center text-red-600 dark:text-red-400 py-8">
            <p className="mb-3 text-sm">{error}</p>
            <button
              onClick={() => setAttempt(a => a + 1)}
              className="text-sm text-emerald-600 hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && previewUrl && (
          <>
            <img
              src={previewUrl}
              alt="QR Code poster preview"
              className="w-full rounded-xl mb-4 border border-gray-200 dark:border-gray-700"
            />

            {/* Promo URL row */}
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <span className="flex-1 text-xs text-gray-600 dark:text-gray-300 font-mono truncate">
                {promoUrl}
              </span>
              <button
                onClick={handleCopy}
                aria-label="Copiar URL"
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex-shrink-0"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copied && <p className="text-xs text-emerald-600 text-center -mt-2 mb-3">URL copiada!</p>}

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar PNG
            </button>
          </>
        )}
      </div>
    </div>
  );
}
