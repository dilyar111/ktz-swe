import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** HK-034 — decorative severity marker (label text stays for screen readers). */
export function SeverityIcon({ severity }) {
  if (severity === 'critical') {
    return React.createElement('span', { 'aria-hidden': 'true' }, '🔴');
  }
  if (severity === 'warning') {
    return React.createElement('span', { 'aria-hidden': 'true' }, '⚠️');
  }
  return null;
}
