"use client";

import { useEffect, useId, useRef, useState } from "react";

// Camera barcode/QR fallback using html5-qrcode. The USB gun is the primary
// path; this modal is the backup. Stops the camera cleanly on close/unmount.
export function CameraScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const reactId = useId();
  const containerId = `qr-reader-${reactId.replace(/:/g, "")}`;
  const [error, setError] = useState<string | null>(null);

  // Keep the latest onScan without restarting the camera when the parent
  // passes a new inline callback identity.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let cancelled = false;
    let fired = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode(containerId);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 160 } },
          (decoded) => {
            if (fired) return;
            fired = true;
            onScanRef.current(decoded);
          },
          () => {
            /* per-frame decode errors are normal; ignore */
          },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo abrir la cámara");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner?.clear())
          .catch(() => {});
      }
    };
  }, [containerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Escanear con cámara</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : (
          <div id={containerId} className="overflow-hidden rounded-lg bg-black" />
        )}
        <p className="mt-3 text-center text-xs text-slate-400">
          Apunta al código de barras
        </p>
      </div>
    </div>
  );
}
