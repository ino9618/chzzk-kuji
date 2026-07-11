import type { ReactNode } from 'react';

export function InlineFeedback({ tone, children }: { tone: 'success' | 'error' | 'pending'; children: ReactNode }) {
  return <p className={`inline-feedback ${tone}`} role="status">{children}</p>;
}
