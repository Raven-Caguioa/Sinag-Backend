"use client";

// components/layout/AdminLayout.tsx
import { FC, ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@mysten/dapp-kit";
import { 
  Sun, 
  Moon, 
  LayoutDashboard, 
  PlusCircle, 
  XCircle, 
  CheckCircle, 
  DollarSign,
  Menu,
  X,
  TrendingUp,
  BarChart3,
  Lock
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout: FC<AdminLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/create-campaign", label: "Create Campaign", icon: PlusCircle },
    { href: "/close-campaign", label: "Close Campaign", icon: XCircle },
    { href: "/finalize-campaign", label: "Finalize Campaign", icon: CheckCircle },
    { href: "/withdraw-funds", label: "Withdraw Funds", icon: DollarSign },
    { href: "/open-yield-round", label: "Open Yield Round", icon: TrendingUp },
    { href: "/close-yield-round", label: "Close Yield Round", icon: Lock },
    { href: "/yield-statistics", label: "Yield Statistics", icon: BarChart3 }, 
  ];

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-white dark:bg-[#050505] text-slate-900 dark:text-slate-300 transition-colors duration-300">
        {/* Top Navigation */}
        <nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-white/70 dark:bg-black/70 border-b border-slate-200 dark:border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-[#D4AF37] flex items-center justify-center">
                  <Sun className="w-4 h-4 text-white dark:text-black" />
                </div>
                <span className="text-lg font-semibold tracking-tight uppercase hidden sm:inline">
                  Sinag Admin
                </span>
              </Link>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-[#D4AF37]" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </button>
              
              <ConnectButton />
            </div>
          </div>
        </nav>

        {/* Sidebar */}
        <aside
          className={`
            fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 
            bg-slate-50 dark:bg-[#0a0a0a] border-r border-slate-200 dark:border-white/5
            transition-transform duration-300 z-40
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200 text-sm font-medium
                    ${
                      isActive
                        ? "bg-slate-900 dark:bg-[#D4AF37] text-white dark:text-black"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="lg:ml-64 pt-16 min-h-screen">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
};