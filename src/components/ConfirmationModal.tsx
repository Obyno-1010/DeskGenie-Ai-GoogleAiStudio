import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'danger'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md pointer-events-none"
          >
            <GlassCard className="p-8 rounded-[2.5rem] border-white/10 shadow-2xl pointer-events-auto">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  type === 'danger' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                } border border-current shadow-lg shadow-current/10`}>
                  {type === 'danger' ? <Trash2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
                  <p className="text-slate-400 leading-relaxed font-medium">
                    {message}
                  </p>
                </div>

                <div className="flex w-full gap-4 pt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 px-6 rounded-2xl bg-white/5 text-slate-300 font-bold hover:bg-white/10 border border-white/10 transition-all uppercase tracking-widest text-[10px]"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                    className={`flex-1 py-4 px-6 rounded-2xl font-bold text-white transition-all uppercase tracking-widest text-[10px] shadow-lg ${
                      type === 'danger' 
                        ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                    }`}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
