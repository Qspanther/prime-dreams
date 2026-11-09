'use client';

import { useEffect, useState } from 'react';
import { resolvePlayerPhoto } from '../../lib/api';

export default function PlayerPhoto({ name, photoUrl, boxClass }: { name: string; photoUrl?: string | null; boxClass: string }) {
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [photoUrl]);
  const src = stage === 0
    ? resolvePlayerPhoto(photoUrl, name)
    : stage === 1
    ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name)}`
    : '';
  return (
    <div className={`flex items-center justify-center overflow-hidden shrink-0 ${boxClass}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setStage((s) => s + 1)}
        />
      ) : (
        <span className="font-black">{name?.charAt(0) || '?'}</span>
      )}
    </div>
  );
}