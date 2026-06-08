"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Mobile-first camera barcode reader. Uses the BarcodeDetector API (native on
// Android Chrome; WASM/ZXing fallback elsewhere incl. iOS via the ponyfill).
// Auto-fires on the first detection, with haptic + beep feedback. Torch toggle
// when the device supports it. Full-screen modal for warehouse phone use.

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "codabar",
  "itf",
  "qr_code",
] as const;

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not allowed — ignore */
  }
}

export function CameraScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const firedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Keep the latest onScan without restarting the camera on new identities.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      /* torch unsupported — ignore */
    }
  }, [torchOn]);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let lastTs = 0;
    let stream: MediaStream | null = null;

    async function start() {
      try {
        const { BarcodeDetector } = await import("barcode-detector/ponyfill");
        const detector = new BarcodeDetector({ formats: [...FORMATS] });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps =
          (track.getCapabilities?.() as { torch?: boolean }) || {};
        if (caps.torch) setTorchSupported(true);

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        // playsInline is required so iOS Safari doesn't go fullscreen-native.
        video.setAttribute("playsinline", "true");
        await video.play();
        setReady(true);

        const loop = async (ts: number) => {
          if (cancelled || firedRef.current) return;
          // throttle detection to ~8fps to keep it smooth on phones
          if (ts - lastTs > 120 && video.readyState >= 2) {
            lastTs = ts;
            try {
              const codes = await detector.detect(video);
              const value = codes?.[0]?.rawValue;
              if (value) {
                firedRef.current = true;
                navigator.vibrate?.(120);
                beep();
                onScanRef.current(value);
                return;
              }
            } catch {
              /* per-frame decode errors are normal */
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Actívalo en los ajustes del navegador."
            : e instanceof Error
              ? e.message
              : "No se pudo abrir la cámara",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-semibold">Escanear código</span>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium active:bg-white/25"
        >
          Cerrar
        </button>
      </div>

      {/* camera area */}
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="rounded-lg bg-red-500/90 px-4 py-3 text-center text-sm text-white">
              {error}
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              autoPlay
              playsInline
            />
            {/* scan box overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-72 max-w-[80vw] rounded-xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-white/80">
                Abriendo cámara…
              </div>
            )}
          </>
        )}
      </div>

      {/* bottom controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-5">
        {torchSupported && (
          <button
            onClick={toggleTorch}
            className={`rounded-full px-5 py-3 text-sm font-semibold ${
              torchOn ? "bg-yellow-400 text-black" : "bg-white/15 text-white"
            }`}
          >
            🔦 Linterna
          </button>
        )}
        <p className="text-center text-sm text-white/70">
          Centra el código en el recuadro
        </p>
      </div>
    </div>
  );
}
