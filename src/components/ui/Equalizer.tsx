'use client';

type EqualizerColor = 'cyan' | 'purple' | 'pink' | 'green' | 'blue';

interface EqualizerProps {
  bars?: number;
  className?: string;
  isPlaying?: boolean;
  color?: EqualizerColor;
}

const COLOR_CLASSES: Record<EqualizerColor, string> = {
  cyan: 'bg-cyan-400',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
};

export function Equalizer({
  bars = 5,
  className,
  isPlaying = true,
  color = 'cyan',
}: EqualizerProps) {
  const rootClassName = ['flex items-end gap-0.5 h-6', className].filter(Boolean).join(' ');
  const barBase = ['w-1 rounded-full transition-all', COLOR_CLASSES[color]].join(' ');

  return (
    <div className={rootClassName} aria-hidden="true">
      {Array.from({ length: bars }).map((_, index) => (
        <div
          key={`bar-${color}-${index}`}
          className={`${barBase} ${isPlaying ? 'equalizer-bar' : 'h-1'}`}
          style={{
            animationDelay: `${index * 0.1}s`,
            height: isPlaying ? undefined : '4px',
          }}
        />
      ))}
    </div>
  );
}
