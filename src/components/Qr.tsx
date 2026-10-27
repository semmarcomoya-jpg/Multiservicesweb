/** Código QR (para la tarjeta del cliente) y lector de QR con la cámara (para el mostrador). */
import qrcode from 'qrcode-generator';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Text } from '@/components/Text';
import { Btn } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const q = qrcode(0, 'M');
  q.addData(value || '-');
  q.make();
  const svg = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  return (
    <View accessibilityRole="image" accessibilityLabel={'QR ' + value} style={{ width: size, height: size, backgroundColor: '#fff' }}>
      <SvgXml xml={svg} width={size} height={size} />
    </View>
  );
}

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** Abre la cámara y lee el QR de la tarjeta (navegadores con BarcodeDetector: Chrome en Android, Edge, Samsung). */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const { L } = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (Platform.OS !== 'web') return setErr(L('Escribe el número de cliente.', 'Type the member number.'));
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD) return setErr(L('Este navegador no puede leer QR. Usa Chrome en Android o escribe el número de cliente (CM-…).', 'This browser cannot scan QR. Use Chrome on Android or type the member number (CM-…).'));
    let stream: MediaStream | null = null;
    let alive = true;
    const det = new BD({ formats: ['qr_code'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = videoRef.current;
        if (!v || !alive) return;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (!alive) return;
          try {
            const r = await det.detect(v);
            const code = r[0]?.rawValue?.trim();
            if (code) {
              alive = false;
              onCode(code);
              return;
            }
          } catch {
            /* sigue intentando */
          }
          setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setErr(L('No pudimos abrir la cámara. Da permiso o escribe el número de cliente.', "Couldn't open the camera. Allow access or type the member number."));
      }
    })();
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ gap: 10, alignItems: 'center' }}>
      {err ? (
        <Text style={{ color: C.red, fontWeight: '700', textAlign: 'center' }}>{err}</Text>
      ) : (
        <View style={{ width: '100%', maxWidth: 360, aspectRatio: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
          {React.createElement('video', { ref: videoRef, muted: true, playsInline: true, style: { width: '100%', height: '100%', objectFit: 'cover' } })}
          <View pointerEvents="none" style={{ position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%', borderWidth: 3, borderColor: C.gold, borderRadius: 18 }} />
        </View>
      )}
      <Btn small kind="ghost" title={L('Cerrar cámara', 'Close camera')} onPress={onClose} />
    </View>
  );
}
