import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Define Report Schema
const reportSchema = new mongoose.Schema({
  contentHash: { type: String, required: true },
  referenceUrl: { type: String },
  description: { type: String, required: true },
  reporterAddress: { type: String },
  status: { type: String, default: 'Submitted' },
  createdAt: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', reportSchema);

const isDbConnected = () => mongoose.connection.readyState === 1;
const memoryReports = [];

// Create a new report
router.post('/', async (req, res) => {
  try {
    const { contentHash, referenceUrl, description, reporterAddress } = req.body;
    
    if (isDbConnected()) {
      const newReport = new Report({
        contentHash,
        referenceUrl,
        description,
        reporterAddress
      });
      await newReport.save();
      return res.status(201).json({ success: true, report: newReport });
    }

    // In-memory fallback if MongoDB is not connected
    const reportItem = {
      _id: 'rep_' + Date.now(),
      contentHash,
      referenceUrl,
      description,
      reporterAddress,
      status: 'Submitted',
      createdAt: new Date()
    };
    memoryReports.push(reportItem);
    return res.status(201).json({ success: true, report: reportItem, offlineMode: true });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ success: false, message: 'Server error saving report' });
  }
});

// Get reports (for dashboard)
router.get('/', async (req, res) => {
  try {
    if (isDbConnected()) {
      const reports = await Report.find().sort({ createdAt: -1 });
      return res.json({ success: true, reports });
    }
    res.json({ success: true, reports: memoryReports });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching reports' });
  }
});

export default router;
