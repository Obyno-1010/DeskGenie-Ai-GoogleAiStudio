import { motion } from 'framer-motion';

export function VoiceWaveform({ isRecording }: { isRecording: boolean }) {
  const bars = Array.from({ length: 40 });

  return (
    <div className="flex items-center justify-center gap-1 h-32">
      {bars.map((_, i) => (
        <motion.div
          key={i}
          animate={{
            height: isRecording 
              ? [10, Math.random() * 80 + 10, 10] 
              : 8,
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.05,
            ease: "easeInOut"
          }}
          className="w-1 bg-indigo-500 rounded-full opacity-60"
        />
      ))}
    </div>
  );
}
