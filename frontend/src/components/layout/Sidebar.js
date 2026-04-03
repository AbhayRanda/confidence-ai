import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Video, 
  BarChart3, 
  Settings,
  LogOut,
  Target
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'AI Analysis', path: '/ai', icon: Video },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <motion.aside
      initial={{ width: 260 }}
      animate={{ width: isCollapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen bg-white border-r border-slate-200 flex flex-col items-center py-6 px-4 shrink-0 transition-all z-20 shadow-sm"
    >
      <div className="flex items-center justify-center w-full mb-10 overflow-hidden" onClick={() => setIsCollapsed(!isCollapsed)}>
        <Target className="w-8 h-8 text-indigo-600 shrink-0 cursor-pointer" />
        <motion.span
          initial={{ opacity: 1, width: 'auto' }}
          animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto', marginLeft: isCollapsed ? 0 : 12 }}
          transition={{ duration: 0.2 }}
          className="font-bold text-xl tracking-tight text-slate-800 whitespace-nowrap cursor-pointer origin-left overflow-hidden"
        >
          Confidence UI
        </motion.span>
      </div>

      <nav className="flex-1 w-full space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              cx(
                "flex items-center py-3 px-3 rounded-xl transition-all group overflow-hidden",
                isActive 
                  ? "bg-indigo-50 text-indigo-600 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.05)]" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <motion.span
              initial={{ opacity: 1, width: 'auto' }}
              animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto', marginLeft: isCollapsed ? 0 : 16 }}
              transition={{ duration: 0.2 }}
              className="font-medium whitespace-nowrap origin-left overflow-hidden"
            >
              {item.name}
            </motion.span>
          </NavLink>
        ))}
      </nav>

      <div className="w-full mt-auto">
        <button className="flex items-center w-full py-3 px-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all group overflow-hidden">
          <LogOut className="w-5 h-5 shrink-0" />
          <motion.span
            initial={{ opacity: 1, width: 'auto' }}
            animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto', marginLeft: isCollapsed ? 0 : 16 }}
            transition={{ duration: 0.2 }}
            className="font-medium whitespace-nowrap origin-left overflow-hidden"
          >
            Log Out
          </motion.span>
        </button>
      </div>
    </motion.aside>
  );
}
