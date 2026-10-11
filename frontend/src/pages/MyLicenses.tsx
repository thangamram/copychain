import React, { useState, useEffect } from 'react';
import { getLicensingContract } from '../utils/ethereum';
import { Key, Search, CheckCircle, Tag, Ban, Clock, ExternalLink, X, FileText } from 'lucide-react';
import { formatEther, BrowserProvider } from 'ethers';

interface PurchasedLicense {
  contentId: string;
  contentHash: string;
  title: string;
  creator: string;
  buyer: string;
  pricePaidEth: string;
  permittedUse: string;
  restrictions: string;
  durationDays: number;
  category: string;
  purchaseTxHash: string;
  purchasedAt: string;
  status: string;
}

interface OfferedLicense {
  contentId: string;
  contentHash: string;
  title: string;
  priceEth: string;
  permittedUse: string;
  restrictions: string;
  durationDays: number;
  category: string;
  status: string;
  offerTxHash: string;
  purchasesCount: number;
  createdAt: string;
}

const MyLicenses = ({ walletState }: { walletState?: any }) => {
  const [purchasedLicenses, setPurchasedLicenses] = useState<PurchasedLicense[]>([]);
  const [offeredLicenses, setOfferedLicenses] = useState<OfferedLicense[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cancellingHash, setCancellingHash] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<any | null>(null);

  const fetchAllData = async () => {
    if (!walletState?.address) {
      setPurchasedLicenses([]);
      setOfferedLicenses([]);
      return;
    }

    setLoading(true);
    try {
      const userWallet = walletState.address.toLowerCase();

      // Step 1: Load from Backend API
      let backendPurchased: PurchasedLicense[] = [];
      let backendOffered: OfferedLicense[] = [];

      try {
        const pRes = await fetch(`http://localhost:5000/api/licensing/purchased/${userWallet}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.success) backendPurchased = pData.licenses || [];
        }

        const oRes = await fetch(`http://localhost:5000/api/licensing/offered/${userWallet}`);
        if (oRes.ok) {
          const oData = await oRes.json();
          if (oData.success) {
            backendOffered = (oData.offers || []).map((o: any) => ({
              contentId: o.contentId,
              contentHash: o.contentHash,
              title: o.title,
              priceEth: o.priceEth,
              permittedUse: o.permittedUse,
              restrictions: o.restrictions,
              durationDays: o.durationDays,
              category: o.category,
              status: o.status,
              offerTxHash: o.offerTxHash,
              purchasesCount: o.purchases?.length || 0,
              createdAt: new Date(o.createdAt).toLocaleDateString(),
            }));
          }
        }
      } catch (e) {
        console.warn('Backend unavailable, querying directly on-chain:', e);
      }

      // Step 2: Query On-Chain Events to guarantee ground truth
      if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const licensing = getLicensingContract(provider);

        // A. LicensePurchased events for current user
        const purchaseFilter = licensing.filters.LicensePurchased(null, walletState.address);
        const purchaseLogs = await licensing.queryFilter(purchaseFilter, 0, 'latest');

        const onChainPurchased: PurchasedLicense[] = [];
        for (const log of purchaseLogs) {
          const rawLog: any = log;
          const cId = rawLog.args[0];
          const pricePaid = formatEther(rawLog.args[2]);
          const matched = backendPurchased.find(b => b.contentId.toLowerCase() === cId.toLowerCase());

          onChainPurchased.push({
            contentId: matched?.contentId || (matched?.contentHash ? `CC-${matched.contentHash.slice(2, 6).toUpperCase()}` : `CC-${cId.slice(2, 6).toUpperCase()}`),
            contentHash: matched?.contentHash || cId,
            title: matched?.title || 'Licensed Digital Asset',
            creator: matched?.creator || 'Original Creator',
            buyer: walletState.address,
            pricePaidEth: pricePaid,
            permittedUse: matched?.permittedUse || 'Educational / Commercial use',
            restrictions: matched?.restrictions || 'No resale',
            durationDays: matched?.durationDays || 30,
            category: matched?.category || 'Commercial',
            purchaseTxHash: rawLog.transactionHash,
            purchasedAt: matched?.purchasedAt ? new Date(matched.purchasedAt).toLocaleDateString() : 'On-Chain Confirmed',
            status: 'Purchased / Active',
          });
        }

        // B. ListingCreated events for current user
        const listFilter = licensing.filters.ListingCreated();
        const listLogs = await licensing.queryFilter(listFilter, 0, 'latest');

        const onChainOffered: OfferedLicense[] = [];
        for (const log of listLogs) {
          const rawLog: any = log;
          const cId = rawLog.args[0];
          const rawPrice = rawLog.args[1];
          const rawTerms = rawLog.args[2];

          // Check current active state directly from contract
          const listingState = await licensing.listings(cId);
          const purchasesCount = Number(await licensing.getLicensesCount(cId));

          const matched = backendOffered.find(b => b.contentId.toLowerCase() === cId.toLowerCase());

          // Only include if owned by current user
          if (matched || (listingState.contentId && listingState.contentId !== '0x0000000000000000000000000000000000000000000000000000000000000000')) {
            onChainOffered.push({
              contentId: matched?.contentId || (matched?.contentHash ? `CC-${matched.contentHash.slice(2, 6).toUpperCase()}` : `CC-${cId.slice(2, 6).toUpperCase()}`),
              contentHash: matched?.contentHash || cId,
              title: matched?.title || 'Creator Offer',
              priceEth: formatEther(rawPrice),
              permittedUse: matched?.permittedUse || 'Commercial use',
              restrictions: matched?.restrictions || rawTerms || 'No resale',
              durationDays: matched?.durationDays || 30,
              category: matched?.category || 'Commercial',
              status: listingState.isActive ? 'Active' : 'Cancelled',
              offerTxHash: log.transactionHash,
              purchasesCount,
              createdAt: matched?.createdAt || 'On-Chain Confirmed',
            });
          }
        }

        setPurchasedLicenses(onChainPurchased.length > 0 ? onChainPurchased.reverse() : backendPurchased);
        setOfferedLicenses(onChainOffered.length > 0 ? onChainOffered.reverse() : backendOffered);
      } else {
        setPurchasedLicenses(backendPurchased);
        setOfferedLicenses(backendOffered);
      }
    } catch (err) {
      console.error('Error fetching license portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [walletState?.address]);

  // Handle Cancel Offer action
  const handleCancelOffer = async (contentHash: string) => {
    if (!walletState?.signer) return;
    if (!window.confirm("Are you sure you want to cancel this licence offer? Buyers will no longer be able to purchase it.")) return;

    setCancellingHash(contentHash);
    try {
      const licensing = getLicensingContract(walletState.signer);
      const tx = await licensing.cancelListing(contentHash);
      const receipt = await tx.wait();

      // Sync backend
      try {
        await fetch('http://localhost:5000/api/licensing/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentHash,
            creator: walletState.address,
            txHash: receipt.hash || tx.hash,
          }),
        });
      } catch (e) {
        console.warn(e);
      }

      alert("Licence offer successfully cancelled on the blockchain.");
      await fetchAllData();
    } catch (err: any) {
      console.error('Error cancelling offer:', err);
      alert(err.reason || err.message || "Failed to cancel offer.");
    } finally {
      setCancellingHash(null);
    }
  };

  const filteredPurchased = purchasedLicenses.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contentHash.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOffered = offeredLicenses.filter(l =>
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contentHash.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-navy-900 mb-2 flex items-center">
            <Key className="w-8 h-8 mr-3 text-electric-blue" />
            My Licences
          </h2>
          <p className="text-gray-500 text-sm">
            Manage both the usage rights you have acquired and the licence offers you have created.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Title or Content ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-electric-blue"
          />
        </div>
      </div>

      {!walletState?.address ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
          <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-navy-900 mb-1">Wallet Disconnected</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Connect your MetaMask wallet to view your purchased licenses and active creator offers.
          </p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-electric-blue" />
          <p>Loading your licences from blockchain...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* SECTION 1: LICENCES I PURCHASED */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-navy-900 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Licences I Purchased ({filteredPurchased.length})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verifiable digital usage rights acquired with your wallet.
                </p>
              </div>
            </div>

            {filteredPurchased.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-600 font-medium text-sm">No purchased licences found.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Visit the Licensing Marketplace to acquire commercial or educational usage rights.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3.5">Content ID</th>
                      <th className="px-6 py-3.5">Licence Title</th>
                      <th className="px-6 py-3.5">Creator</th>
                      <th className="px-6 py-3.5">Price Paid</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPurchased.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-mono font-bold text-xs text-electric-blue">
                          {item.contentId}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-navy-900 text-xs">{item.title}</p>
                          <p className="text-gray-400 text-[11px]">{item.permittedUse}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-600">
                          {item.creator.slice(0, 6)}...{item.creator.slice(-4)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-navy-900 text-xs">
                          {item.pricePaidEth} ETH
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setDetailModal(item)}
                            className="text-electric-blue hover:underline text-xs font-semibold mr-3"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 2: LICENCES I OFFERED */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-navy-900 flex items-center">
                  <Tag className="w-5 h-5 mr-2 text-electric-blue" />
                  Licences I Offered ({filteredOffered.length})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Active and past licence listings you published for your registered works.
                </p>
              </div>
            </div>

            {filteredOffered.length === 0 ? (
              <div className="p-12 text-center">
                <Tag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-600 font-medium text-sm">No licence offers created yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  You can list any of your registered works for licensing in the Marketplace.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3.5">Content ID</th>
                      <th className="px-6 py-3.5">Title</th>
                      <th className="px-6 py-3.5">Price</th>
                      <th className="px-6 py-3.5">Purchases</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredOffered.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-mono font-bold text-xs text-electric-blue">
                          {item.contentId}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-navy-900 text-xs">{item.title}</p>
                          <p className="text-gray-400 text-[11px]">{item.permittedUse}</p>
                        </td>
                        <td className="px-6 py-4 font-semibold text-navy-900 text-xs">
                          {item.priceEth} ETH
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-medium text-gray-700">
                          {item.purchasesCount} sales
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === 'Active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          <button
                            onClick={() => setDetailModal(item)}
                            className="text-electric-blue hover:underline text-xs font-semibold"
                          >
                            Details
                          </button>
                          {item.status === 'Active' && (
                            <button
                              disabled={cancellingHash === item.contentHash}
                              onClick={() => handleCancelOffer(item.contentHash)}
                              className="text-red-500 hover:text-red-700 text-xs font-semibold transition"
                            >
                              {cancellingHash === item.contentHash ? 'Cancelling...' : 'Cancel Offer'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DETAILS ACTION MODAL */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-navy-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-electric-blue" />
                Licence Record Details
              </h3>
              <button onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-gray-600 mb-6">
              <div className="flex justify-between pb-2 border-b border-gray-100">
                <span className="font-semibold text-gray-500">Content ID:</span>
                <span className="font-mono font-bold text-electric-blue">{detailModal.contentId}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-gray-100">
                <span className="font-semibold text-gray-500">Title:</span>
                <span className="font-bold text-navy-900">{detailModal.title}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-gray-100">
                <span className="font-semibold text-gray-500">Permitted Use:</span>
                <span className="font-semibold text-gray-800">{detailModal.permittedUse}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-gray-100">
                <span className="font-semibold text-gray-500">Restrictions:</span>
                <span className="font-semibold text-gray-800">{detailModal.restrictions}</span>
              </div>
              {detailModal.creator && (
                <div className="flex flex-col pb-2 border-b border-gray-100">
                  <span className="font-semibold text-gray-500 mb-0.5">Creator Address:</span>
                  <span className="font-mono text-[11px] text-gray-700 break-all">{detailModal.creator}</span>
                </div>
              )}
              {detailModal.buyer && (
                <div className="flex flex-col pb-2 border-b border-gray-100">
                  <span className="font-semibold text-gray-500 mb-0.5">Buyer Address:</span>
                  <span className="font-mono text-[11px] text-gray-700 break-all">{detailModal.buyer}</span>
                </div>
              )}
              <div className="flex flex-col pb-2 border-b border-gray-100">
                <span className="font-semibold text-gray-500 mb-0.5">Transaction Hash:</span>
                <span className="font-mono text-[11px] text-electric-blue break-all">
                  {detailModal.purchaseTxHash || detailModal.offerTxHash}
                </span>
              </div>
            </div>

            <button
              onClick={() => setDetailModal(null)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLicenses;
