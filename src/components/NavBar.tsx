import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/texts', label: 'Texts' },
  { to: '/kanji', label: 'Kanjis' },
  { to: '/vocabulary', label: 'Vocab' },
  { to: '/user', label: 'User' },
];

export function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur md:static md:border-t-0 md:border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2 md:justify-start md:gap-3 md:py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')
            }
            end={item.to === '/'}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
