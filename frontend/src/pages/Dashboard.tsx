import React, { useState, useEffect } from 'react';
import { getRegistryContract, getLicensingContract } from '../utils/ethereum';
import { FileText, ShieldCheck, Activity, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
const Dashboard = ({ walletState }: { walletState?: any }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [activeLicencesCount, setActiveLicencesCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (walletState?.address) {
      fetchHistory(walletState.address);
    } else {
      setEvents([]);
      setActiveLicencesCount(0);
    }
  }, [walletState?.address]);

  const fetchHistory = async (userAddress: string) => {
    setLoading(true);
    try {
      // Connect with a generic provider just to read events for now
      const { BrowserProvider } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum);
      const registry = getRegistryContract(provider);
      const licensing = getLicensingContract(provider);
      
      // Fetch both ContentRegistered and DerivativeRegistered events on the local blockchain
      const contentFilter = registry.filters.ContentRegistered();
      const contentLogs = await registry.queryFilter(contentFilter, 0, 'latest');

      const derivativeFilter = registry.filters.DerivativeRegistered();
      const derivativeLogs = await registry.queryFilter(derivativeFilter, 0, 'latest');

      const allEvents = [
        ...contentLogs.map((log: any) => ({
          type: 'Registration',
          hash: log.args[1],
          timestamp: new Date(Number(log.args[3]) * 1000).toLocaleString(),
          rawTime: Number(log.args[3]),
          txHash: log.transactionHash
        })),
        ...derivativeLogs.map((log: any) => ({
          type: 'Derivative',
          hash: log.args[2],
          timestamp: new Date(Number(log.args[4]) * 1000).toLocaleString(),
          rawTime: Number(log.args[4]),
          txHash: log.transactionHash
        }))
      ].sort((a, b) => b.rawTime - a.rawTime);
      setEvents(allEvents);

      // Query active licence listings count
      try {
        const listFilter = licensing.filters.ListingCreated();
        const listLogs = await licensing.queryFilter(listFilter, 0, 'latest');
        let activeCount = 0;
        for (const log of listLogs) {
          const cId = (log as any).args[0];
          const listingItem = await licensing.listings(cId);
          if (listingItem.isActive) activeCount++;
        }
        setActiveLicencesCount(activeCount);
      } catch (licErr) {
        console.warn("Error counting active listings:", licErr);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-navy-900 mb-2">Welcome to CopyChain</h2>
        <p className="text-gray-500 mb-6">Protect your digital creations with verifiable blockchain records.</p>
        <div className="flex space-x-4">
          <Link to="/register" className="px-6 py-2.5 bg-electric-blue text-white rounded-lg hover:bg-blue-600 transition font-medium shadow-sm">
            Register New Work
          </Link>
          <Link to="/verify" className="px-6 py-2.5 bg-white text-navy-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium shadow-sm">
            Verify a File
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">Registered Works</h3>
            <ShieldCheck className="w-5 h-5 text-electric-blue" />
          </div>
          <p className="text-3xl font-bold text-navy-900 mb-1">{events.length}</p>
          <p className="text-xs text-green-500 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Fully Secured</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">Active Licences</h3>
            <Activity className="w-5 h-5 text-electric-violet" />
          </div>
          <p className="text-3xl font-bold text-navy-900 mb-1">{activeLicencesCount}</p>
          <p className={`text-xs flex items-center ${activeLicencesCount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
            <Clock className="w-3 h-3 mr-1"/> {activeLicencesCount > 0 ? `${activeLicencesCount} offer(s) live in marketplace` : 'No active sales'}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">Pending Requests</h3>
            <FileText className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-navy-900 mb-1">0</p>
          <p className="text-xs text-gray-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> Awaiting review</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">Infringement Reports</h3>
            <FileText className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-navy-900 mb-1">0</p>
          <p className="text-xs text-gray-500 flex items-center">Resolved</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-navy-900">Recent Activity</h3>
          <Link to="/transactions" className="text-sm text-electric-blue hover:underline">View All</Link>
        </div>
        
        <div className="p-0">
          {loading ? (
             <div className="p-8 text-center text-gray-400">Loading blockchain history...</div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
               <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
               <p className="text-gray-500 font-medium">No recent blockchain transactions found.</p>
               <p className="text-sm text-gray-400 mt-1">When you register or license content, it will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Content ID</th>
                  <th className="px-6 py-3">SHA-256 Hash</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3 text-right">Transaction Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.slice(0, 5).map((evt, idx) => {
                  const shortId = `CC-${(evt.hash || '').slice(2, 6).toUpperCase()}`;
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-electric-blue">{shortId}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-800 break-all">{evt.hash}</td>
                      <td className="px-6 py-4">
                        <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                          Registered on blockchain
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{evt.timestamp}</td>
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

export default Dashboard;
