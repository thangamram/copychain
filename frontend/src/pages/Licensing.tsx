import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Tag, CheckCircle, Search, Filter, AlertCircle, Plus, 
  ExternalLink, ShieldCheck, Clock, FileText, Ban, Check, X, Info
} from 'lucide-react';
import { getLicensingContract, getRegistryContract, LICENSING_ADDRESS } from '../utils/ethereum';
import { parseEther, formatEther, BrowserProvider } from 'ethers';

interface LicenseOffer {
  contentId: string;
  contentHash: string;
  title: string;
  description: string;
  creator: string;
  priceEth: string;
  permittedUse: string;
  restrictions: string;
  durationDays: number;
  category: string;
  status: 'Active' | 'Purchased' | 'Cancelled' | 'Expired';
  offerTxHash: string;
  purchases?: any[];
}

interface UserWork {
  hash: string;
  contentId?: string;
  timestamp: string;
}

const Licensing = ({ walletState }: { walletState?: any }) => {
  const [offers, setOffers] = useState<LicenseOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [userWorks, setUserWorks] = useState<UserWork[]>([]);
  
  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPermittedUse, setSelectedPermittedUse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('Active');

  // Create Offer Modal / Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWorkHash, setSelectedWorkHash] = useState('');
  const [licenseTitle, setLicenseTitle] = useState('Educational Use Licence');
  const [description, setDescription] = useState('Authorized educational and research usage license.');
  const [permittedUse, setPermittedUse] = useState('Educational use');
  const [restrictions, setRestrictions] = useState('No resale or commercial redistribution');
  const [durationDays, setDurationDays] = useState('30');
  const [priceEth, setPriceEth] = useState('0.01');
  const [category, setCategory] = useState('Educational');
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  // Purchase Modal State
  const [selectedOfferForPurchase, setSelectedOfferForPurchase] = useState<LicenseOffer | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseModalError, setPurchaseModalError] = useState<string | null>(null);
  
  // Details Modal State
  const [detailOffer, setDetailOffer] = useState<LicenseOffer | null>(null);

  // Active Network and Account diagnostics
  const [activeChainId, setActiveChainId] = useState<string>('');
  const [activeWallet, setActiveWallet] = useState<string>('');
  const [allRegisteredWorks, setAllRegisteredWorks] = useState<{ hash: string; contentId: string; creator: string; timestamp: string }[]>([]);

  // Toast / Alert State
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string; txHash?: string } | null>(null);

  const handleSwitchToLocalhost = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7a69' }], // 31337 in hex
      });
      setTimeout(() => {
        fetchUserWorks();
        loadMarketplace();
      }, 500);
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x7a69',
                chainName: 'Hardhat Localhost',
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              },
            ],
          });
          setTimeout(() => {
            fetchUserWorks();
            loadMarketplace();
          }, 500);
        } catch (addError) {
          console.error(addError);
        }
      }
    }
  };

  const [isFunding, setIsFunding] = useState(false);
  const handleRequestFaucet = async () => {
    if (!activeWallet) return;
    setIsFunding(true);
    try {
      const res = await fetch('http://localhost:5000/api/licensing/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: activeWallet }),
      });
      const data = await res.json();
      if (data.success) {
        setPurchaseModalError(null);
        setNotification({ type: 'success', message: `Funded ${activeWallet.slice(0, 6)}...${activeWallet.slice(-4)} with 50 test ETH! You can now complete the purchase.` });
      }
    } catch (e: any) {
      console.error('Faucet request failed:', e);
    } finally {
      setIsFunding(false);
    }
  };

  // 1. Fetch User's Registered Works for the creator work selector
  const fetchUserWorks = async () => {
    if (!window.ethereum) {
      setUserWorks([]);
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      try {
        const net = await provider.getNetwork();
        setActiveChainId(net.chainId.toString());
      } catch (e) {}

      const accounts = await provider.send('eth_accounts', []);
      const activeAddr = (accounts[0] || walletState?.address || '').toLowerCase();
      setActiveWallet(activeAddr);

      if (!activeAddr) {
        setUserWorks([]);
        return;
      }

      const registry = getRegistryContract(provider);

      const contentFilter = registry.filters.ContentRegistered();
      const contentLogs = await registry.queryFilter(contentFilter, 0, 'latest');

      const derivativeFilter = registry.filters.DerivativeRegistered();
      const derivativeLogs = await registry.queryFilter(derivativeFilter, 0, 'latest');

      const allOnChain = [
        ...contentLogs.map((l: any) => ({
          hash: l.args[1],
          contentId: `CC-${(l.args[1] || '').slice(2, 6).toUpperCase()}`,
          creator: l.args[2].toLowerCase(),
          rawTime: Number(l.args[3]),
          timestamp: new Date(Number(l.args[3]) * 1000).toLocaleString(),
        })),
        ...derivativeLogs.map((l: any) => ({
          hash: l.args[2],
          contentId: `CC-${(l.args[2] || '').slice(2, 6).toUpperCase()}`,
          creator: l.args[3].toLowerCase(),
          rawTime: Number(l.args[4]),
          timestamp: new Date(Number(l.args[4]) * 1000).toLocaleString(),
        }))
      ].sort((a, b) => b.rawTime - a.rawTime);
      setAllRegisteredWorks(allOnChain);

      const myWorks = allOnChain.filter(w => w.creator === activeAddr);
      setUserWorks(myWorks);

      setSelectedWorkHash((prev) => {
        if (!prev || !myWorks.some(w => w.hash.toLowerCase() === prev.toLowerCase())) {
          return myWorks.length > 0 ? myWorks[0].hash : '';
        }
        return prev;
      });
    } catch (err) {
      console.error('Error fetching user registered works:', err);
    }
  };

  useEffect(() => {
    fetchUserWorks();

    if (window.ethereum) {
      const handleAccountsOrChainChanged = () => {
        fetchUserWorks();
        loadMarketplace();
      };
      window.ethereum.on('accountsChanged', handleAccountsOrChainChanged);
      window.ethereum.on('chainChanged', handleAccountsOrChainChanged);
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsOrChainChanged);
        window.ethereum.removeListener('chainChanged', handleAccountsOrChainChanged);
      };
    }
  }, [walletState?.address]);

  // 2. Fetch Marketplace Offers from both Smart Contract and Backend
  const loadMarketplace = async () => {
    setLoading(true);
    try {
      // Step A: Load from Backend API
      let backendOffers: LicenseOffer[] = [];
      try {
        const res = await fetch('http://localhost:5000/api/licensing');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            backendOffers = data.offers || [];
          }
        }
      } catch (apiErr) {
        console.warn('Backend API not responding, falling back directly to on-chain events:', apiErr);
      }

      // Step B: Query Smart Contract Events directly for guaranteed ground truth
      if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const licensing = getLicensingContract(provider);
        const registry = getRegistryContract(provider);

        const filter = licensing.filters.ListingCreated();
        const logs = await licensing.queryFilter(filter, 0, 'latest');

        const onChainOffers: LicenseOffer[] = [];
        for (const log of logs) {
          const rawLog: any = log;
          const contentId = rawLog.args[0];
          const rawPrice = rawLog.args[1];
          const rawTerms = rawLog.args[2];

          // Check current active state from contract mapping
          const listingState = await licensing.listings(contentId);
          const isActive = listingState.isActive;

          // Lookup authoritative registration directly from smart contract storage
          let contentHash = '';
          let creator = '';
          try {
            const regInfo = await registry.registrations(contentId);
            if (regInfo && regInfo.contentHash) {
              contentHash = regInfo.contentHash;
              creator = regInfo.creator;
            }
          } catch (e) {
            console.warn('Error reading registrations mapping:', e);
          }

          // Match supplementary backend metadata
          const matched = backendOffers.find(b => 
            (b.contentHash && contentHash && b.contentHash.toLowerCase() === contentHash.toLowerCase()) ||
            (b.contentId && contentId && b.contentId.toLowerCase() === contentId.toLowerCase()) ||
            (contentHash && b.contentId && b.contentId.toLowerCase() === `cc-${contentHash.slice(2, 6)}`.toLowerCase())
          );

          if (!contentHash && matched?.contentHash) contentHash = matched.contentHash;
          if (!creator && matched?.creator) creator = matched.creator;

          const displayId = contentHash ? `CC-${contentHash.slice(2, 6).toUpperCase()}` : `CC-${contentId.slice(2, 6).toUpperCase()}`;

          const offerItem: LicenseOffer = {
            contentId: displayId,
            contentHash: contentHash,
            title: matched?.title || 'Registered Digital Asset Licence',
            description: matched?.description || 'Smart contract verified digital usage license.',
            creator: creator || matched?.creator || '0xCreator',
            priceEth: formatEther(rawPrice),
            permittedUse: matched?.permittedUse || rawTerms.split(';')[0]?.trim() || 'Educational use',
            restrictions: matched?.restrictions || rawTerms.split(';')[1]?.trim() || rawTerms || 'No resale',
            durationDays: matched?.durationDays || 30,
            category: matched?.category || 'Educational',
            status: isActive ? 'Active' : 'Cancelled',
            offerTxHash: log.transactionHash,
            purchases: matched?.purchases || []
          };

          onChainOffers.push(offerItem);
        }

        // Deduplicate and prioritize latest status
        const mergedMap = new Map<string, LicenseOffer>();
        onChainOffers.forEach(o => mergedMap.set(o.contentId.toLowerCase(), o));
        backendOffers.forEach(b => {
          if (!mergedMap.has(b.contentId.toLowerCase())) {
            mergedMap.set(b.contentId.toLowerCase(), b);
          }
        });

        setOffers(Array.from(mergedMap.values()).reverse());
      } else {
        setOffers(backendOffers);
      }
    } catch (err) {
      console.error('Error loading marketplace:', err);
      setNotification({ type: 'error', message: 'Error loading live marketplace data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplace();
  }, [walletState?.address]);

  // 3. Handle Creator A — Create a Licence Offer
  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetHash = selectedWorkHash.trim();
    if (!targetHash) {
      setNotification({ type: 'error', message: 'Please select a registered work.' });
      return;
    }

    if (!priceEth || Number(priceEth) <= 0) {
      setNotification({ type: 'error', message: 'Please enter a valid price greater than 0 ETH.' });
      return;
    }

    setIsSubmittingOffer(true);
    setNotification(null);

    try {
      if (!window.ethereum) throw new Error("MetaMask is not detected. Please install and connect MetaMask.");
      
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const currentAddress = await signer.getAddress();
      const registry = getRegistryContract(provider);
      const licensing = getLicensingContract(signer);

      // Verify on-chain registration and ownership first
      const isReg = await registry.isRegistered(targetHash);
      if (!isReg) {
        throw new Error("This work is not registered on the current blockchain registry. Please select a registered work from the dropdown.");
      }

      const reg = await registry.getRegistration(targetHash);
      if (reg.creator.toLowerCase() !== currentAddress.toLowerCase()) {
        throw new Error(`Only the registered creator (${reg.creator.slice(0, 6)}...${reg.creator.slice(-4)}) can offer a licence for this work.`);
      }

      // Verify not already listed
      const listing = await licensing.listings(reg.contentId);
      if (listing.isActive) {
        throw new Error("This work already has an active licence offer in the marketplace. You can manage it under 'My Licences'.");
      }

      const contentId = reg.contentId;
      const formattedContentId = `CC-${(targetHash.slice(2, 6) || contentId.slice(2, 6)).toUpperCase()}`;

      // Submit real on-chain transaction
      const priceWei = parseEther(priceEth);
      const combinedTerms = `${permittedUse}; ${restrictions}`;
      
      const tx = await licensing.createListing(targetHash, priceWei, combinedTerms);
      const receipt = await tx.wait();

      // Record off-chain metadata in backend/MongoDB
      try {
        await fetch('http://localhost:5000/api/licensing/offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: formattedContentId,
            contentHash: targetHash,
            title: licenseTitle,
            description,
            creator: currentAddress,
            priceEth,
            permittedUse,
            restrictions,
            durationDays: Number(durationDays) || 0,
            category,
            offerTxHash: receipt.hash || tx.hash,
          }),
        });
      } catch (postErr) {
        console.warn('Backend sync warning:', postErr);
      }

      setNotification({
        type: 'success',
        message: 'Licence offer successfully created and verified on the blockchain!',
        txHash: receipt.hash || tx.hash,
      });

      setShowCreateModal(false);
      await loadMarketplace();
      await fetchUserWorks();
    } catch (err: any) {
      console.error('Error creating offer:', err);
      const msg = err.reason || (err.data && err.data.message) || err.message || 'Transaction failed.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  // 4. Handle Creator B — Purchase Licence
  const handleConfirmPurchase = async () => {
    if (!selectedOfferForPurchase) return;
    setPurchaseModalError(null);

    if (!termsAccepted) {
      setPurchaseModalError('You must review and accept the licence terms before proceeding.');
      return;
    }

    if (!window.ethereum) {
      setPurchaseModalError('MetaMask is not detected. Please install and connect MetaMask.');
      return;
    }

    setIsPurchasing(true);
    setNotification(null);

    try {
      const provider = new BrowserProvider(window.ethereum);
      
      // 1. Validate Network
      try {
        const net = await provider.getNetwork();
        if (net.chainId !== 31337n) {
          throw new Error(`Wrong network detected (Chain ID: ${net.chainId}). Please switch MetaMask to Hardhat Localhost (Chain ID: 31337).`);
        }
      } catch (netErr: any) {
        if (netErr.message && netErr.message.includes('Wrong network')) throw netErr;
      }

      // 2. Validate Signer & Buyer Address
      const signer = await provider.getSigner();
      const currentAddress = await signer.getAddress();

      if (selectedOfferForPurchase.creator.toLowerCase() === currentAddress.toLowerCase()) {
        throw new Error('You cannot purchase your own licence offer. In MetaMask, please switch to a different account (Creator B / Account 2) to purchase.');
      }

      const licensing = getLicensingContract(signer);
      const registry = getRegistryContract(provider);

      // 3. Resolve and Verify Content Hash
      let targetHash = selectedOfferForPurchase.contentHash;
      if (!targetHash || !targetHash.startsWith('0x')) {
        // Fallback: look up registrations mapping
        try {
          const regInfo = await registry.registrations(selectedOfferForPurchase.contentId);
          if (regInfo && regInfo.contentHash) {
            targetHash = regInfo.contentHash;
          }
        } catch (e) {}
      }

      if (!targetHash) {
        throw new Error('Unable to resolve registered content hash for this licence offer.');
      }

      const cId = await registry.hashToContentId(targetHash);
      if (cId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        throw new Error('This work is not registered on the smart contract registry.');
      }

      // 4. Verify Offer Status
      const listingState = await licensing.listings(cId);
      if (!listingState.isActive) {
        throw new Error('This licence offer is no longer active in the marketplace.');
      }

      // 5. Verify Duplicate Purchase Prevention
      const alreadyLicensed = await licensing.hasLicense(cId, currentAddress);
      if (alreadyLicensed) {
        throw new Error('You already hold a verified licence for this content! You can inspect your licence under "My Licences".');
      }

      // 6. Check Buyer Balance
      const balance = await provider.getBalance(currentAddress);
      const priceWei = parseEther(selectedOfferForPurchase.priceEth);
      if (balance < priceWei) {
        throw new Error(`Insufficient ETH balance (${formatEther(balance)} ETH) to purchase this licence (${selectedOfferForPurchase.priceEth} ETH).`);
      }

      // 7. Submit Payable Purchase Transaction to Smart Contract
      const tx = await licensing.purchaseLicense(targetHash, {
        value: priceWei,
      });

      const receipt = await tx.wait();

      // 8. Record confirmed purchase in backend
      try {
        await fetch('http://localhost:5000/api/licensing/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentHash: targetHash,
            buyer: currentAddress,
            purchaseTxHash: receipt.hash || tx.hash,
            pricePaidEth: selectedOfferForPurchase.priceEth,
          }),
        });
      } catch (postErr) {
        console.warn('Backend sync warning:', postErr);
      }

      setNotification({
        type: 'success',
        message: `Licence purchased successfully! You now have verified rights to "${selectedOfferForPurchase.title}".`,
        txHash: receipt.hash || tx.hash,
      });

      setSelectedOfferForPurchase(null);
      setTermsAccepted(false);
      setPurchaseModalError(null);
      await loadMarketplace();
    } catch (err: any) {
      console.error('Error purchasing licence:', err);
      let msg = err.reason || (err.data && err.data.message) || err.message || 'Purchase failed.';
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
        msg = 'Transaction was rejected in MetaMask.';
      }
      setPurchaseModalError(msg);
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsPurchasing(false);
    }
  };

  // Filter offers based on user input
  const filteredOffers = offers.filter(o => {
    if (selectedStatus !== 'All' && o.status !== selectedStatus) return false;
    if (selectedCategory !== 'All' && o.category !== selectedCategory) return false;
    if (selectedPermittedUse !== 'All' && o.permittedUse !== selectedPermittedUse) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = o.title.toLowerCase().includes(q) ||
        o.contentId.toLowerCase().includes(q) ||
        o.contentHash.toLowerCase().includes(q) ||
        o.creator.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-navy-900 tracking-tight flex items-center">
            <ShoppingCart className="w-8 h-8 mr-3 text-electric-blue" />
            Licensing Marketplace
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Browse and purchase verifiable usage rights registered directly on the Ethereum blockchain.
          </p>
        </div>
        <button
          onClick={async () => {
            let activeAddr = walletState?.address;
            if (!activeAddr && window.ethereum) {
              try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0) activeAddr = accounts[0];
              } catch (e) {}
            }

            if (!activeAddr) {
              setNotification({ type: 'error', message: 'Please connect your MetaMask wallet first.' });
              return;
            }

            await fetchUserWorks();
            setShowCreateModal(true);
          }}
          className="flex items-center px-5 py-2.5 bg-electric-blue hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Offer a Licence
        </button>
      </div>

      {/* Notifications / Alerts */}
      {notification && (
        <div className={`p-4 rounded-xl mb-6 flex items-start justify-between border ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-900' 
            : notification.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-start">
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-3 shrink-0 mt-0.5" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 mr-3 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">{notification.message}</p>
              {notification.txHash && (
                <p className="text-xs font-mono mt-1 opacity-80 break-all">
                  Tx Hash: {notification.txHash}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by title, ID, hash, creator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-electric-blue focus:ring-1 focus:ring-electric-blue"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-electric-blue"
            >
              <option value="All">All Categories</option>
              <option value="Educational">Educational</option>
              <option value="Commercial">Commercial</option>
              <option value="Personal">Personal</option>
              <option value="Research">Research</option>
              <option value="Editorial">Editorial</option>
            </select>
          </div>

          <div>
            <select
              value={selectedPermittedUse}
              onChange={(e) => setSelectedPermittedUse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-electric-blue"
            >
              <option value="All">All Permitted Uses</option>
              <option value="Educational use">Educational use</option>
              <option value="Personal use">Personal use</option>
              <option value="Commercial use">Commercial use</option>
              <option value="Research use">Research use</option>
              <option value="Online publication">Online publication</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-electric-blue"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Offers</option>
              <option value="Purchased">Purchased</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Offers Grid */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-electric-blue" />
          <p>Loading real-time marketplace offers from blockchain...</p>
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-navy-900 mb-1">No Licence Offers Found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            There are currently no active offers matching your filters. Creators can list licences for their registered works directly above.
          </p>
          {walletState?.address && userWorks.length > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-sm font-semibold transition"
            >
              Create the First Offer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map((offer, idx) => {
            const isCreator = Boolean(
              (activeWallet && offer.creator && offer.creator.toLowerCase() === activeWallet.toLowerCase()) ||
              (walletState?.address && offer.creator && offer.creator.toLowerCase() === walletState.address.toLowerCase())
            );

            return (
              <div 
                key={idx} 
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                {/* Card Top Preview */}
                <div className="h-44 bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex flex-col justify-between border-b border-gray-100 relative">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-bold bg-white/90 border border-gray-200 px-2.5 py-1 rounded-md text-electric-blue">
                      {offer.contentId}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      offer.status === 'Active'
                        ? 'bg-green-100 text-green-700'
                        : offer.status === 'Purchased'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {offer.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                      {offer.category} Licence
                    </span>
                    <h3 className="font-bold text-lg text-navy-900 truncate" title={offer.title}>
                      {offer.title}
                    </h3>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 flex-grow flex flex-col justify-between">
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Creator:</span>
                      <span className="font-mono font-medium text-gray-700">
                        {offer.creator.slice(0, 6)}...{offer.creator.slice(-4)} {isCreator && '(You)'}
                      </span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Permitted Use:</span>
                        <span className="font-semibold text-gray-800">{offer.permittedUse}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Restrictions:</span>
                        <span className="font-semibold text-gray-800 truncate max-w-[160px]" title={offer.restrictions}>
                          {offer.restrictions}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration:</span>
                        <span className="font-semibold text-gray-800">
                          {offer.durationDays > 0 ? `${offer.durationDays} Days` : 'Perpetual'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-500">Licence Price:</span>
                      <span className="text-xl font-bold text-navy-900 flex items-center">
                        <Tag className="w-4 h-4 text-electric-blue mr-1" />
                        {offer.priceEth} ETH
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDetailOffer(offer)}
                      className="w-1/2 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold transition"
                    >
                      Details
                    </button>

                    {isCreator ? (
                      <button
                        disabled
                        className="w-1/2 py-2 bg-gray-100 text-gray-400 rounded-lg text-xs font-semibold cursor-not-allowed"
                      >
                        Your Offer
                      </button>
                    ) : offer.status === 'Active' ? (
                      <button
                        onClick={() => {
                          setSelectedOfferForPurchase(offer);
                          setTermsAccepted(false);
                        }}
                        className="w-1/2 py-2 bg-electric-blue hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                      >
                        Purchase Licence
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-1/2 py-2 bg-gray-100 text-gray-400 rounded-lg text-xs font-semibold cursor-not-allowed"
                      >
                        Unavailable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE OFFER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-navy-900 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-electric-blue" />
                Create Licence Offer
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-4">
              {activeChainId && activeChainId !== '31337' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex justify-between items-center">
                  <div>
                    <strong>⚠️ Wrong Network (Chain ID: {activeChainId}):</strong>
                    <p className="text-[11px] text-red-700">Contract is on Hardhat Localhost (Chain ID: 31337).</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchToLocalhost}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-xs whitespace-nowrap ml-2 shadow-sm"
                  >
                    Switch to Localhost
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="font-semibold uppercase tracking-wider text-gray-600">
                    1. Select Registered Work *
                  </span>
                  {activeWallet && (
                    <span className="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                      Active: {activeWallet.slice(0, 6)}...{activeWallet.slice(-4)}
                    </span>
                  )}
                </div>

                {userWorks.length > 0 ? (
                  <div className="space-y-1">
                    <select
                      required
                      value={selectedWorkHash}
                      onChange={(e) => setSelectedWorkHash(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:outline-none focus:border-electric-blue font-mono"
                    >
                      {userWorks.map((w, i) => (
                        <option key={i} value={w.hash}>
                          {w.contentId} — {w.hash.slice(0, 12)}...{w.hash.slice(-8)} (Reg: {w.timestamp})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] font-mono text-gray-500 break-all bg-gray-50 p-1.5 rounded border border-gray-200">
                      Active Hash: {selectedWorkHash}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-3">
                    <p className="font-semibold text-amber-950">
                      No registered works found for active wallet ({activeWallet ? `${activeWallet.slice(0, 6)}...${activeWallet.slice(-4)}` : 'not detected'}).
                    </p>

                    {allRegisteredWorks.length > 0 ? (
                      <div className="bg-white/90 p-3 rounded-lg border border-amber-200 space-y-2">
                        <p className="font-medium text-amber-900">
                          💡 <strong>Found {allRegisteredWorks.length} registered work(s) on this blockchain:</strong>
                        </p>
                        <div className="space-y-1">
                          {Array.from(new Set(allRegisteredWorks.map(w => w.creator))).map((creatorAddr, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] bg-amber-50 p-1.5 rounded">
                              <span className="font-mono font-bold text-gray-800">
                                {creatorAddr.slice(0, 8)}...{creatorAddr.slice(-6)}
                              </span>
                              <span className="text-gray-500">
                                {creatorAddr.toLowerCase() === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' ? '(MetaMask Account 1)' : 'Creator'}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-600">
                          👉 <strong>To create an offer:</strong> In MetaMask, switch your account to <strong>Account 1</strong> (or the account that registered the content).
                        </p>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-1">
                      <a
                        href="/register"
                        className="inline-flex items-center px-3.5 py-1.5 bg-electric-blue hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm"
                      >
                        Register New Work in CopyChain →
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    2. Licence Title *
                  </label>
                  <input
                    required
                    type="text"
                    value={licenseTitle}
                    onChange={(e) => setLicenseTitle(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-electric-blue outline-none"
                    placeholder="e.g. Educational Use Licence"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    3. Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:border-electric-blue outline-none"
                  >
                    <option value="Educational">Educational</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Personal">Personal</option>
                    <option value="Research">Research</option>
                    <option value="Editorial">Editorial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                  4. Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-electric-blue outline-none"
                  placeholder="Terms summary or usage instructions..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    5. Permitted Use *
                  </label>
                  <select
                    value={permittedUse}
                    onChange={(e) => setPermittedUse(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:border-electric-blue outline-none"
                  >
                    <option value="Educational use">Educational use</option>
                    <option value="Personal use">Personal use</option>
                    <option value="Commercial use">Commercial use</option>
                    <option value="Research use">Research use</option>
                    <option value="Online publication">Online publication</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    6. Restrictions *
                  </label>
                  <select
                    value={restrictions}
                    onChange={(e) => setRestrictions(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:border-electric-blue outline-none"
                  >
                    <option value="No resale or commercial redistribution">No resale or commercial redistribution</option>
                    <option value="No modification">No modification</option>
                    <option value="Modification allowed only with permission">Modification allowed only with permission</option>
                    <option value="Commercial use prohibited">Commercial use prohibited</option>
                    <option value="Attribution required">Attribution required</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    7. Price (ETH) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={priceEth}
                    onChange={(e) => setPriceEth(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-electric-blue outline-none font-mono"
                    placeholder="0.01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    8. Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-electric-blue outline-none"
                    placeholder="30 (0 = Perpetual)"
                  />
                </div>
              </div>

              {/* Pre-submission Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-1 text-gray-600">
                <p className="font-semibold text-gray-800 mb-1">Offer Summary:</p>
                <p>• <strong>Price:</strong> {priceEth} ETH directly deposited to your wallet on purchase.</p>
                <p>• <strong>Rights:</strong> {permittedUse} ({restrictions})</p>
                <p>• <strong>Duration:</strong> {durationDays > '0' ? `${durationDays} Days` : 'Perpetual'}</p>
                <p>• <strong>Smart Contract:</strong> {LICENSING_ADDRESS.slice(0, 16)}...</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/3 py-2.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-semibold text-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOffer || userWorks.length === 0 || !selectedWorkHash}
                  className="w-2/3 py-2.5 bg-electric-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmittingOffer ? 'Confirming in MetaMask...' : 'Confirm on Blockchain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PURCHASE CONFIRMATION MODAL */}
      {selectedOfferForPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-navy-900 flex items-center">
                <Tag className="w-5 h-5 mr-2 text-electric-blue" />
                Purchase Licence
              </h3>
              <button 
                onClick={() => setSelectedOfferForPurchase(null)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Buyer Wallet & Network Pill */}
              <div className="flex justify-between items-center bg-blue-50/70 border border-blue-200 p-2.5 rounded-xl text-xs">
                <span className="text-blue-900 font-semibold">Paying with Active Wallet:</span>
                <span className="font-mono font-bold text-blue-950 bg-white px-2 py-0.5 rounded border border-blue-200">
                  {activeWallet ? `${activeWallet.slice(0, 6)}...${activeWallet.slice(-4)}` : 'Detecting...'}
                </span>
              </div>

              {/* Creator vs Buyer Warning */}
              {activeWallet && selectedOfferForPurchase.creator && activeWallet.toLowerCase() === selectedOfferForPurchase.creator.toLowerCase() && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Connected with Creator Account ({activeWallet.slice(0, 6)}...{activeWallet.slice(-4)})</p>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      The blockchain contract prohibits purchasing your own licence offer. To complete a test purchase, please switch MetaMask to <strong>Account 2 (Creator B)</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Wrong Network Warning */}
              {activeChainId && activeChainId !== '31337' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex justify-between items-center">
                  <span>⚠️ Connected to Chain ID {activeChainId} (Requires Localhost 31337)</span>
                  <button
                    type="button"
                    onClick={handleSwitchToLocalhost}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold shadow-sm"
                  >
                    Switch Network
                  </button>
                </div>
              )}

              {/* In-Modal Error Banner */}
              {purchaseModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex flex-col gap-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-grow">
                      <p className="font-semibold text-red-950">Purchase Failed</p>
                      <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">{purchaseModalError}</p>
                    </div>
                  </div>
                  {purchaseModalError.includes('Insufficient ETH') && (
                    <div className="pt-1 border-t border-red-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-red-700">Need test ETH for this account?</span>
                      <button
                        type="button"
                        disabled={isFunding}
                        onClick={handleRequestFaucet}
                        className="px-3 py-1.5 bg-electric-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                      >
                        {isFunding ? 'Funding wallet...' : '🚰 Get 50 Test ETH (Faucet)'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Licence Title:</span>
                  <span className="font-semibold text-gray-800">{selectedOfferForPurchase.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Content ID:</span>
                  <span className="font-mono font-bold text-electric-blue">{selectedOfferForPurchase.contentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Creator Wallet:</span>
                  <span className="font-mono text-gray-700 break-all">{selectedOfferForPurchase.creator}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Permitted Use:</span>
                  <span className="font-semibold text-gray-800">{selectedOfferForPurchase.permittedUse}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Restrictions:</span>
                  <span className="font-semibold text-gray-800">{selectedOfferForPurchase.restrictions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-semibold text-gray-800">
                    {selectedOfferForPurchase.durationDays > 0 ? `${selectedOfferForPurchase.durationDays} Days` : 'Perpetual'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 text-sm">
                  <span className="font-bold text-gray-700">Total Price:</span>
                  <span className="font-bold text-navy-900 text-base">{selectedOfferForPurchase.priceEth} ETH</span>
                </div>
              </div>

              {/* Review and Accept Terms Checkbox */}
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (purchaseModalError) setPurchaseModalError(null);
                  }}
                  className="mt-1 rounded text-electric-blue focus:ring-electric-blue"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  I have reviewed and agree to the smart contract licence terms ({selectedOfferForPurchase.permittedUse}; {selectedOfferForPurchase.restrictions}). I understand this purchase is recorded immutably on the blockchain.
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedOfferForPurchase(null);
                  setPurchaseModalError(null);
                }}
                className="w-1/3 py-2.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-semibold text-gray-700 transition"
              >
                Cancel
              </button>
              {(() => {
                const isOwnOffer = Boolean(
                  activeWallet && selectedOfferForPurchase.creator && 
                  activeWallet.toLowerCase() === selectedOfferForPurchase.creator.toLowerCase()
                );

                return (
                  <button
                    type="button"
                    disabled={!termsAccepted || isPurchasing || isOwnOffer}
                    onClick={handleConfirmPurchase}
                    className="w-2/3 py-2.5 bg-electric-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition shadow-sm cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPurchasing ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Waiting for confirmation...
                      </>
                    ) : isOwnOffer ? (
                      'Switch to Buyer Account'
                    ) : (
                      `Pay ${selectedOfferForPurchase.priceEth} ETH`
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {detailOffer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-navy-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-electric-blue" />
                Licence Details
              </h3>
              <button onClick={() => setDetailOffer(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm mb-6">
              <div>
                <span className="text-xs font-semibold uppercase text-gray-400 block">Title</span>
                <p className="font-bold text-navy-900 text-lg">{detailOffer.title}</p>
                <p className="text-gray-600 text-xs mt-1">{detailOffer.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Content ID</span>
                  <span className="font-mono font-bold text-electric-blue">{detailOffer.contentId}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Price</span>
                  <span className="font-bold text-navy-900">{detailOffer.priceEth} ETH</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Permitted Use</span>
                  <span className="font-semibold text-gray-800">{detailOffer.permittedUse}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Restrictions</span>
                  <span className="font-semibold text-gray-800">{detailOffer.restrictions}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase text-gray-400 block mb-1">Registered Content Hash</span>
                <p className="font-mono text-xs p-2.5 bg-gray-50 border border-gray-200 rounded text-gray-700 break-all">
                  {detailOffer.contentHash}
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase text-gray-400 block mb-1">Creator Wallet</span>
                <p className="font-mono text-xs p-2.5 bg-gray-50 border border-gray-200 rounded text-gray-700 break-all">
                  {detailOffer.creator}
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase text-gray-400 block mb-1">Offer Transaction Hash</span>
                <p className="font-mono text-xs p-2.5 bg-gray-50 border border-gray-200 rounded text-electric-blue break-all">
                  {detailOffer.offerTxHash}
                </p>
              </div>
            </div>

            <button
              onClick={() => setDetailOffer(null)}
              className="w-full py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Licensing;
