import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function WhatsAppFloatingButton() {
  return (
    <a
      href="https://wa.me/5541992310339"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-xl flex items-center justify-center transition-transform hover:scale-110"
    >
      <MessageCircle className="w-7 h-7 text-white" fill="currentColor" />
    </a>
  );
}
