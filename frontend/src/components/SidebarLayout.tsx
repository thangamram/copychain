import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, FilePlus, FolderLock, Search, Network, ShoppingCart, Key, AlertOctagon, Activity, User, LogOut } from 'lucide-react';

const SidebarLayout = ({ children, walletState, onConnect, onDisconnect }: any) => {
  const location = useLocation();

  const navItems = [
    { section: 'OVERVIEW', items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
    ]},
    { section: 'CONTENT MANAGEMENT', items: [
      { name: 'Register Work', path: '/register', icon: FilePlus },
      { name: 'My Registered Works', path: '/my-works', icon: FolderLock },
      { name: 'Verify Copyright', path: '/verify', icon: Search },
      { name: 'Derivative Works', path: '/derivatives', icon: Network }
    ]},
    { section: 'LICENSING', items: [
      { name: 'Licensing Marketplace', path: '/licensing', icon: ShoppingCart },
      { name: 'My Licences', path: '/my-licenses', icon: Key }
    ]},
    { section: 'PROTECTION', items: [
      { name: 'Report Misuse', path: '/reports', icon: AlertOctagon }
    ]},
    { section: 'BLOCKCHAIN', items: [
      { name: 'Transaction History', path: '/transactions', icon: Activity }
    ]},
    { section: 'ACCOUNT', items: [
      { name: 'Profile & Settings', path: '/settings', icon: User }
    ]}
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-800">
      {/* Sidebar */}
      <div className="w-64 bg-navy-900 text-white flex flex-col shadow-xl flex-shrink-0">
        <div className="p-6 flex items-center space-x-2 border-b border-navy-800">
          <Shield className="text-electric-blue w-8 h-8" />
          <span className="text-2xl font-bold">Copy<span className="text-electric-violet">Chain</span></span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          {navItems.map((group, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {group.section}
              </h3>
              <ul>
                {group.items.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.name}>
                      <Link 
                        to={item.path} 
                        className={`flex items-center px-6 py-2.5 text-sm transition-colors ${isActive ? 'bg-electric-blue/10 text-electric-blue border-r-4 border-electric-blue' : 'text-gray-400 hover:text-white hover:bg-navy-800'}`}
                      >
                        <item.icon className="w-4 h-4 mr-3" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-navy-900">
              {navItems.flatMap(g => g.items).find(i => i.path === location.pathname)?.name || 'CopyChain'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center bg-gray-100 px-3 py-1.5 rounded-full text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span className="text-gray-600 font-medium">Hardhat Localhost</span>
            </div>
            
            {walletState.address ? (
              <div className="flex items-center bg-navy-50 rounded-lg border border-navy-100 p-1">
                <span className="px-3 text-sm font-mono text-navy-800">
                  {walletState.address.slice(0,6)}...{walletState.address.slice(-4)}
                </span>
                <button onClick={onDisconnect} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={onConnect} className="px-5 py-2 bg-electric-blue text-white hover:bg-blue-600 rounded-lg transition font-semibold text-sm shadow-sm">
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SidebarLayout;
