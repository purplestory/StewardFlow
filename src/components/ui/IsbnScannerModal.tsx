"use client";

import { useEffect, useRef, useState } from "react";

type IsbnScannerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (isbn: string) => void;
};

const BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
];

function normalizeIsbn(raw: string): string | null {
  const only = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (only.length === 10 || only.length === 13) return only;
  return null;
}

export default function IsbnScannerModal({
  open,
  onOpenChange,
  onDetected,
}: IsbnScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScanAtRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    const barcodeDetectorCtor = typeof window !== "undefined" ? window.BarcodeDetector : undefined;

    const stop = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setReady(false);
    };

    const start = async () => {
      if (!barcodeDetectorCtor) {
        setError("이 브라우저는 바코드 스캔을 지원하지 않습니다. ISBN을 직접 입력해주세요.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const detector = new barcodeDetectorCtor({ formats: BARCODE_FORMATS });

        const scan = async () => {
          if (!mounted || !videoRef.current) return;

          const now = Date.now();
          if (now - lastScanAtRef.current < 250) {
            frameRef.current = requestAnimationFrame(() => {
              void scan();
            });
            return;
          }
          lastScanAtRef.current = now;

          try {
            const results = await detector.detect(videoRef.current);
            for (const item of results) {
              const normalized = normalizeIsbn(item.rawValue ?? "");
              if (normalized) {
                onDetected(normalized);
                onOpenChange(false);
                stop();
                return;
              }
            }
          } catch {
            // 스캔 프레임 오류는 무시하고 다음 프레임 계속
          }

          frameRef.current = requestAnimationFrame(() => {
            void scan();
          });
        };

        frameRef.current = requestAnimationFrame(() => {
          void scan();
        });
      } catch {
        setError("카메라 접근에 실패했습니다. 카메라 권한을 허용한 뒤 다시 시도해주세요.");
      }
    };

    void start();

    return () => {
      mounted = false;
      stop();
    };
  }, [onDetected, onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-surface max-w-lg space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">ISBN 바코드 스캔</h3>
            <p className="mt-1 text-xs text-neutral-500">
              책 뒷면 바코드(ISBN-13 또는 ISBN-10)를 카메라에 맞춰주세요.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => onOpenChange(false)}
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-black">
          <video ref={videoRef} className="h-[300px] w-full object-cover" playsInline muted />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm text-white">
              카메라 준비 중...
            </div>
          )}
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        ) : (
          <p className="text-xs text-neutral-500">
            인식이 어려우면 조명을 밝게 하고 바코드와 카메라 거리를 조정하세요.
          </p>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn-ghost" onClick={() => onOpenChange(false)}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
