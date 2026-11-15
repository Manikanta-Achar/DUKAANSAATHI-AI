import { NavLink } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { LayoutDashboard, Users, Boxes, Clock, Sparkles } from 'lucide-react';

export default function Sidebar() {
  const { dashboard, customers, customersLoading } = useShop();
  const activeCount = customers.filter((customer) => customer.isArchived !== true).length;

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      to: '/udhaar',
      label: 'Udhaar Ledger',
      icon: Users,
      badge: customersLoading ? '...' : `${activeCount} cust`,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      to: '/inventory',
      label: 'Inventory',
      icon: Boxes,
      badge: dashboard.lowStockCount > 0 ? `${dashboard.lowStockCount} low` : null,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      to: '/history',
      label: 'History',
      icon: Clock,
      badge: null,
    },
  ];

  return (
    <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 md:p-5 flex flex-col justify-between shrink-0">
      <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs border border-emerald-200/60'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0 text-emerald-700" />
                <span className="whitespace-nowrap">{item.label}</span>
              </div>
              {item.badge && (
                <span className={`hidden md:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Helper Card for shopkeeper */}
      <div className="hidden md:block mt-6 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Quick Voice Tip</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          Tap the mic and say: <br />
          <span className="italic font-medium text-emerald-800">"Ramesh ko 40 rupaye udhaar do"</span>
        </p>
      </div>
    </aside>
  );
}
