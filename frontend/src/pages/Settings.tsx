import React, { useState, useEffect } from 'react';
import { User, Key, Server, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';
import { REGISTRY_ADDRESS, LICENSING_ADDRESS } from '../utils/ethereum';

const Settings = ({ walletState }: { walletState?: any }) => {
  const [network, setNetwork] = useState<string>('Unknown');
  const [chainId, setChainId] = useState<string>('');

  useEffect(() => {
    const fetchNetwork = async () => {
      if (window.ethereum) {
        try {
          const { BrowserProvider } = await import('ethers');
          const provider = new BrowserProvider(window.ethereum);
          const net = await provider.getNetwork();
          setNetwork(net.name === 'unknown' ? 'Hardhat Localhost' : net.name);
          setChainId(net.chainId.toString());
        } catch (e) {
          console.error(e);
        }
      }
    };
    fetchNetwork();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-navy-900 mb-2">Profile & Settings</h2>
        <p className="text-gray-500">Manage your connected wallet and view blockchain network status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-navy-900 p-6 flex flex-col items-center justify-center border-b border-navy-800">
            <div className="w-20 h-20 bg-electric-blue/20 rounded-full flex items-center justify-center mb-4 border-2 border-electric-blue shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <User className="w-10 h-10 text-electric-blue" />
            </div>
            <h3 className="text-white font-bold text-xl">Creator Profile</h3>
            <div className="flex items-center mt-2 bg-navy-800 px-3 py-1 rounded-full border border-navy-700">
              <span className={`w-2 h-2 rounded-full mr-2 ${walletState?.address ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className="text-sm text-gray-300">{walletState?.address ? 'Wallet Connected' : 'Wallet Disconnected'}</span>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-500 mb-1">Connected Address</label>
              <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <Key className="w-5 h-5 text-gray-400 mr-3" />
                <span className="font-mono text-navy-900">
                  {walletState?.address || 'Not Connected'}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Authentication Method</label>
              <p className="text-sm text-gray-700">Web3 MetaMask Signature (No password required)</p>
            </div>
          </div>
        </div>

        {/* Network & Contracts Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center">
              <Server className="w-5 h-5 mr-2 text-electric-violet" />
              Network Status
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Active Network</span>
                <span className="font-mono bg-blue-50 text-electric-blue px-3 py-1 rounded-md text-sm">{network}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Chain ID</span>
                <span className="font-mono bg-gray-100 text-gray-600 px-3 py-1 rounded-md text-sm">{chainId || '---'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2 text-green-500" />
              Smart Contracts
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Copyright Registry</label>
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                  <span className="font-mono text-xs text-gray-600 truncate mr-2">{REGISTRY_ADDRESS}</span>
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Content Licensing</label>
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                  <span className="font-mono text-xs text-gray-600 truncate mr-2">{LICENSING_ADDRESS}</span>
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  You are currently connected to a local development environment. Contract states will reset if the Hardhat node is restarted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
