import React, { useState, useEffect } from 'react';
import { getRegistryContract } from '../utils/ethereum';
import { Network, UploadCloud, Search, CheckCircle } from 'lucide-react';

const Derivatives = ({ walletState }: { walletState?: any }) => {
  const [derivatives, setDerivatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [parentHash, setParentHash] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDerivatives = async () => {
      if (!walletState?.address) {
        setDerivatives([]);
        return;
      }
      
      setLoading(true);
      try {
        const { BrowserProvider } = await import('ethers');
        const provider = new BrowserProvider(window.ethereum);
        const registry = getRegistryContract(provider);
        
        // Fetch all DerivativeRegistered events and filter for current user
        // event DerivativeRegistered(bytes32 indexed contentId, bytes32 indexed parentContentId, string contentHash, address indexed creator, uint256 timestamp)
        const filter = registry.filters.DerivativeRegistered();
        const logs = await registry.queryFilter(filter, 0, 'latest');
        
        const formattedDerivatives = logs
          .filter((log: any) => log.args[3].toLowerCase() === walletState.address.toLowerCase())
          .map((log: any) => ({
            contentId: log.args[0],
            parentContentId: log.args[1],
            childHash: log.args[2],
            timestamp: new Date(Number(log.args[4]) * 1000).toLocaleString(),
            txHash: log.transactionHash
          })).reverse();
        
        setDerivatives(formattedDerivatives);
      } catch (err) {
        console.error("Error fetching derivatives:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDerivatives();
  }, [walletState?.address, success]); // refresh when successful registration

  const calculateHash = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(hashHex);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleRegisterDerivative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !parentHash) return;
    if (!walletState?.signer) {
      setError("Please connect your wallet first.");
      return;
    }

    setIsRegistering(true);
    setError('');
    setSuccess('');

    try {
      const childHashHex = await calculateHash(file);
      
      // Basic formatting of parent hash if user pasted without 0x
      let formattedParent = parentHash.trim();
      if (!formattedParent.startsWith('0x')) formattedParent = '0x' + formattedParent;
      
      const registry = getRegistryContract(walletState.signer);
      
      // Look up the internal contentId from the provided contentHash
      const parentId = await registry.hashToContentId(formattedParent);
      if (parentId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        throw new Error("Parent content not registered. Make sure you are pasting the Content Hash, not a Transaction ID.");
      }
      
      const tx = await registry.registerDerivative(childHashHex, parentId);
      await tx.wait();
      
      setSuccess(`Derivative successfully linked! Tx: ${tx.hash.slice(0, 10)}...`);
      setFile(null);
      setParentHash('');
    } catch (err: any) {
      console.error(err);
      setError(err.reason || err.message || "Transaction failed");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-navy-900 mb-2">Derivative Works</h2>
          <p className="text-gray-500">Track and link your modified artworks to their original sources.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Register Form */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6 self-start">
          <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center">
            <Network className="w-5 h-5 mr-2 text-electric-blue" />
            Link Derivative
          </h3>
          
          <form onSubmit={handleRegisterDerivative} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Content Hash</label>
              <input 
                type="text" 
                required
                value={parentHash}
                onChange={(e) => setParentHash(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-electric-blue"
              />
              <p className="text-xs text-gray-400 mt-1">The 32-byte hash of the original registered work.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Derivative File</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-electric-blue transition cursor-pointer relative">
                <input 
                  type="file" 
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">{file ? file.name : "Select or drag file"}</p>
                <p className="text-xs text-gray-400 mt-1">{file ? `${(file.size/1024/1024).toFixed(2)} MB` : "Any supported format"}</p>
              </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100 flex"><CheckCircle className="w-4 h-4 mr-2 mt-0.5" />{success}</div>}

            <button 
              type="submit" 
              disabled={isRegistering || !file || !parentHash}
              className="w-full py-2.5 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition font-medium disabled:opacity-50"
            >
              {isRegistering ? 'Linking...' : 'Register Derivative'}
            </button>
          </form>
        </div>

        {/* Display Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
             <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">My Linked Derivations</h3>
          </div>
          
          <div className="flex-1 p-0">
            {!walletState?.address ? (
              <div className="p-12 text-center h-full flex flex-col items-center justify-center">
                 <Network className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                 <p className="text-gray-500 font-medium">Connect wallet to view your derivatives.</p>
              </div>
            ) : loading ? (
               <div className="p-8 text-center text-gray-400 h-full flex items-center justify-center">Loading network tree...</div>
            ) : derivatives.length === 0 ? (
              <div className="p-12 text-center h-full flex flex-col items-center justify-center">
                 <Network className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                 <p className="text-gray-500 font-medium">No derivatives linked yet.</p>
                 <p className="text-sm text-gray-400 mt-1">Use the form to link a modified file to its original parent.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3">Parent Hash</th>
                    <th className="px-6 py-3">Child Hash</th>
                    <th className="px-6 py-3">Date Linked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {derivatives.map((deriv, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-mono text-xs text-electric-blue break-all">{deriv.parentContentId}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-800 break-all">{deriv.childHash}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{deriv.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Derivatives;
