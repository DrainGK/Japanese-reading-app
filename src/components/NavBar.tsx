import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/texts', label: 'Texts', icon: '📖' },
  { to: '/kanji', label: 'Kanji', icon: '字' },
  { to: '/vocabulary', label: 'Vocab', icon: '💬' },
  { to: '/user', label: 'Profile', icon: '👤' },
];

export function NavBar() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-sm
                    border-t border-stroke-subtle z-50 safe-area-pb md:static md:border-t-0 md:border-b">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-lg
                        transition-all duration-150
                        ${location.pathname === item.to
                          ? 'text-primary-400'
                          : 'text-prose-muted hover:text-prose-secondary'}`}
            end={item.to === '/'}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-2xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
