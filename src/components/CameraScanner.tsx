"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flashlight, X } from "lucide-react";

// Compact, EMBEDDED camera barcode reader (renders inline in the form — not a
// full-screen takeover). Uses the BarcodeDetector API (native on Android Chrome;
// WASM/ZXing fallback on iOS via the ponyfill). Auto-fires on first detection
// with haptic + beep feedback. Torch toggle when supported.

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
        const caps = (track.getCapabilities?.() as { torch?: boolean }) || {};
        if (caps.torch) setTorchSupported(true);

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        setReady(true);

        const loop = async (ts: number) => {
          if (cancelled || firedRef.current) return;
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
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-300 bg-black">
      <div className="relative aspect-[4/3] w-full">
        {error ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-center text-sm text-white/90">{error}</p>
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
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-52 max-w-[80%] rounded-lg border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                Abriendo cámara…
              </div>
            )}
          </>
        )}

        {/* close */}
        <button
          onClick={onClose}
          aria-label="Cerrar cámara"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white active:bg-black/80"
        >
          <X className="h-5 w-5" />
        </button>

        {/* torch */}
        {torchSupported && (
          <button
            onClick={toggleTorch}
            className={`absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
              torchOn ? "bg-yellow-400 text-black" : "bg-black/60 text-white"
            }`}
          >
            <Flashlight className="h-4 w-4" /> Linterna
          </button>
        )}
      </div>
      <p className="bg-slate-900 py-1.5 text-center text-xs text-white/70">
        Centra el código en el recuadro · se captura solo
      </p>
    </div>
  );
}
