import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Crop, FileText, ChevronRight } from 'lucide-react';

interface OnboardingScreensProps {
  onComplete: () => void;
}

const screens = [
  {
    icon: Camera,
    title: 'Scan Documents',
    description: 'Quickly capture documents with your camera and get crystal clear scans',
    color: 'text-blue-600'
  },
  {
    icon: Crop,
    title: 'Edit & Enhance',
    description: 'Crop, rotate, and apply filters to perfect your scanned documents',
    color: 'text-purple-600'
  },
  {
    icon: FileText,
    title: 'Save & Share PDF',
    description: 'Export as PDF and share documents instantly with anyone',
    color: 'text-green-600'
  }
];

export function OnboardingScreens({ onComplete }: OnboardingScreensProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < screens.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="h-screen w-full bg-white flex flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="text-gray-500 hover:text-gray-700 text-sm font-medium"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon */}
            <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center mb-8">
              {(() => {
                const IconComponent = screens[currentIndex].icon;
                return <IconComponent className={`w-16 h-16 ${screens[currentIndex].color}`} strokeWidth={2} />;
              })()}
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {screens[currentIndex].title}
            </h2>

            {/* Description */}
            <p className="text-gray-600 text-base leading-relaxed max-w-sm">
              {screens[currentIndex].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section */}
      <div className="p-6 pb-8">
        {/* Pagination dots */}
        <div className="flex justify-center gap-2 mb-6">
          {screens.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${index === currentIndex
                ? 'w-8 bg-blue-600'
                : 'w-2 bg-gray-300'
                }`}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {currentIndex < screens.length - 1 ? 'Next' : 'Get Started'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
