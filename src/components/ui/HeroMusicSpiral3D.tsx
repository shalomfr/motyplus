"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const VIDEO_SRC = "/videos/hero-object-video.mp4";
const POSTER_SRC = "/images/hero-music-art.webp";

type HeroVariant = "hero-cover" | "embed";

interface HeroMusicSpiral3DProps {
  variant?: HeroVariant;
}

function scheduleRevealAfterFirstPaint(
  video: HTMLVideoElement,
  onReveal: () => void
): () => void {
  const typed = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (
      cb: (now: number, meta: unknown) => void
    ) => number;
    cancelVideoFrameCallback?: (id: number) => void;
  };

  let finished = false;
  let vfcId: number | null = null;
  let rafOuter: number | null = null;
  const fallbackMs = 320;

  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timeoutId);
    if (rafOuter !== null) cancelAnimationFrame(rafOuter);
    if (
      vfcId !== null &&
      typeof typed.cancelVideoFrameCallback === "function"
    ) {
      typed.cancelVideoFrameCallback(vfcId);
    }
    onReveal();
  };

  const timeoutId = window.setTimeout(finish, fallbackMs);

  if (typeof typed.requestVideoFrameCallback === "function") {
    vfcId = typed.requestVideoFrameCallback(() => {
      rafOuter = requestAnimationFrame(finish);
    });
  } else {
    rafOuter = requestAnimationFrame(() => {
      requestAnimationFrame(finish);
    });
  }

  return () => {
    finished = true;
    window.clearTimeout(timeoutId);
    if (rafOuter !== null) cancelAnimationFrame(rafOuter);
    if (
      vfcId !== null &&
      typeof typed.cancelVideoFrameCallback === "function"
    ) {
      typed.cancelVideoFrameCallback(vfcId);
    }
  };
}

const COVER_SHIFT_OUTER =
  "absolute inset-0 origin-center scale-[1.12] motion-safe:translate-x-[7%]";
const COVER_SHIFT_INNER = "relative h-full w-full";

function CoverPosterImg() {
  return (
    <img
      src={POSTER_SRC}
      alt=""
      width={1920}
      height={1080}
      decoding="sync"
      fetchPriority="high"
      loading="eager"
      className="absolute inset-0 h-full w-full object-cover"
      style={{ backgroundColor: "#0F508E" }}
      aria-hidden
    />
  );
}

export function HeroMusicSpiral3D({ variant = "hero-cover" }: HeroMusicSpiral3DProps) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const revealCleanupRef = useRef<(() => void) | null>(null);
  const revealPendingRef = useRef(false);

  const [isClient, setIsClient] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const resetReveal = useCallback(() => {
    revealCleanupRef.current?.();
    revealCleanupRef.current = null;
    revealPendingRef.current = false;
    setVideoVisible(false);
  }, []);

  useEffect(() => {
    resetReveal();
  }, [reduceMotion, resetReveal]);

  useEffect(() => {
    return () => {
      revealCleanupRef.current?.();
      revealCleanupRef.current = null;
    };
  }, []);

  const handlePlaying = useCallback(() => {
    const el = videoRef.current;
    if (!el || revealPendingRef.current) return;
    revealPendingRef.current = true;
    revealCleanupRef.current?.();
    revealCleanupRef.current = scheduleRevealAfterFirstPaint(el, () => {
      setVideoVisible(true);
      revealCleanupRef.current = null;
      revealPendingRef.current = false;
    });
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduceMotion || variant !== "embed") return;
    void el.play().catch(() => {});
  }, [reduceMotion, variant]);

  if (variant === "hero-cover") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {reduceMotion ? (
          <div className={COVER_SHIFT_OUTER}>
            <div className={COVER_SHIFT_INNER}>
              <Image
                src={POSTER_SRC}
                alt="רקע ויזואלי — אובייקטים מוזיקליים"
                fill
                priority
                className="object-cover"
                sizes="100vw"
              />
            </div>
          </div>
        ) : (
          <div className={COVER_SHIFT_OUTER}>
            <div className={COVER_SHIFT_INNER}>
              <CoverPosterImg />
              {isClient ? (
                <video
                  ref={videoRef}
                  className={cn(
                    "absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-[2000ms] ease-in-out [transform:translateZ(0)] [backface-visibility:hidden]",
                    videoVisible ? "opacity-100" : "opacity-0"
                  )}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  onPlaying={handlePlaying}
                  aria-hidden
                >
                  <source src={VIDEO_SRC} type="video/mp4" />
                </video>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-[220px] w-full max-w-[min(100%,420px)] items-center justify-center sm:h-[260px] sm:max-w-[480px]">
      <div
        className="pointer-events-none absolute inset-0 opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(26,106,181,0.18) 0%, transparent 62%)",
        }}
        aria-hidden
      />
      {reduceMotion ? (
        <Image
          src={POSTER_SRC}
          alt="איור סגנון תלת־ממדי של כלי מיתר וספירלה מוזיקלית"
          width={1000}
          height={1000}
          className="relative z-[1] h-full w-full object-contain drop-shadow-[0_12px_40px_rgba(15,80,142,0.12)]"
          priority
          sizes="(max-width: 640px) 100vw, 480px"
        />
      ) : (
        <div className="relative z-[1] h-full w-full">
          <Image
            src={POSTER_SRC}
            alt=""
            width={1000}
            height={1000}
            className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_12px_40px_rgba(15,80,142,0.12)]"
            priority
            sizes="(max-width: 640px) 100vw, 480px"
            aria-hidden
          />
          <video
            ref={videoRef}
            className={cn(
              "relative h-full w-full object-contain drop-shadow-[0_12px_40px_rgba(15,80,142,0.12)] transition-opacity duration-[2000ms] ease-in-out [transform:translateZ(0)]",
              videoVisible ? "opacity-100" : "opacity-0"
            )}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onPlaying={handlePlaying}
            aria-label="אנימציה תלת־ממדית של אובייקטים מוזיקליים"
          >
            <source src={VIDEO_SRC} type="video/mp4" />
          </video>
        </div>
      )}
    </div>
  );
}
