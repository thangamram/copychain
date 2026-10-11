import React, { useState, useEffect } from 'react';
import { getRegistryContract } from '../utils/ethereum';
import { Activity, Clock } from 'lucide-react';

const TransactionHistory = ({ walletState }: { walletState?: any }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const { BrowserProvider } = await import('ethers');
        const provider = new BrowserProvider(window.ethereum);
        const registry = getRegistryContract(provider);
        
        // Fetch ALL ContentRegistered events on the local blockchain
        const filter = registry.filters.ContentRegistered();
        const logs = await registry.queryFilter(filter, 0, 'latest');
        
        const formattedEvents = logs.map((log: any) => ({
          hash: log.args[1],
          owner: log.args[2],
          timestamp: new Date(Number(log.args[3]) * 1000).toLocaleString(),
          txHash: log.transactionHash
        })).reverse();
        
        setEvents(formattedEvents);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [walletState?.address]); // Refresh if address changes, though it pulls all history

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-navy-900 mb-2">Transaction History</h2>
          <p className="text-gray-500">A complete, immutable record of all blockchain operations.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-0">
          {loading ? (
             <div className="p-8 text-center text-gray-400">Loading blockchain history...</div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
               <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
               <p className="text-gray-500 font-medium">No blockchain transactions found.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Content Hash</th>
                  <th className="px-6 py-3">Wallet Address</th>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3 text-right">Transaction Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.map((evt, idx) => {
                  const isMine = walletState?.address?.toLowerCase() === evt.owner.toLowerCase();
                  return (
                    <tr key={idx} className={`hover:bg-gray-50 transition ${isMine ? 'bg-electric-blue/5' : ''}`}>
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium">Registration</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-800 break-all">{evt.hash}</td>
                      <td className="px-6 py-4 font-mono text-xs break-all">
                        {evt.owner}
                        {isMine && <span className="ml-2 text-xs text-electric-blue font-semibold">(You)</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {evt.timestamp}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-electric-blue break-all">
                        {evt.txHash}
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

export default TransactionHistory;
