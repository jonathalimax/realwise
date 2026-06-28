import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export default function Testimonials() {
  const testimonials = [];
  const loading = false;

  // Show placeholder if no testimonials
  if (loading || testimonials.length === 0) {
    return (
      <section data-section="testimonials" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Trusted by early users.</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Real people organizing their finances with Realwise. Check our Google reviews for more.
            </p>
            <div className="mt-8 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              <a
                href="https://g.page/realwise"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-violet-600 dark:hover:text-violet-400"
              >
                See reviews on Google
              </a>
            </p>
          </motion.div>
        </div>
      </section>
    );
  }

  // Show testimonials grid if reviews exist
  return (
    <section data-section="testimonials" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Trusted by real users.</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            See what people are saying about Realwise.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id || index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-6 flex flex-col"
            >
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating || 5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Review text */}
              <p className="text-slate-700 dark:text-slate-300 mb-6 flex-1 text-sm leading-relaxed">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                {testimonial.avatar && (
                  <div className="text-2xl">{testimonial.avatar}</div>
                )}
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">
                    {testimonial.name}
                  </p>
                  {testimonial.role && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {testimonial.role}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <a
              href="https://g.page/realwise"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-violet-600 dark:hover:text-violet-400 font-medium"
            >
              See more reviews on Google →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
