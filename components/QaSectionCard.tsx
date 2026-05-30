import type { ReactNode } from 'react';
import type { QaSectionCardTone } from '@/lib/qa-section-card-style';
import { getQaSectionCardClass, getQaSectionCardStyle } from '@/lib/qa-section-card-style';

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
      className={`border rounded-lg p-4 shadow-sm ${getQaSectionCardClass(tone)} ${className}`.trim()}
      style={getQaSectionCardStyle(tone)}
    >
      {children}
    </li>
  );
}
