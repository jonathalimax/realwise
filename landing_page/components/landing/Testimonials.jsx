import React from 'react';
import { motion } from 'framer-motion';


// Never seed this array with invented text — empty means the section
// doesn't render. Fill only with real, permission-granted testimonials.
const testimonials = [];

export default function Testimonials() {
  if (testimonials.length === 0) return null;

  return (
    <section data-section="testimonials" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold">Quem usa, recomenda.</h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.nome} className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {t.foto && <img src={t.foto} alt={t.nome} className="w-10 h-10 rounded-full mb-3" />}
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">"{t.texto}"</p>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{t.nome}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
