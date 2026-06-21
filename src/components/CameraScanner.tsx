"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flashlight, X, ScanLine, Keyboard } from "lucide-react";

// Compact, EMBEDDED camera barcode reader (renders inline in the form — not a
// full-screen takeover). Prefers the NATIVE BarcodeDetector (Android Chrome and
// others) for speed/reliability, and falls back to the WASM ponyfill (iOS) only
// when there's no native support. Auto-fires on first detection; also offers a
// manual "Capturar" button and a "Escribir a mano" escape hatch.

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

type DetectedBarcode = { rawValue: string };
interface Detector {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

// Native first (fast, no WASM download); ponyfill (ZXing WASM) only as fallback.
async function getDetector(): Promise<Detector> {
  const w = window as unknown as {
    BarcodeDetector?: {
      new (opts?: { formats?: string[] }): Detector;
      getSupportedFormats?: () => Promise<string[]>;
    };
  };
  if (w.BarcodeDetector) {
    try {
      const supported = (await w.BarcodeDetector.getSupportedFormats?.()) ?? [];
      const fmts = FORMATS.filter((f) => supported.includes(f));
      if (fmts.length) return new w.BarcodeDetector({ formats: fmts });
    } catch {
      /* fall through to the ponyfill */
    }
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: [...FORMATS] }) as unknown as Detector;
}

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
  const detectorRef = useRef<Detector | null>(null);
  const firedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const fire = useCallback((value: string) => {
    if (firedRef.current) return;
    firedRef.current = true;
    navigator.vibrate?.(120);
    beep();
    onScanRef.current(value);
  }, []);

  // Manual capture — force one detection on the current frame. Useful if the
  // auto loop is struggling (low light, blur, slow device).
  const captureNow = useCallback(async () => {
    const video = videoRef.current;
    const det = detectorRef.current;
    if (!video || !det || firedRef.current) return;
    try {
      const codes = await det.detect(video);
      const value = codes?.[0]?.rawValue;
      if (value) fire(value);
      else setHint("No se ve un código. Acércalo, céntralo y mejora la luz.");
    } catch {
      setHint("No se pudo leer. Inténtalo de nuevo o escribe el código a mano.");
    }
  }, [fire]);

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
    let hintTimer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      try {
        const detector = await getDetector();
        detectorRef.current = detector;

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

        // After a few seconds with no hit, nudge the operator toward the manual
        // capture / hand-typing instead of leaving them stuck on a blank camera.
        hintTimer = setTimeout(() => {
          if (!firedRef.current && !cancelled) {
            setHint("¿No escanea? Pulsa “Capturar” o escribe el código a mano.");
          }
        }, 6000);

        const loop = async (ts: number) => {
          if (cancelled || firedRef.current) return;
          if (ts - lastTs > 120 && video.readyState >= 2) {
            lastTs = ts;
            try {
              const codes = await detector.detect(video);
              const value = codes?.[0]?.rawValue;
              if (value) {
                fire(value);
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
            : "No se pudo abrir la cámara. Escribe el código a mano.",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (hintTimer) clearTimeout(hintTimer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
      detectorRef.current = null;
    };
  }, [fire]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-300 bg-black">
      <div className="relative aspect-[4/3] w-full">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
            <p className="text-center text-sm text-white/90">{error}</p>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black"
            >
              <Keyboard className="h-4 w-4" /> Escribir a mano
            </button>
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
            {hint && (
              <div className="absolute inset-x-0 top-0 bg-amber-400/95 px-3 py-1.5 text-center text-[12px] font-medium text-amber-950">
                {hint}
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

        {/* manual capture — the "scan now" button the operator can rely on */}
        {!error && ready && (
          <button
            onClick={captureNow}
            aria-label="Capturar código"
            className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-black shadow active:scale-95"
          >
            <ScanLine className="h-4 w-4" /> Capturar
          </button>
        )}
      </div>
      <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5">
        <span className="text-xs text-white/70">
          Centra el código · se captura solo
        </span>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 text-xs font-semibold text-white/90 underline underline-offset-2"
        >
          <Keyboard className="h-3.5 w-3.5" /> Escribir a mano
        </button>
      </div>
    </div>
  );
}
