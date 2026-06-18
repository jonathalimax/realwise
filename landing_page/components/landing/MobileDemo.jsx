import React from 'react';
import { motion } from 'framer-motion';

export default function MobileDemo() {
  return (
    <section data-section="mobile-demo" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Veja como funciona.</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Dashboard em tempo real, importação automática e categorização inteligente.
          </p>
        </motion.div>

        {/* Mobile Video Player Container (Responsive) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="flex justify-center"
        >
          {/* Auto-fit container */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-slate-900 max-w-sm">
            <video
              src="/demo.mp4"
              className="w-full h-auto block"
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
            />
          </div>
        </motion.div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          Experiência mobile nativa • Categorização automática • Dados 100% seus
        </p>
      </div>
    </section>
  );
}
