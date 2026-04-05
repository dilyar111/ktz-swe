import React from 'react';
import { cn } from '@/lib/utils';

export const KTZ_LOGO_SRC = '/branding/ktz-logo.png';

const SIZE_CLASS = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

/**
 * KTZ brand mark from `/public/branding/ktz-logo.png` (HK-037).
 */
export default function KtzLogo({ className, size = 'md', alt = 'KTZ' }) {
  return (
    <img
      src={KTZ_LOGO_SRC}
      alt={alt}
      className={cn('object-contain shrink-0', SIZE_CLASS[size] ?? SIZE_CLASS.md, className)}
      decoding="async"
    />
  );
}
