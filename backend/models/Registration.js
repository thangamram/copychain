import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  contentId: {
    type: String,
    required: true,
    unique: true,
  },
  contentHash: {
    type: String,
    required: true,
    unique: true,
  },
  creator: {
    type: String,
    required: true,
    lowercase: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  fileType: {
    type: String,
  },
  fileSize: {
    type: Number,
  },
  transactionHash: {
    type: String,
    required: true, // Will only save when transaction is confirmed
  },
  parentContentId: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

export default mongoose.model('Registration', registrationSchema);
