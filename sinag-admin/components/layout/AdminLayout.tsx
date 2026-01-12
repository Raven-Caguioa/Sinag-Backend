"use client";

// components/layout/AdminLayout.tsx
import { FC, ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
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
  Lock,
  AlertTriangle,
  Shield,
  Settings
} from "lucide-react";
import { isAdmin } from "@/lib/admins";

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout: FC<AdminLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const account = useCurrentAccount();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  // Check if wallet is connected
  const isConnected = !!account;
  
  // Check if connected address is an admin
  const isAuthorized = isAdmin(account?.address);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/create-campaign", label: "Create Campaign", icon: PlusCircle },
    { href: "/close-campaign", label: "Close Campaign", icon: XCircle },
    { href: "/finalize-campaign", label: "Finalize Campaign", icon: CheckCircle },
    { href: "/withdraw-funds", label: "Withdraw Funds", icon: DollarSign },
    { href: "/open-yield-round", label: "Open Yield Round", icon: TrendingUp },
    { href: "/close-yield-round", label: "Close Yield Round", icon: Lock },
    { href: "/yield-statistics", label: "Yield Statistics", icon: BarChart3 },
    { href: "/settings", label: "Platform Settings", icon: Settings }, 
  ];

  // Show connect wallet screen if not connected
  if (!isConnected) {
    return (
      <div className={darkMode ? "dark" : ""}>
        <div className="min-h-screen bg-white dark:bg-[#050505] text-slate-900 dark:text-slate-300 transition-colors duration-300 flex items-center justify-center">
          <div className="text-center space-y-6 p-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-900 dark:bg-[#D4AF37] flex items-center justify-center">
              <Shield className="w-10 h-10 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                Connect Your Wallet
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Please connect your Sui wallet to access the admin dashboard
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 pt-4">
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied screen if connected but not an admin
  if (!isAuthorized) {
    return (
      <div className={darkMode ? "dark" : ""}>
        <div className="min-h-screen bg-white dark:bg-[#050505] text-slate-900 dark:text-slate-300 transition-colors duration-300 flex items-center justify-center">
          <div className="text-center space-y-6 p-8 max-w-md">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                Access Denied
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Your wallet address is not authorized to access this admin dashboard.
              </p>
              {account?.address && (
                <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Connected Address:</p>
                  <p className="text-sm font-mono text-slate-600 dark:text-slate-400 break-all">
                    {account.address}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-4">
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render the full admin dashboard for authorized admins
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