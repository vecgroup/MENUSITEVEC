
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, X, PartyPopper, Sparkles, Star, Rocket, Trophy as TrophyIcon } from 'lucide-react';
import { Goal } from '../types';

interface GoalCelebrationModalProps {
  goal: Goal;
  onClose: () => void;
}

const GoalCelebrationModal: React.FC<GoalCelebrationModalProps> = ({ goal, onClose }) => {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl"
          onClick={onClose}
        />

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: window.innerHeight + 100,
                rotate: 0,
                scale: 0
              }}
              animate={{ 
                y: -100,
                rotate: 360,
                scale: [0, 1, 1, 0],
                x: (Math.random() - 0.5) * 200 + (Math.random() * window.innerWidth)
              }}
              transition={{ 
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 5,
                ease: "linear"
              }}
              className="absolute"
            >
              {i % 3 === 0 ? (
                <Star className="text-amber-400" size={Math.random() * 20 + 10} />
              ) : i % 3 === 1 ? (
                <Sparkles className="text-blue-400" size={Math.random() * 20 + 10} />
              ) : (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ scale: 0.5, opacity: 0, y: 100 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] sm:rounded-[4rem] p-8 sm:p-12 text-center relative z-10 shadow-[0_0_100px_rgba(0,161,228,0.3)] border border-white/10"
        >
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 h-32 bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 rounded-[2.5rem] shadow-2xl flex items-center justify-center border-8 border-white dark:border-slate-900"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Trophy size={56} className="text-white drop-shadow-xl" />
            </motion.div>
          </motion.div>

          <div className="mt-16 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center justify-center space-x-3 text-emerald-500 mb-4">
                <PartyPopper size={24} className="animate-bounce" />
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter italic">Meta Batida!</h2>
                <PartyPopper size={24} className="animate-bounce" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{goal.title}</h3>
              <p className="text-slate-400 dark:text-slate-500 font-bold text-xs sm:text-sm mt-4 uppercase tracking-[0.2em]">Conquista épica alcançada pela VEC GROUP</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-slate-700 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 relative z-10">Resultado Final</p>
              <p className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tighter relative z-10">100%</p>
              <div className="mt-6 flex justify-center space-x-3 relative z-10">
                {[1,2,3,4,5].map(i => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + (i * 0.1), type: "spring" }}
                  >
                    <Star size={24} className="text-amber-400 fill-amber-400" />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-slate-600 dark:text-slate-400 font-medium px-4 sm:px-8 leading-relaxed italic text-sm sm:text-base"
            >
              "O sucesso não é o fim, mas sim o combustível para o próximo desafio. Parabéns, {goal.assignedTo}, você provou ser um verdadeiro campeão!"
            </motion.p>

            <motion.button 
              whileHover={{ scale: 1.02, backgroundColor: "#000" }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="w-full py-5 sm:py-6 bg-slate-900 dark:bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center space-x-3"
            >
              <Rocket size={18} />
              <span>Continuar Voando Alto</span>
            </motion.button>
          </div>

          <button 
            onClick={onClose} 
            className="absolute top-8 right-8 p-3 text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GoalCelebrationModal;
