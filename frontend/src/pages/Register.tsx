import React, { useState } from 'react';
import { Upload, File, CheckCircle, AlertTriangle, Link, Hash, ExternalLink } from 'lucide-react';
import { connectWallet, getRegistryContract } from '../utils/ethereum';

interface RegistrationRecord {
  contentId: string;
  fileName: string;
  creator: string;
  hash: string;
  status: string;
  txHash: string;
}

const Register = ({ walletState }: { walletState?: any }) => {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>('');
  const [isHashing, setIsHashing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [record, setRecord] = useState<RegistrationRecord | null>(null);
  const [isDerivative, setIsDerivative] = useState(false);
  const [parentHash, setParentHash] = useState('');

  const calculateHash = async (selectedFile: File) => {
    setIsHashing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setHash(hashHex);
    } catch (err) {
      console.error('Error generating hash:', err);
    } finally {
      setIsHashing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setHash('');
      setRecord(null);
    }
  };

  const handleGenerateFingerprint = () => {
    if (file) {
      calculateHash(file);
    }
  };

  const handleRegister = async () => {
    if (!hash || !file) return;
    
    setIsRegistering(true);
    try {
      const res = await connectWallet();
      if (!res) throw new Error('Wallet not connected');

      const registry = getRegistryContract(res.signer);
      
      let tx;
      if (isDerivative) {
        if (!parentHash) throw new Error("Parent Hash is required for derivative works.");
        let formattedParent = parentHash.trim();
        if (!formattedParent.startsWith('0x')) formattedParent = '0x' + formattedParent;
        
        const parentId = await registry.hashToContentId(formattedParent);
        if (parentId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
          throw new Error("Parent content not registered. Make sure you are pasting the Content Hash, not a Transaction ID.");
        }
        tx = await registry.registerDerivative(hash, parentId);
      } else {
        tx = await registry.registerContent(hash);
      }
      
      const receipt = await tx.wait();
      
      // Look up contentId from contract
      const contentId = await registry.hashToContentId(hash);
      const shortId = contentId && contentId !== '0x0000000000000000000000000000000000000000000000000000000000000000' 
        ? `CC-${contentId.slice(2, 8).toUpperCase()}` 
        : 'CC-001';

      setRecord({
        contentId: shortId,
        fileName: file.name,
        creator: res.address,
        hash: hash,
        status: 'Registered on blockchain',
        txHash: receipt.hash || tx.hash
      });
      setIsRegistering(false);
      
    } catch (error: any) {
      console.error(error);
      setIsRegistering(false);
      
      if (error.reason === "Hash already registered" || (error.data && error.data.message && error.data.message.includes("Hash already registered"))) {
        alert("This file's fingerprint is already registered on the blockchain!");
      } else {
        alert(error.reason || error.message || "Transaction failed or was rejected.");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-navy-900 mb-2">Register Your Work</h2>
        <p className="text-gray-500">Upload your creation, generate a SHA-256 fingerprint, and register immutable copyright on the blockchain.</p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
        {!record ? (
          <>
            {/* Step 1: Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-electric-blue transition cursor-pointer relative bg-gray-50">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={handleFileChange}
              />
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-base font-semibold text-gray-700">Drag & drop your file here, or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Supports images, docs, video, audio (e.g. myart.png)</p>
            </div>

            {file && (
              <div className="mt-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
                  <div className="flex items-center">
                    <File className="w-6 h-6 text-electric-blue mr-3" />
                    <div>
                      <p className="font-semibold text-navy-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown'}</p>
                    </div>
                  </div>
                  {!hash && (
                    <button
                      type="button"
                      onClick={handleGenerateFingerprint}
                      disabled={isHashing}
                      className="px-5 py-2 bg-electric-violet hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition flex items-center shadow-sm"
                    >
                      <Hash className="w-4 h-4 mr-1.5" />
                      {isHashing ? 'Generating...' : 'Generate Fingerprint'}
                    </button>
                  )}
                </div>

                {hash && (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">SHA-256 Fingerprint</label>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Calculated</span>
                      </div>
                      <p className="font-mono text-xs bg-white p-3 rounded-lg border border-gray-300 text-electric-violet break-all font-semibold">
                        {hash}
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start mb-6">
                      <AlertTriangle className="w-5 h-5 text-electric-blue mr-3 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-900 leading-relaxed">
                        Blockchain registration creates an immutable, timestamped record of this cryptographic hash with your connected wallet.
                      </p>
                    </div>

                    <div className="mb-6">
                      <label className="flex items-center text-sm text-gray-700 mb-2 cursor-pointer font-medium">
                        <input type="checkbox" checked={isDerivative} onChange={(e) => setIsDerivative(e.target.checked)} className="mr-2 rounded text-electric-blue focus:ring-electric-blue" />
                        Register as a derivative work (Linked to existing parent)
                      </label>
                      {isDerivative && (
                        <div className="mt-2 pl-6">
                          <label className="block text-xs text-gray-500 mb-1">Parent Content Hash</label>
                          <input 
                            type="text" 
                            placeholder="0x..." 
                            value={parentHash}
                            onChange={(e) => setParentHash(e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-electric-blue font-mono" 
                          />
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={handleRegister} 
                      disabled={isRegistering || (isDerivative && !parentHash)}
                      className="w-full py-3 bg-electric-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition font-semibold text-base shadow-sm"
                    >
                      {isRegistering ? 'Confirming in MetaMask...' : 'Register on Blockchain'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="py-6">
            <div className="text-center mb-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-navy-900 mb-1">Registration Confirmed</h3>
              <p className="text-gray-500 text-sm">Your digital asset is officially registered on the blockchain.</p>
            </div>

            {/* Structured Table matching requirements */}
            <div className="overflow-hidden border border-gray-200 rounded-xl mb-8 shadow-sm">
              <table className="w-full text-left text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-6 py-3 w-1/3">Field</th>
                    <th className="px-6 py-3">Registration Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  <tr>
                    <td className="px-6 py-3.5 font-semibold text-gray-700">Content ID</td>
                    <td className="px-6 py-3.5 font-mono text-electric-blue font-bold">{record.contentId}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-semibold text-gray-700">File name</td>
                    <td className="px-6 py-3.5 text-gray-800 font-medium">{record.fileName}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-semibold text-gray-700">Creator</td>
                    <td className="px-6 py-3.5 font-mono text-gray-700 text-xs">{record.creator}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-semibold text-gray-700">SHA-256 hash</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-electric-violet break-all">{record.hash}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-semibold text-gray-700">Status</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-600" />
                        {record.status}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-semibold text-gray-700">Transaction</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-blue-600 break-all">{record.txHash}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-center space-x-4">
              <button 
                onClick={() => { setFile(null); setHash(''); setRecord(null); }}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
              >
                Register Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
