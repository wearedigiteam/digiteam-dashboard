// Tabs across the top of Digiteam Dashboard: Userback, Slack, Admin
const TABS = [
  { id: 'userback', label: 'Userback', href: '/dashboard' },
  { id: 'slack',    label: 'Slack',    href: '/slack' },
  { id: 'admin',    label: 'Admin',    href: '/admin', adminOnly: true },
];

export default function AppNav({ active, canAdmin = true }) {
  return (
    <nav className="dt-app-nav" aria-label="Digiteam Dashboard">
      {TABS.filter(t => !t.adminOnly || canAdmin).map(t => (
        <a key={t.id} href={t.href} className={t.id === active ? 'dt-app-tab active' : 'dt-app-tab'}
          aria-current={t.id === active ? 'page' : undefined}>{t.label}</a>
      ))}
    </nav>
  );
}

export function DigiteamLogo({ size = 28 }) {
  return (
    <svg width={size} height={size * 122 / 140} viewBox="0 0 140 122" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="19.16 38.15 0 57.31 19.16 57.31 38.32 57.31 38.32 38.15" fill="#f7ad39"/>
      <path d="M114.19,38.5c0-.12-.11-.23-.16-.35H57.48V57.31h60.46A56.45,56.45,0,0,0,114.19,38.5Z" fill="#f7ad39"/>
      <path d="M140.77,57.31H117.94c0,1.2.08,2.42.08,3.66q0,13.25-3.83,22.57a28.21,28.21,0,0,1-12.72,14.28q-8.88,5-24.21,5H57.48L76.65,122H78.3q21.44,0,35.28-7.58a47.74,47.74,0,0,0,20.56-21.25q6.71-13.68,6.71-32.15C140.85,59.73,140.81,58.52,140.77,57.31Z" fill="#f05a27"/>
      <path d="M134.14,28.83A47.74,47.74,0,0,0,113.58,7.58Q101.4.9,83.34.11C81.7,0,80,0,78.3,0H57.4l-19,19H77.26q13.06,0,21.45,3.68c1,.43,1.89.87,2.76,1.37A28.62,28.62,0,0,1,114,38.15h23.71A61.22,61.22,0,0,0,134.14,28.83Z" fill="#f05a27"/>
      <polygon points="38.32 57.31 38.32 77.33 38.32 81.49 38.32 83.63 57.48 102.79 57.48 58.17 57.48 57.31" fill="#f7ad39"/>
    </svg>
  );
}
