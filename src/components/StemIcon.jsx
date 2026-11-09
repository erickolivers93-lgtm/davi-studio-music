import React from 'react';
import { Music } from 'lucide-react';

export const StemIcon = ({ type, className = 'w-5 h-5' }) => {
  switch (type) {
    case 'vocals':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      );
    case 'drums':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="9" rx="9" ry="4" />
          <path d="M3 9v6c0 2.2 4 4 9 4s9-1.8 9-4V9" />
          <path d="m7 13 0 5.5" />
          <path d="m17 13 0 5.5" />
          <path d="m2 3 7 4" />
          <path d="m22 3-7 4" />
        </svg>
      );
    case 'bass':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m11.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8" />
          <path d="m16 16 6-6" />
          <path d="m8 8 6-6" />
          <path d="m9 7 8 8" />
          <circle cx="18.5" cy="5.5" r="2.5" />
        </svg>
      );
    case 'other':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="M6 4v10" />
          <path d="M10 4v10" />
          <path d="M14 4v10" />
          <path d="M18 4v10" />
          <path d="M2 14h20" />
        </svg>
      );
    case 'metronome':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 21 4.5-18h3L18 21Z" />
          <path d="m12 15 6-8" />
          <path d="M9 17h6" />
        </svg>
      );
    default:
      return <Music className={className} />;
  }
};
