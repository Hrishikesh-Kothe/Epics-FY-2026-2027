const mongoose = require('mongoose');

const nfcScanSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  scannedAt: { type: Date, default: Date.now },
  deviceInfo: { type: String, default: 'ESP32-Hardware' },
  ipAddress: { type: String, default: '' }
});

module.exports = mongoose.model('NfcScan', nfcScanSchema);
