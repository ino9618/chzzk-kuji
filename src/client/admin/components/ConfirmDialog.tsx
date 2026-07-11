import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, pending = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, pending, onCancel]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !pending && onCancel()}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        <div className="dialog-actions">
          <button className="secondary-button" disabled={pending} onClick={onCancel}>취소</button>
          <button ref={confirmRef} className="danger-solid-button" disabled={pending} onClick={onConfirm}>
            {pending ? '처리 중' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
