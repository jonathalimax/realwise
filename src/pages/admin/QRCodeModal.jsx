import { useEffect, useRef, useState } from 'react';
import { X, Copy, Download } from 'lucide-react';

function formatDiscountLabel(coupon) {
  if (coupon.discountType === 'percentage') return `${coupon.discountValue}% OFF`;
  return `R$ ${(coupon.discountValue / 100).toFixed(2).replace('.', ',')} OFF`;
}

function buildQrUrl(code) {
  const data = encodeURIComponent(`https://realwise.com.br/promo/${code}`);
  return `https://api.qrserver.com/v1/create-qr-code/?data=${data}&size=300x300&bgcolor=111827&color=ffffff&qzone=2`;
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

function drawPoster(canvas, qrImage, coupon) {
  const ctx = canvas.getContext('2d');
  const W = 400;
  const H = 600;
  canvas.width = W;
  canvas.height = H;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#111827');
  bg.addColorStop(1, '#1f2937');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Logo square
  const squareSize = 40;
  const squareX = W / 2 - squareSize / 2;
  ctx.fillStyle = '#10b981';
  roundRect(ctx, squareX, 44, squareSize, squareSize, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('R', W / 2, 73);

  // Wordmark
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Realwise', W / 2, 108);

  // Discount badge
  const label = formatDiscountLabel(coupon);
  const badgeGrad = ctx.createLinearGradient(0, 130, W, 130);
  badgeGrad.addColorStop(0, '#059669');
  badgeGrad.addColorStop(1, '#10b981');
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 16;
  ctx.fillStyle = badgeGrad;
  roundRect(ctx, 80, 130, 240, 54, 27);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(label, W / 2, 165);

  // Tagline
  ctx.fillStyle = '#9ca3af';
  ctx.font = '15px sans-serif';
  ctx.fillText('Controle suas finanças com', W / 2, 210);
  ctx.fillText('desconto exclusivo', W / 2, 230);

  // QR white card
  const qrSize = 180;
  const qrX = (W - qrSize) / 2;
  const qrY = 258;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 12);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // Coupon code pill
  const code = coupon.code;
  ctx.font = 'bold 18px monospace';
  const textWidth = ctx.measureText(code).width;
  const pillW = Math.max(textWidth + 40, 160);
  const pillX = (W - pillW) / 2;
  ctx.fillStyle = '#1f2937';
  roundRect(ctx, pillX, 466, pillW, 36, 18);
  ctx.fillStyle = '#6ee7b7';
  ctx.fillText(code, W / 2, 490);

  // Expiry
  if (coupon.validUntil) {
    const d = coupon.validUntil.toDate?.() || new Date(coupon.validUntil);
    const formatted = d.toLocaleDateString('pt-BR');
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Válido até ${formatted}`, W / 2, 534);
  }

  // Bottom URL hint
  ctx.fillStyle = '#4b5563';
  ctx.font = '11px sans-serif';
  ctx.fillText('realwise.com.br', W / 2, 575);
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
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      drawPoster(canvasRef.current, img, coupon);
      setPreviewUrl(canvasRef.current.toDataURL('image/png'));
      setLoading(false);
    };
    img.onerror = () => {
      setError('Não foi possível carregar o QR Code. Verifique sua conexão.');
      setLoading(false);
    };
    img.src = buildQrUrl(coupon.code);
  }, [coupon, attempt]);

  function handleDownload() {
    canvasRef.current.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${coupon.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(promoUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">QR Code — {coupon.code}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
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
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex-shrink-0"
                title="Copiar URL"
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
