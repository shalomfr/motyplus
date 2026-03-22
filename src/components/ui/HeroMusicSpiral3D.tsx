"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const VIDEO_SRC = "/videos/hero-object-video.mp4";
const POSTER_SRC = "/images/hero-music-art.webp";

const VIDEO_FADE_MS = 450;

/** הזזה ימינה + scale כדי למלא אחרי חיתוך (overflow על ההורה) */
const COVER_SHIFT_OUTER =
  "absolute inset-0 origin-center scale-[1.12] motion-safe:translate-x-[7%]";
const COVER_SHIFT_INNER = "relative h-full w-full";

type HeroVariant = "hero-cover" | "embed";

interface HeroMusicSpiral3DProps {
  variant?: HeroVariant;
}

export function HeroMusicSpiral3D({ variant = "hero-cover" }: HeroMusicSpiral3DProps) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoVisible, setVideoVisible] = useState(false);

  const handlePlaying = useCallback(() => {
    requestAnimationFrame(() => {
      setVideoVisible(true);
    });
  }, []);

  useEffect(() => {
    setVideoVisible(false);
  }, [reduceMotion]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (reduceMotion) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      return;
    }
    void el.play().catch(() => {});
  }, [reduceMotion]);

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
              {/* פוסטר נפרד — בלי poster על ה-video כדי למנוע בזק בין תמונה לפריים ראשון */}
              <Image
                src={POSTER_SRC}
                alt=""
                fill
                priority
                className="object-cover"
                sizes="100vw"
                aria-hidden
              />
              <video
                ref={videoRef}
                className={cn(
                  "absolute inset-0 z-[1] h-full w-full object-cover transition-opacity ease-out",
                  videoVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ transitionDuration: `${VIDEO_FADE_MS}ms` }}
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
              "relative h-full w-full object-contain drop-shadow-[0_12px_40px_rgba(15,80,142,0.12)] transition-opacity ease-out",
              videoVisible ? "opacity-100" : "opacity-0"
            )}
            style={{ transitionDuration: `${VIDEO_FADE_MS}ms` }}
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
