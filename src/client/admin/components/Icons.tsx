import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const DashboardIcon = (props: IconProps) => <IconBase {...props}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></IconBase>;
export const TicketIcon = (props: IconProps) => <IconBase {...props}><path d="M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 0 0-6V6H3z" /><path d="M13 6v2M13 11v2M13 16v2" /></IconBase>;
export const TrophyIcon = (props: IconProps) => <IconBase {...props}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" /></IconBase>;
export const SettingsIcon = (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" /></IconBase>;
export const BookIcon = (props: IconProps) => <IconBase {...props}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21z" /></IconBase>;
export const LogoutIcon = (props: IconProps) => <IconBase {...props}><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></IconBase>;
export const PlusIcon = (props: IconProps) => <IconBase {...props}><path d="M12 5v14M5 12h14" /></IconBase>;
export const TrashIcon = (props: IconProps) => <IconBase {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></IconBase>;
export const MonitorIcon = (props: IconProps) => <IconBase {...props}><rect x="3" y="4" width="18" height="13" rx="1" /><path d="M8 21h8M12 17v4" /></IconBase>;
export const SlidersIcon = (props: IconProps) => <IconBase {...props}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="13" cy="18" r="2" /></IconBase>;
export const MoreIcon = (props: IconProps) => <IconBase {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></IconBase>;
export const CloseIcon = (props: IconProps) => <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>;
