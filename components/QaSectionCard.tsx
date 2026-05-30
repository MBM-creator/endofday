import type { ReactNode } from 'react';
import type { QaSectionCardTone } from '@/lib/qa-section-card-style';

export function QaSectionCard({
  tone,
  className = '',
  children,
}: {
  tone: QaSectionCardTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li
      data-qa-card-tone={tone}
      className={`border rounded-lg p-4 shadow-sm ${className}`.trim()}
    >
      {children}
    </li>
  );
}
