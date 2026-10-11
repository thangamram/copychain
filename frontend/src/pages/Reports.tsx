import React, { useState } from 'react';
import { AlertOctagon, Send } from 'lucide-react';
import { connectWallet } from '../utils/ethereum';

const Reports = () => {
  const [submitted, setSubmitted] = useState(false);
  const [hash, setHash] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    
    try {
      let reporterAddress = 'Anonymous';
      if (window.ethereum) {
        const res = await connectWallet();
        if (res) reporterAddress = res.address;
      }

      const response = await fetch('http://localhost:5000/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentHash: hash,
          referenceUrl: url,
          description: desc,
          reporterAddress
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit report');
      }
      
      setSubmitted(true);
      setHash(''); setUrl(''); setDesc('');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto mt-12 p-6 max-w-3xl">
      <h2 className="text-3xl font-bold mb-6 flex items-center">
        <AlertOctagon className="w-8 h-8 mr-3 text-red-500" />
        Report Copyright Infringement
      </h2>
      
      <div className="bg-navy-800 p-8 rounded-xl border border-navy-700 shadow-xl">
        <p className="text-gray-300 mb-6">
          If you believe a registered work infringes on your original copyright, submit a report with evidence. Reports are stored securely off-chain in MongoDB.
        </p>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-sm text-red-300">
            {errorMsg}
          </div>
        )}

        {submitted ? (
          <div className="bg-green-900/20 border border-green-500/30 p-6 rounded-lg text-center space-y-3">
            <h3 className="text-xl font-bold text-green-400">Report Successfully Submitted!</h3>
            <p className="text-gray-300 text-sm">Our moderators will review your claim and follow up accordingly.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-semibold"
            >
              Submit Another Report
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Suspected Content ID or Hash</label>
              <input required value={hash} onChange={e=>setHash(e.target.value)} type="text" className="w-full p-3 bg-navy-900 border border-navy-600 rounded text-white focus:border-electric-blue focus:outline-none" placeholder="0x..." />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Reference URL (Where is it hosted?)</label>
              <input value={url} onChange={e=>setUrl(e.target.value)} type="url" className="w-full p-3 bg-navy-900 border border-navy-600 rounded text-white focus:border-electric-blue focus:outline-none" placeholder="https://" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Description of the Issue</label>
              <textarea required value={desc} onChange={e=>setDesc(e.target.value)} rows={4} className="w-full p-3 bg-navy-900 border border-navy-600 rounded text-white focus:border-electric-blue focus:outline-none" placeholder="Explain why this content infringes on your rights..."></textarea>
            </div>

            <button disabled={isSubmitting} type="submit" className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg transition font-semibold flex justify-center items-center">
              <Send className="w-5 h-5 mr-2" /> {isSubmitting ? 'Submitting Report...' : 'Submit Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Reports;
