import mongoose from 'mongoose';

const licenseSchema = new mongoose.Schema({
  contentId: {
    type: String,
    required: true,
    index: true,
  },
  contentHash: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  creator: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  priceEth: {
    type: String,
    required: true,
  },
  permittedUse: {
    type: String,
    required: true,
  },
  restrictions: {
    type: String,
    required: true,
  },
  durationDays: {
    type: Number,
    default: 0, // 0 = Perpetual
  },
  category: {
    type: String,
    default: 'Commercial',
  },
  status: {
    type: String,
    enum: ['Active', 'Purchased', 'Cancelled', 'Expired'],
    default: 'Active',
    index: true,
  },
  offerTxHash: {
    type: String,
    required: true,
  },
  purchases: [
    {
      buyer: {
        type: String,
        lowercase: true,
      },
      purchaseTxHash: String,
      pricePaidEth: String,
      purchasedAt: {
        type: Date,
        default: Date.now,
      },
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

licenseSchema.index({ creator: 1, status: 1 });

export default mongoose.model('License', licenseSchema);
