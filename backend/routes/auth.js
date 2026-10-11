import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Generate a nonce (challenge) for wallet signature - mock for now, 
// in a real app, this is used for EIP-4361 Sign In With Ethereum
router.get('/nonce', (req, res) => {
  const nonce = Math.floor(Math.random() * 1000000).toString();
  res.json({ nonce });
});

// Verify signature and login (mocked verification for prototype simplicity)
router.post('/login', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    // Normally we would verify the signature here using ethers.verifyMessage
    // For this prototype, we'll trust the walletAddress if provided.

    const address = walletAddress.toLowerCase();
    let user = await User.findOne({ walletAddress: address });

    if (!user) {
      user = new User({ walletAddress: address });
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
router.get('/profile/:walletAddress', async (req, res) => {
  try {
    const user = await User.findOne({ walletAddress: req.params.walletAddress.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
