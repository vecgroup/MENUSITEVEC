
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cake, X, PartyPopper, Sparkles, Gift, Heart, Star, Music } from 'lucide-react';
import confetti from 'canvas-confetti';
import { User } from '../types';

interface BirthdayCelebrationModalProps {
  users: User[];
  onClose: () => void;
}

const BirthdayCelebrationModal: React.FC<BirthdayCelebrationModalProps> = ({ users, onClose }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play sound
    const playSound = async () => {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'); // Party horn/celebration sound
        audio.volume = 0.4;
        audioRef.current = audio;
        await audio.play();
      } catch (err) {
        console.log('Audio playback failed:', err);
      }
    };

    playSound();

    // Confetti explosion
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (users.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-xl overflow-hidden"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0.2, 0.5, 0.2], 
                scale: [1, 1.5, 1],
                y: [0, -100, 0],
                x: [0, Math.random() * 50 - 25, 0]
              }}
              transition={{ 
                duration: 3 + Math.random() * 5, 
                repeat: Infinity,
                delay: Math.random() * 2
              }}
              className="absolute"
              style={{ 
                left: `${Math.random() * 100}%`, 
                top: `${Math.random() * 100}%`,
              }}
            >
              {i % 3 === 0 ? <Star className="text-amber-400/30" size={20} /> : 
               i % 3 === 1 ? <Heart className="text-rose-400/30" size={20} /> :
               <Sparkles className="text-blue-400/30" size={20} />}
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ scale: 0.8, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, y: 50, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className="relative w-full max-w-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(0,161,228,0.2)] overflow-hidden"
        >
          {/* Top Decorative Bar */}
          <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          
          <div className="p-8 md:p-12 text-center relative">
            {/* Floating Icons */}
            <motion.div 
              animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute top-12 left-12 text-blue-400/20 hidden md:block"
            >
              <PartyPopper size={64} />
            </motion.div>
            <motion.div 
              animate={{ y: [0, 10, 0], rotate: [0, -5, 5, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="absolute bottom-12 right-12 text-purple-400/20 hidden md:block"
            >
              <Gift size={64} />
            </motion.div>

            {/* Main Content */}
            <div className="relative z-10 space-y-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="mx-auto w-24 h-24 bg-gradient-to-br from-[#00A1E4] to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-[#00A1E4]/40 border-4 border-white/10"
              >
                <Cake size={48} className="text-white" />
              </motion.div>

              <div className="space-y-2">
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-tight"
                >
                  Feliz <span className="text-[#00A1E4]">Aniversário!</span>
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-slate-400 font-bold text-xs md:text-sm uppercase tracking-[0.4em]"
                >
                  A Família VEC GROUP celebra com você
                </motion.p>
              </div>

              {/* Users Grid */}
              <div className="flex flex-wrap justify-center gap-6 py-4">
                {users.map((u, idx) => (
                  <motion.div 
                    key={u.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + (idx * 0.1) }}
                    className="flex flex-col items-center space-y-4 group"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#00A1E4] rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                      <div className="w-28 h-28 md:w-36 md:h-36 rounded-full p-1 bg-gradient-to-tr from-[#00A1E4] via-purple-500 to-pink-500">
                        <img 
                          src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&color=fff&size=256`} 
                          className="w-full h-full rounded-full object-cover border-4 border-slate-900 shadow-2xl"
                          alt={u.name}
                        />
                      </div>
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-900 p-2.5 rounded-2xl shadow-xl z-20 border-2 border-slate-900"
                      >
                        <Gift size={20} />
                      </motion.div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">{u.name}</h3>
                      <p className="text-[9px] font-black text-[#00A1E4] uppercase tracking-widest mt-1">{u.role}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Message */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 md:p-8 border border-white/10 max-w-xl mx-auto"
              >
                <p className="text-slate-300 font-medium text-sm md:text-base leading-relaxed italic">
                  "Que este novo ciclo seja marcado por grandes conquistas, saúde e felicidade plena. Você é peça fundamental no nosso sucesso. Parabéns pelo seu dia!"
                </p>
              </motion.div>

              {/* Action */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="flex flex-col md:flex-row items-center justify-center gap-4"
              >
                <button 
                  onClick={onClose}
                  className="w-full md:w-auto px-12 py-5 bg-[#00A1E4] hover:bg-[#0081b8] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-[0_10px_30px_rgba(0,161,228,0.3)] transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <span>Vamos Comemorar!</span>
                  <PartyPopper size={16} />
                </button>
              </motion.div>
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose} 
              className="absolute top-6 right-6 p-2 text-white/20 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BirthdayCelebrationModal;
