'use client';

import { AnimatedLogo } from './AnimatedLogo';
import { Equalizer } from './Equalizer';

interface LoadingScreenProps {
  fullScreen?: boolean;
  message?: string;
}

function FullScreenLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-black overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 blur-3xl rounded-full" />
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/30 blur-2xl scale-150" />
        <AnimatedLogo size={100} showText />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Equalizer bars={4} color="blue" className="h-5" />
        <Equalizer bars={4} color="blue" className="h-5" />
        <Equalizer bars={4} color="blue" className="h-5" />
      </div>

      {message && <p className="mt-4 text-sm text-white/70">{message}</p>}
    </div>
  );
}

function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 blur-xl scale-150" />
        <AnimatedLogo size={72} showText />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Equalizer bars={3} color="blue" className="h-4" />
        <Equalizer bars={3} color="blue" className="h-4" />
        <Equalizer bars={3} color="blue" className="h-4" />
      </div>

      {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
    </div>
  );
}

export function LoadingScreen({ fullScreen = true, message }: LoadingScreenProps) {
  if (fullScreen) {
    return <FullScreenLoader message={message} />;
  }
  return <InlineLoader message={message} />;
}
