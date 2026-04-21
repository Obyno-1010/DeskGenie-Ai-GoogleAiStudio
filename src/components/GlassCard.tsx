import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  onClick?: () => void;
}

export function GlassCard({ children, className, delay = 0, onClick }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      onClick={onClick}
      className={cn(
        "glass-card p-6 relative overflow-hidden",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
