import React, { useState, useEffect } from 'react';
import { getRegistryContract } from '../utils/ethereum';
import { FileText, Search, Filter } from 'lucide-react';

const MyWorks = ({ walletState }: { walletState?: any }) => {
  const [works, setWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchWorks = async () => {
      if (!walletState?.address) {
        setWorks([]);
        return;
      }
      
      setLoading(true);
      try {
        const { BrowserProvider } = await import('ethers');
        const provider = new BrowserProvider(window.ethereum);
        const registry = getRegistryContract(provider);
        
        // Fetch both ContentRegistered and DerivativeRegistered events and filter for current user
        const contentFilter = registry.filters.ContentRegistered();
        const contentLogs = await registry.queryFilter(contentFilter, 0, 'latest');

        const derivativeFilter = registry.filters.DerivativeRegistered();
        const derivativeLogs = await registry.queryFilter(derivativeFilter, 0, 'latest');

        const userWorks = [
          ...contentLogs
            .filter((log: any) => log.args[2].toLowerCase() === walletState.address.toLowerCase())
            .map((log: any) => ({
              type: 'Original',
              hash: log.args[1],
              timestamp: new Date(Number(log.args[3]) * 1000).toLocaleString(),
              rawTime: Number(log.args[3]),
              txHash: log.transactionHash
            })),
          ...derivativeLogs
            .filter((log: any) => log.args[3].toLowerCase() === walletState.address.toLowerCase())
            .map((log: any) => ({
              type: 'Derivative',
              hash: log.args[2],
              timestamp: new Date(Number(log.args[4]) * 1000).toLocaleString(),
              rawTime: Number(log.args[4]),
              txHash: log.transactionHash
            }))
        ].sort((a, b) => b.rawTime - a.rawTime);
        
        setWorks(userWorks);
      } catch (error) {
        console.error("Error fetching works:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorks();
  }, [walletState?.address]);

  const filteredWorks = works.filter(w => w.hash.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-navy-900 mb-2">My Registered Works</h2>
          <p className="text-gray-500">Manage and view all your copyright registrations.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search by hash..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-electric-blue focus:ring-1 focus:ring-electric-blue"
            />
          </div>
          <button className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </button>
        </div>
        
        <div className="p-0">
          {!walletState?.address ? (
            <div className="p-12 text-center">
               <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
               <p className="text-gray-500 font-medium">Please connect your wallet to view your works.</p>
            </div>
          ) : loading ? (
             <div className="p-8 text-center text-gray-400">Loading your blockchain portfolio...</div>
          ) : filteredWorks.length === 0 ? (
            <div className="p-12 text-center">
               <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
               <p className="text-gray-500 font-medium">No registered works found.</p>
               <p className="text-sm text-gray-400 mt-1">Register a new file to see it here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Content ID</th>
                  <th className="px-6 py-3">SHA-256 Hash</th>
                  <th className="px-6 py-3">Registration Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredWorks.map((work, idx) => {
                  const shortId = `CC-${(work.hash || '').slice(2, 6).toUpperCase()}`;
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-electric-blue">{shortId}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-800 break-all">{work.hash}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{work.timestamp}</td>
                      <td className="px-6 py-4">
                        <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center">
                          Registered on blockchain
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-electric-blue break-all">
                        {work.txHash}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyWorks;
