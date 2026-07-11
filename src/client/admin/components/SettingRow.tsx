import type { ReactNode } from 'react';

export function SettingRow({ title, description, children, danger = false }: { title: string; description?: string; children: ReactNode; danger?: boolean }) {
  return (
    <div className={`setting-row ${danger ? 'danger' : ''}`}>
      <div className="setting-row-copy">
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}
