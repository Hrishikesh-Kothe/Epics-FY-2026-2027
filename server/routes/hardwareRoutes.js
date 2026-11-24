const express = require('express');
const router = express.Router();
const User = require('../models/User');
const NfcScan = require('../models/NfcScan');

let ioInstance = null;

const setIo = (io) => {
  ioInstance = io;
};

// POST /api/hardware/scan - Called by ESP32 firmware when NFC card is scanned
router.post('/scan', async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId is required.' });
    }
    // Validate patientId format
    const idPattern = /^MLP-26-\d{6}$/;
    if (!idPattern.test(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId format. Expected: MLP-26-XXXXXX' });
    }
    // Find patient
    const patient = await User.findOne({ patientId, role: 'patient' }).select('-passwordHash');
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    // Log the scan
    await NfcScan.create({
      patientId,
      ipAddress: req.ip || req.connection.remoteAddress || ''
    });
    // Emit Socket.io event to all connected doctor dashboards
    if (ioInstance) {
      ioInstance.emit('nfc_scanned', {
        patientId,
        patientName: patient.name,
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      success: true,
      message: `NFC scan registered for patient ${patient.name}.`,
      patientId,
      patientName: patient.name
    });
  } catch (error) {
    console.error('Hardware scan error:', error);
    res.status(500).json({ success: false, message: 'Server error processing NFC scan.' });
  }
});

// GET /api/hardware/stats - NFC scan statistics
router.get('/stats', async (req, res) => {
  try {
    const totalScans = await NfcScan.countDocuments();
    const recentScans = await NfcScan.find().sort({ scannedAt: -1 }).limit(10);
    res.json({ success: true, totalScans, recentScans });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = { router, setIo };
