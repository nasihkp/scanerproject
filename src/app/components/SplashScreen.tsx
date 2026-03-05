import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete: _ }: SplashScreenProps) {
  return (
    <motion.div
      className="h-screen w-full bg-gradient-to-br from-blue-600 to-blue-700 flex flex-col items-center justify-center text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
          <ScanLine className="w-12 h-12 text-blue-600" strokeWidth={2.5} />
        </div>

        <motion.h1
          className="text-4xl font-bold mb-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          SmartScan
        </motion.h1>

        <motion.p
          className="text-blue-100 text-lg"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Scan • Edit • Save as PDF
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
