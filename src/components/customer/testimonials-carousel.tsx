'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Public testimonials carousel — shows only approved + rating >= 4.5 reviews.
 * Auto-rotates every 6 seconds, pauses on hover, allows manual navigation.
 * Includes dots indicator + arrow controls.
 */
export function TestimonialsCarousel() {
  const getPublicTestimonials = useStore((s) => s.getPublicTestimonials)
  const testimonials = useMemo(() => getPublicTestimonials(), [getPublicTestimonials])

  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [paused, setPaused] = useState(false)

  const count = testimonials.length

  const goNext = useCallback(() => {
    setDirection(1)
    setIndex((i) => (i + 1) % Math.max(count, 1))
  }, [count])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setIndex((i) => (i - 1 + Math.max(count, 1)) % Math.max(count, 1))
  }, [count])

  // Auto-rotate every 6 seconds (pauses on hover)
  useEffect(() => {
    if (paused || count <= 1) return
    const t = setInterval(goNext, 6000)
    return () => clearInterval(t)
  }, [paused, count, goNext])

  // Empty state — show nothing if no testimonials yet
  if (count === 0) return null

  const current = testimonials[index % count]

  return (
    <section
      id="testimonials"
      className="bg-navy-gradient py-20 text-white scroll-mt-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-gold-200 ring-1 ring-gold-400/30">
            <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
            <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
            <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
            <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
            <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
            <span className="ml-1.5 tracking-wide">Verified Lagos customers</span>
          </div>
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Loved by Lagos.
          </h2>
          <p className="mt-2 max-w-xl mx-auto text-navy-100/80">
            Real feedback from customers who trusted us with their garments.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative mt-12">
          {/* Background quote icon */}
          <Quote className="pointer-events-none absolute -top-6 left-1/2 -z-0 h-16 w-16 -translate-x-1/2 text-gold-400/10" />

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto max-w-3xl text-center"
            >
              {/* Stars */}
              <div className="mb-5 flex justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-5 w-5',
                      current.rating >= star
                        ? 'fill-gold-400 text-gold-400'
                        : 'fill-transparent text-gold-400/30'
                    )}
                  />
                ))}
              </div>

              {/* Comment */}
              <blockquote className="font-serif text-xl leading-relaxed text-white/95 sm:text-2xl sm:leading-relaxed">
                &ldquo;{current.comment}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="mt-6 flex flex-col items-center gap-1">
                <p className="text-base font-semibold tracking-wide text-gold-200">
                  {current.displayName}
                </p>
                {current.displayLocation && (
                  <p className="text-xs uppercase tracking-[0.15em] text-navy-100/60">
                    {current.displayLocation}
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Arrows (desktop only — touch users swipe) */}
          {count > 1 && (
            <>
              <button
                onClick={goPrev}
                aria-label="Previous testimonial"
                className="absolute left-0 top-1/2 hidden -translate-y-1/2 rounded-full p-2 text-navy-100/70 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-white md:block"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={goNext}
                aria-label="Next testimonial"
                className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-full p-2 text-navy-100/70 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-white md:block"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Dots */}
          {count > 1 && (
            <div className="mt-10 flex justify-center gap-1.5">
              {testimonials.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setDirection(i > index ? 1 : -1)
                    setIndex(i)
                  }}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-6 bg-gold-400' : 'w-1.5 bg-white/20 hover:bg-white/40'
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
