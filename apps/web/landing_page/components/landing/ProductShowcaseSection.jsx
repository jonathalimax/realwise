import React from 'react';
import { motion } from 'framer-motion';


export default function ProductShowcaseSection() {
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
          {/* Desktop screenshot */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="w-full md:w-2/3"
          >
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-3xl blur-lg pointer-events-none" />
              <img
                src="/screenshot-desktop.png"
                alt="Realwise no desktop"
                className="relative w-full h-auto object-cover"
              />
            </div>
          </motion.div>

          {/* Mobile screenshot */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="w-48 sm:w-56 md:w-1/4 flex-shrink-0"
          >
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-3xl blur-lg pointer-events-none" />
              <img
                src="/screenshot-mobile.png"
                alt="Realwise no celular"
                className="relative w-full h-auto object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
