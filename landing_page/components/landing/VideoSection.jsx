import React, { useState } from 'react';

import { Play } from 'lucide-react';

// Renders nothing until a real video URL is provided via VITE_FOUNDER_VIDEO_URL.
// Do not publish a placeholder/stock video here — wait for the real recording.
export default function VideoSection({ videoUrl }) {
  const [playing, setPlaying] = useState(false);

  if (!videoUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="max-w-2xl mx-auto mt-10 mb-4"
    >
      <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-900 shadow-xl">
        {playing ? (
          <video src={videoUrl} controls autoPlay className="w-full h-full object-cover" />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex items-center justify-center group"
            aria-label="Reproduzir vídeo"
          >
            <span className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-7 h-7 text-violet-600 ml-0.5" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
