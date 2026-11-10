'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2, Download } from 'lucide-react';

interface TeamShareCardProps {
  open: boolean;
  onClose: () => void;
  teamName: string;
  matchTitle?: string;
  players: { name: string; role?: string; team_name?: string }[];
  captainName?: string;
  viceCaptainName?: string;
}

const CARD_W = 1080;
const CARD_H = 1350;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawShareCard(
  canvas: HTMLCanvasElement,
  props: Pick<TeamShareCardProps, 'teamName' | 'matchTitle' | 'players' | 'captainName' | 'viceCaptainName'>
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { teamName, matchTitle, players, captainName, viceCaptainName } = props;

  canvas.width = CARD_W;
  canvas.height = CARD_H;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#0B1220');
  bg.addColorStop(0.45, '#1E3A8A');
  bg.addColorStop(1, '#0B1220');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Gold frame
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.8)';
  ctx.lineWidth = 4;
  roundedRect(ctx, 28, 28, CARD_W - 56, CARD_H - 56, 28);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Branding
  ctx.fillStyle = '#F59E0B';
  ctx.font = '900 76px Arial, sans-serif';
  ctx.fillText('PRIME DREEMS', CARD_W / 2, 128);
  ctx.fillStyle = '#93C5FD';
  ctx.font = '700 28px Arial, sans-serif';
  ctx.fillText('F A N T A S Y   C R I C K E T', CARD_W / 2, 172);

  ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 205);
  ctx.lineTo(CARD_W - 120, 205);
  ctx.stroke();

  // Team + match
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 58px Arial, sans-serif';
  ctx.fillText(fitText(ctx, teamName || 'My Team', 940), CARD_W / 2, 278);
  if (matchTitle) {
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '700 30px Arial, sans-serif';
    ctx.fillText(fitText(ctx, matchTitle, 940), CARD_W / 2, 326);
  }
  ctx.fillStyle = '#F59E0B';
  ctx.font = '900 24px Arial, sans-serif';
  ctx.fillText('— PLAYING XI —', CARD_W / 2, 372);

  // Players grid (single column, 11 rows)
  const startY = 396;
  const rowH = 66;
  const gap = 10;
  players.slice(0, 11).forEach((p, i) => {
    const y = startY + i * (rowH + gap);
    const cy = y + rowH / 2;
    const isCaptain = !!captainName && p.name === captainName;
    const isVice = !!viceCaptainName && p.name === viceCaptainName;

    ctx.fillStyle = isCaptain
      ? 'rgba(217, 119, 6, 0.22)'
      : isVice
        ? 'rgba(37, 99, 235, 0.25)'
        : 'rgba(255, 255, 255, 0.08)';
    roundedRect(ctx, 70, y, CARD_W - 140, rowH, 14);
    ctx.fill();
    ctx.strokeStyle = isCaptain
      ? 'rgba(245, 158, 11, 0.7)'
      : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Index
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = '900 24px Arial, sans-serif';
    ctx.fillText(String(i + 1).padStart(2, '0'), 112, cy + 9);

    // Name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 30px Arial, sans-serif';
    ctx.fillText(fitText(ctx, p.name, 600), 150, cy + 11);

    // C / VC badge
    if (isCaptain || isVice) {
      ctx.beginPath();
      ctx.arc(800, cy, 24, 0, Math.PI * 2);
      ctx.fillStyle = isCaptain ? '#D97706' : '#2563EB';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = isCaptain ? '900 26px Arial, sans-serif' : '900 20px Arial, sans-serif';
      ctx.fillText(isCaptain ? 'C' : 'VC', 800, cy + (isCaptain ? 9 : 7));
    }

    // Role / team label
    ctx.textAlign = 'right';
    ctx.fillStyle = '#93C5FD';
    ctx.font = '700 24px Arial, sans-serif';
    const label = (p.role || p.team_name || '').toUpperCase();
    ctx.fillText(fitText(ctx, label, 160), CARD_W - 100, cy + 9);
  });

  // Footer
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 1262);
  ctx.lineTo(CARD_W - 120, 1262);
  ctx.stroke();
  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 24px Arial, sans-serif';
  ctx.fillText('CAPTAIN 2× POINTS  •  VICE-CAPTAIN 1.5× POINTS', CARD_W / 2, 1300);
  ctx.fillStyle = '#F59E0B';
  ctx.font = '900 26px Arial, sans-serif';
  ctx.fillText('primedreems — Play. Win. Repeat.', CARD_W / 2, 1332);
}

export default function TeamShareCard({
  open,
  onClose,
  teamName,
  matchTitle,
  players,
  captainName,
  viceCaptainName,
}: TeamShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotice(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawShareCard(canvas, { teamName, matchTitle, players, captainName, viceCaptainName });
  }, [open, teamName, matchTitle, players, captainName, viceCaptainName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fileName = `${(teamName || 'prime-dreems-team')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'prime-dreems-team'}.png`;

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleDownload = () => {
    setNotice(null);
    if (!downloadPng()) setNotice('Could not generate the PNG. Please try again.');
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas || sharing) return;
    setSharing(true);
    setNotice(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not generate image');
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (data?: { files?: File[] }) => boolean };
      if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${teamName} — Prime Dreems`,
          text: `Check out my team "${teamName}"${matchTitle ? ` for ${matchTitle}` : ''} on Prime Dreems!`,
        });
      } else if (downloadPng()) {
        setNotice('Sharing is not supported on this device — the PNG was downloaded instead.');
      } else {
        setNotice('Sharing is not supported and the PNG could not be generated.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled the native share sheet — nothing to do.
      } else if (downloadPng()) {
        setNotice('Could not open the share sheet — the PNG was downloaded instead.');
      } else {
        setNotice('Unable to share this team card on this device.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card preview */}
        <div className="relative rounded-2xl border-2 border-[#D97706]/60 bg-gradient-to-b from-[#0F172A] via-[#1E3A8A] to-[#0F172A] p-5 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>

          <div className="text-center space-y-1 pb-3 border-b border-white/15">
            <p className="text-xl font-black tracking-wide text-[#F59E0B]">PRIME DREEMS</p>
            <p className="text-[10px] font-black tracking-[0.3em] text-[#93C5FD]">FANTASY CRICKET</p>
          </div>

          <div className="text-center py-3">
            <p className="text-lg font-black text-white break-words">{teamName || 'My Team'}</p>
            {matchTitle && <p className="text-xs font-bold text-[#CBD5E1] mt-0.5">{matchTitle}</p>}
            <p className="text-[10px] font-black tracking-widest text-[#F59E0B] mt-2">— PLAYING XI —</p>
          </div>

          <div className="space-y-1.5">
            {players.slice(0, 11).map((p, i) => {
              const isCaptain = !!captainName && p.name === captainName;
              const isVice = !!viceCaptainName && p.name === viceCaptainName;
              return (
                <div
                  key={`${p.name}-${i}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                    isCaptain
                      ? 'bg-[#D97706]/20 border-[#F59E0B]/60'
                      : isVice
                        ? 'bg-[#2563EB]/25 border-[#3B82F6]/50'
                        : 'bg-white/10 border-white/15'
                  }`}
                >
                  <span className="text-[10px] font-black text-[#64748B] font-mono w-5 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{p.name}</span>
                  {(isCaptain || isVice) && (
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                        isCaptain ? 'bg-[#D97706]' : 'bg-[#2563EB]'
                      }`}
                    >
                      {isCaptain ? 'C' : 'VC'}
                    </span>
                  )}
                  {(p.role || p.team_name) && (
                    <span className="shrink-0 text-[10px] font-black uppercase text-[#93C5FD]">
                      {p.role || p.team_name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center pt-3 mt-3 border-t border-white/15 space-y-0.5">
            <p className="text-[10px] font-bold text-[#94A3B8]">CAPTAIN 2× POINTS • VICE-CAPTAIN 1.5× POINTS</p>
            <p className="text-xs font-black text-[#F59E0B]">primedreems — Play. Win. Repeat.</p>
          </div>
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-[#FFFBEB] border-2 border-[#FDE68A] text-[#92400E] text-xs font-bold">
            {notice}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="prime-btn-3d flex-1 !py-2.5 text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            <span>{sharing ? 'Sharing...' : 'Share'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="prime-btn-gold-3d flex-1 !py-2.5 text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>
        </div>

        {/* Hidden canvas used to rasterize the shareable PNG */}
        <canvas ref={canvasRef} width={CARD_W} height={CARD_H} className="hidden" />
      </div>
    </div>
  );
}