import express from 'express';
import mongoose from 'mongoose';
import License from '../models/License.js';

const router = express.Router();

// Memory store fallback if MongoDB is in offline mode
const memoryOffers = [];

const isDbConnected = () => mongoose.connection.readyState === 1;

// GET /api/licensing - list active offers with search/filtering
router.get('/', async (req, res) => {
  try {
    const { search, category, permittedUse, status } = req.query;

    if (isDbConnected()) {
      const query = {};
      if (status) {
        query.status = status;
      } else {
        query.status = { $in: ['Active', 'Purchased'] };
      }

      if (category && category !== 'All') {
        query.category = category;
      }

      if (permittedUse && permittedUse !== 'All') {
        query.permittedUse = permittedUse;
      }

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { title: searchRegex },
          { contentId: searchRegex },
          { contentHash: searchRegex },
          { creator: searchRegex },
        ];
      }

      const offers = await License.find(query).sort({ createdAt: -1 });
      return res.json({ success: true, offers });
    }

    // Memory fallback
    let filtered = memoryOffers.filter(o => {
      if (status && o.status !== status) return false;
      if (!status && o.status !== 'Active' && o.status !== 'Purchased') return false;
      if (category && category !== 'All' && o.category !== category) return false;
      if (permittedUse && permittedUse !== 'All' && o.permittedUse !== permittedUse) return false;
      if (search) {
        const s = search.toLowerCase();
        const matches = (o.title && o.title.toLowerCase().includes(s)) ||
          (o.contentId && o.contentId.toLowerCase().includes(s)) ||
          (o.contentHash && o.contentHash.toLowerCase().includes(s)) ||
          (o.creator && o.creator.toLowerCase().includes(s));
        if (!matches) return false;
      }
      return true;
    });

    res.json({ success: true, offers: filtered });
  } catch (error) {
    console.error('Error fetching license offers:', error);
    res.status(500).json({ success: false, message: 'Server error fetching offers' });
  }
});

// POST /api/licensing/offer - record confirmed on-chain license offer
router.post('/offer', async (req, res) => {
  try {
    const {
      contentId,
      contentHash,
      title,
      description,
      creator,
      priceEth,
      permittedUse,
      restrictions,
      durationDays,
      category,
      offerTxHash
    } = req.body;

    if (!contentId || !contentHash || !title || !creator || !priceEth || !offerTxHash) {
      return res.status(400).json({ success: false, message: 'Missing required offer fields' });
    }

    if (isDbConnected()) {
      let existing = await License.findOne({ contentHash, status: 'Active' });
      if (existing) {
        existing.priceEth = priceEth;
        existing.title = title;
        existing.description = description || existing.description;
        existing.permittedUse = permittedUse;
        existing.restrictions = restrictions;
        existing.durationDays = Number(durationDays) || 0;
        existing.category = category || 'Commercial';
        existing.offerTxHash = offerTxHash;
        existing.updatedAt = new Date();
        await existing.save();
        return res.status(200).json({ success: true, offer: existing });
      }

      const newOffer = new License({
        contentId,
        contentHash,
        title,
        description: description || '',
        creator: creator.toLowerCase(),
        priceEth,
        permittedUse: permittedUse || 'Commercial use',
        restrictions: restrictions || 'No resale',
        durationDays: Number(durationDays) || 0,
        category: category || 'Commercial',
        status: 'Active',
        offerTxHash,
      });

      await newOffer.save();
      return res.status(201).json({ success: true, offer: newOffer });
    }

    // Memory fallback
    const idx = memoryOffers.findIndex(o => o.contentHash === contentHash && o.status === 'Active');
    const offerItem = {
      _id: 'mem_' + Date.now(),
      contentId,
      contentHash,
      title,
      description: description || '',
      creator: creator.toLowerCase(),
      priceEth,
      permittedUse: permittedUse || 'Commercial use',
      restrictions: restrictions || 'No resale',
      durationDays: Number(durationDays) || 0,
      category: category || 'Commercial',
      status: 'Active',
      offerTxHash,
      purchases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (idx >= 0) {
      memoryOffers[idx] = { ...memoryOffers[idx], ...offerItem };
      return res.status(200).json({ success: true, offer: memoryOffers[idx] });
    }

    memoryOffers.unshift(offerItem);
    res.status(201).json({ success: true, offer: offerItem });
  } catch (error) {
    console.error('Error creating license offer:', error);
    res.status(500).json({ success: false, message: 'Server error saving offer' });
  }
});

// POST /api/licensing/purchase - record confirmed on-chain purchase
router.post('/purchase', async (req, res) => {
  try {
    const { contentHash, buyer, purchaseTxHash, pricePaidEth } = req.body;

    if (!contentHash || !buyer || !purchaseTxHash) {
      return res.status(400).json({ success: false, message: 'Missing required purchase fields' });
    }

    if (isDbConnected()) {
      const offer = await License.findOne({ contentHash });
      if (!offer) {
        return res.status(404).json({ success: false, message: 'Offer not found for content' });
      }

      offer.purchases.push({
        buyer: buyer.toLowerCase(),
        purchaseTxHash,
        pricePaidEth: pricePaidEth || offer.priceEth,
        purchasedAt: new Date(),
      });
      offer.updatedAt = new Date();
      await offer.save();
      return res.json({ success: true, offer });
    }

    // Memory fallback
    const offer = memoryOffers.find(o => o.contentHash === contentHash);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    if (!offer.purchases) offer.purchases = [];
    offer.purchases.push({
      buyer: buyer.toLowerCase(),
      purchaseTxHash,
      pricePaidEth: pricePaidEth || offer.priceEth,
      purchasedAt: new Date(),
    });
    offer.updatedAt = new Date();

    res.json({ success: true, offer });
  } catch (error) {
    console.error('Error recording purchase:', error);
    res.status(500).json({ success: false, message: 'Server error recording purchase' });
  }
});

// POST /api/licensing/cancel - cancel an offer
router.post('/cancel', async (req, res) => {
  try {
    const { contentHash, creator } = req.body;

    if (isDbConnected()) {
      const offer = await License.findOne({ contentHash });
      if (!offer) {
        return res.status(404).json({ success: false, message: 'Offer not found' });
      }
      if (offer.creator.toLowerCase() !== creator.toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Unauthorized creator' });
      }
      offer.status = 'Cancelled';
      offer.updatedAt = new Date();
      await offer.save();
      return res.json({ success: true, offer });
    }

    // Memory fallback
    const offer = memoryOffers.find(o => o.contentHash === contentHash);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    if (offer.creator.toLowerCase() !== creator.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Unauthorized creator' });
    }
    offer.status = 'Cancelled';
    offer.updatedAt = new Date();
    res.json({ success: true, offer });
  } catch (error) {
    console.error('Error cancelling offer:', error);
    res.status(500).json({ success: false, message: 'Server error cancelling offer' });
  }
});

// GET /api/licensing/purchased/:wallet - list purchases for a specific wallet
router.get('/purchased/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();

    if (isDbConnected()) {
      const offers = await License.find({ 'purchases.buyer': wallet }).sort({ updatedAt: -1 });
      const formatted = [];
      offers.forEach(o => {
        const myPurchases = o.purchases.filter(p => p.buyer === wallet);
        myPurchases.forEach(p => {
          formatted.push({
            contentId: o.contentId,
            contentHash: o.contentHash,
            title: o.title,
            creator: o.creator,
            buyer: p.buyer,
            pricePaidEth: p.pricePaidEth,
            permittedUse: o.permittedUse,
            restrictions: o.restrictions,
            durationDays: o.durationDays,
            category: o.category,
            purchaseTxHash: p.purchaseTxHash,
            purchasedAt: p.purchasedAt,
            status: 'Purchased / Active',
          });
        });
      });
      return res.json({ success: true, licenses: formatted });
    }

    // Memory fallback
    const formatted = [];
    memoryOffers.forEach(o => {
      if (o.purchases) {
        o.purchases.filter(p => p.buyer === wallet).forEach(p => {
          formatted.push({
            contentId: o.contentId,
            contentHash: o.contentHash,
            title: o.title,
            creator: o.creator,
            buyer: p.buyer,
            pricePaidEth: p.pricePaidEth,
            permittedUse: o.permittedUse,
            restrictions: o.restrictions,
            durationDays: o.durationDays,
            category: o.category,
            purchaseTxHash: p.purchaseTxHash,
            purchasedAt: p.purchasedAt,
            status: 'Purchased / Active',
          });
        });
      }
    });

    res.json({ success: true, licenses: formatted });
  } catch (error) {
    console.error('Error fetching user purchases:', error);
    res.status(500).json({ success: false, message: 'Server error fetching purchases' });
  }
});

// GET /api/licensing/offered/:wallet - list offers created by a specific wallet
router.get('/offered/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();

    if (isDbConnected()) {
      const offers = await License.find({ creator: wallet }).sort({ createdAt: -1 });
      return res.json({ success: true, offers });
    }

    // Memory fallback
    const offers = memoryOffers.filter(o => o.creator === wallet);
    res.json({ success: true, offers });
  } catch (error) {
    console.error('Error fetching creator offers:', error);
    res.status(500).json({ success: false, message: 'Server error fetching creator offers' });
  }
});

// POST /api/licensing/faucet - fund any connected wallet with 50 test ETH on local Hardhat
router.post('/faucet', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ success: false, message: 'Address is required' });

    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    await provider.send('hardhat_setBalance', [
      address,
      '0x2B5E3AF16B1880000' // 50 ETH in hex
    ]);

    return res.json({ success: true, message: `Successfully funded ${address} with 50 test ETH!` });
  } catch (error) {
    console.error('Faucet error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
