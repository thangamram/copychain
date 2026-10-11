import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { connectWallet } from './utils/ethereum';

import SidebarLayout from './components/SidebarLayout';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import Verify from './pages/Verify';
import Licensing from './pages/Licensing';
import Reports from './pages/Reports';
import MyWorks from './pages/MyWorks';
import TransactionHistory from './pages/TransactionHistory';
import Settings from './pages/Settings';
import MyLicenses from './pages/MyLicenses';
import Derivatives from './pages/Derivatives';

const LandingPage = () => (
  <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center p-4 text-white">
    <div className="absolute inset-0 bg-gradient-radial from-navy-800 to-navy-900 -z-10" />
    <Shield className="w-24 h-24 text-electric-blue mb-8 animate-pulse" />
    <h1 className="text-6xl font-bold mb-4 tracking-tight">
      Copy<span className="text-electric-violet">Chain</span>
    </h1>
    <p className="text-xl text-gray-400 max-w-2xl text-center mb-12">
      Decentralized copyright protection for digital creators. Register, verify, and license your digital assets on the blockchain.
    </p>
    <div className="flex space-x-6">
      <Link to="/dashboard" className="px-8 py-3 rounded-full bg-electric-blue hover:bg-blue-600 transition font-semibold">
        Enter Application
      </Link>
    </div>
  </div>
);

// Stub for new pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center">
    <h2 className="text-2xl font-bold text-navy-900 mb-2">{title}</h2>
    <p className="text-gray-500">This feature is currently being built.</p>
  </div>
);

function App() {
  const [walletState, setWalletState] = useState<{ address: string | null, signer: any }>({ address: null, signer: null });

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const { BrowserProvider } = await import('ethers');
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setWalletState({ address, signer });
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    checkConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', checkConnection);
      return () => window.ethereum.removeListener('accountsChanged', checkConnection);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const res = await connectWallet();
      if (res) setWalletState(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = () => {
    setWalletState({ address: null, signer: null });
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={
          <SidebarLayout walletState={walletState} onConnect={handleConnect} onDisconnect={handleDisconnect}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard walletState={walletState} />} />
              <Route path="/register" element={<Register walletState={walletState} />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/licensing" element={<Licensing walletState={walletState} />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/my-works" element={<MyWorks walletState={walletState} />} />
              <Route path="/derivatives" element={<Derivatives walletState={walletState} />} />
              <Route path="/my-licenses" element={<MyLicenses walletState={walletState} />} />
              <Route path="/transactions" element={<TransactionHistory walletState={walletState} />} />
              <Route path="/settings" element={<Settings walletState={walletState} />} />
            </Routes>
          </SidebarLayout>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
