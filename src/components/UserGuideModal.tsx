import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Command, FolderPlus, CheckCircle, ExternalLink, ArrowRight, ArrowLeft, X, Sparkles } from 'lucide-react'
import MarkbelLogo from './MarkbelLogo'

interface UserGuideModalProps {
  onClose: () => void
}

export default function UserGuideModal({ onClose }: UserGuideModalProps) {
  const [step, setStep] = useState(0)

  // Avoid scrolling when open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const steps = [
    {
      title: 'Welcome to Markbel',
      icon: <Sparkles className="w-8 h-8 text-amber-500" />,
      content: 'Your unified bookmarks vault. Markbel is designed to be fast, beautiful, and distraction-free. Let us show you around in a few quick steps.',
    },
    {
      title: 'Quick Save Anywhere',
      icon: <Command className="w-8 h-8 text-blue-500" />,
      content: 'Save links instantly. Copy any link to your clipboard, then press Ctrl+Shift+B anywhere in the app to quickly add it to your vault.',
    },
    {
      title: 'Organize with Groups',
      icon: <FolderPlus className="w-8 h-8 text-amber-500" />,
      content: 'Keep your vault tidy. Create custom groups to categorize your bookmarks. Use vibrant colors to visually distinguish them.',
    },
    {
      title: 'TickTick Integration',
      icon: <CheckCircle className="w-8 h-8 text-blue-500" />,
      content: 'Never forget to read an article. Connect your TickTick account in Settings to automatically sync reminders for your saved links.',
    },
    {
      title: 'You are all set!',
      icon: <BookOpen className="w-8 h-8 text-amber-500" />,
      content: 'Start building your knowledge base today. Your links are securely stored and readily accessible whenever you need them.',
    }
  ]

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      onClose()
    }
  }

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-white border border-[var(--color-border-default)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header pattern */}
        <div className="h-24 bg-gradient-to-br from-amber-50 to-blue-50 border-b border-[var(--color-border-default)] flex items-center justify-center relative overflow-hidden">
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.1) 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
           <MarkbelLogo size={48} className="text-amber-500 relative z-10" />
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 flex-1 flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-element)] border border-[var(--color-border-default)] flex items-center justify-center mb-6 shadow-sm">
                {steps[step].icon}
              </div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
                {steps[step].title}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-[280px]">
                {steps[step].content}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer / Controls */}
        <div className="p-6 bg-[var(--color-bg-element)] border-t border-[var(--color-border-default)] flex items-center justify-between">
          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-amber-500' : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={prevStep}
                className="btn-secondary px-3 py-2 text-sm font-semibold"
              >
                Back
              </button>
            )}
            <button
              onClick={nextStep}
              className="btn-primary px-4 py-2 text-sm font-bold flex items-center gap-1.5"
            >
              {step === steps.length - 1 ? (
                <>Get Started <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Next <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
