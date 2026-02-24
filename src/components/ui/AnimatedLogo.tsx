'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface AnimatedLogoProps {
  size?: number;
  showText?: boolean;
}

export function AnimatedLogo({ size = 80, showText = false }: AnimatedLogoProps) {
  const ballSize = size * 0.16;
  const ballTop = size * 0.17;
  const ballRight = size * 0.34;

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        className="relative"
        style={{ width: size, height: size }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 300 }}
        aria-label="לוגו MotyPlus"
      >
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-40"
          style={{ background: '#1e40af' }}
        />

        <Image
          src="/logo.png"
          alt="MotyPlus"
          width={size}
          height={size}
          className="relative z-10 rounded-full"
          priority
        />

        <motion.div
          className="absolute z-20 rounded-full overflow-hidden bg-white shadow-lg"
          style={{
            width: ballSize,
            height: ballSize,
            top: ballTop,
            right: ballRight,
          }}
          animate={{
            y: [0, -8, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatDelay: 0.8,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      {showText && (
        <motion.span
          className="text-sm text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          טוען...
        </motion.span>
      )}
    </div>
  );
}
