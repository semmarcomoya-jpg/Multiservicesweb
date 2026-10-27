/** Video de una historia en el navegador. Avisa del progreso y del final. */
import React, { useEffect, useRef } from 'react';

export interface StoryVideoProps {
  uri: string;
  paused: boolean;
  onProgress: (fraction: number) => void;
  onEnd: () => void;
}

export function StoryVideo({ uri, paused, onProgress, onEnd }: StoryVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, uri]);
  return (
    <video
      key={uri}
      ref={ref}
      src={uri}
      autoPlay
      playsInline
      // Empieza sin sonido: los navegadores no dejan reproducir con sonido sin un toque antes.
      muted
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (v.duration > 0) onProgress(v.currentTime / v.duration);
      }}
      onEnded={onEnd}
      onError={onEnd}
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
    />
  );
}
