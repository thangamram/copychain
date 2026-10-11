import React, { useState } from 'react';
import { Upload, File, Search, ShieldCheck, XCircle } from 'lucide-react';
import { connectWallet, getRegistryContract } from '../utils/ethereum';

const Verify = () => {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'match' | 'no-match' | null>(null);
  const [regDetails, setRegDetails] = useState<{creator: string, timestamp: string} | null>(null);

  const calculateHash = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    setHash('0x' + hashHex);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setVerificationResult(null);
      calculateHash(selectedFile);
    }
  };

  const handleVerify = async () => {
    if (!hash) return;
    setIsVerifying(true);
    
    try {
      const res = await connectWallet();
      if (!res) throw new Error('Wallet not connected');

      const registry = getRegistryContract(res.provider);
      
      const registered = await registry.isRegistered(hash);
      
      if (registered) {
        const registrationData = await registry.getRegistration(hash);
        // registrationData returns a struct tuple. Indexes:
        // 0: contentId
        // 1: contentHash
        // 2: creator
        // 3: timestamp
        // 4: parentContentId
        // 5: isRegistered
        
        setVerificationResult('match');
        setRegDetails({
          creator: registrationData.creator,
          timestamp: new Date(Number(registrationData.timestamp) * 1000).toLocaleString()
        });
      } else {
        setVerificationResult('no-match');
      }
    } catch (error) {
      console.error(error);
      alert("Error verifying the file on the blockchain.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="container mx-auto mt-12 p-6 max-w-3xl">
      <h2 className="text-3xl font-bold mb-6 flex items-center">
        <Search className="w-8 h-8 mr-3 text-electric-blue" />
        Verify Copyright Registration
      </h2>
      
      <div className="bg-navy-800 p-8 rounded-xl border border-navy-700 shadow-xl">
        <div className="border-2 border-dashed border-navy-600 rounded-xl p-12 text-center hover:border-electric-violet transition cursor-pointer relative mb-8">
          <input 
            type="file" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            onChange={handleFileChange}
          />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-300">Upload a file to verify its registration</p>
          <p className="text-sm text-gray-500 mt-2">We will calculate the fingerprint locally.</p>
        </div>

        {file && !verificationResult && (
          <div className="bg-navy-900 p-6 rounded-lg text-center">
            <p className="font-mono text-sm text-electric-blue break-all mb-4">Fingerprint: {hash}</p>
            <button 
              onClick={handleVerify}
              disabled={isVerifying}
              className="px-8 py-3 bg-electric-violet hover:bg-violet-600 disabled:opacity-50 rounded-lg font-semibold transition"
            >
              {isVerifying ? 'Checking Blockchain...' : 'Verify Exact Match'}
            </button>
          </div>
        )}

        {verificationResult === 'match' && (
          <div className="bg-green-900/20 border border-green-500/30 p-6 rounded-lg text-center">
            <ShieldCheck className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-green-400 mb-2">Verified Exact Match</h3>
            <p className="text-gray-300 mb-4">This file's fingerprint exists on the blockchain registry.</p>
            
            <div className="bg-navy-900 p-4 rounded text-left border border-navy-700 mb-4">
              <p className="text-xs text-gray-400">Registered Creator</p>
              <p className="font-mono text-sm mb-2">{regDetails?.creator}</p>
              
              <p className="text-xs text-gray-400">Timestamp</p>
              <p className="text-sm">{regDetails?.timestamp}</p>
            </div>
            <p className="text-xs text-gray-400">
              Note: This confirms the file bytes match a registered fingerprint. It does not independently prove legal ownership.
            </p>
          </div>
        )}

        {verificationResult === 'no-match' && (
          <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-lg text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-red-400 mb-2">No Matching Registration</h3>
            <p className="text-gray-300 mb-4">We could not find an exact fingerprint match for this file on the blockchain.</p>
            <p className="text-xs text-gray-400">
              Note: This simply means the exact file has not been registered on CopyChain. 
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Verify;
