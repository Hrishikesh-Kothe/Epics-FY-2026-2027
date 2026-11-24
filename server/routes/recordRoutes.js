const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { generateMedicineExplanation, checkDrugInteractions, generateSmartReminders } = require('../services/aiService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `prescription_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/records - Doctor creates a new prescription/record
router.post('/', protect, requireRole('doctor'), async (req, res) => {
  try {
    const { patientId, diagnosis, medicines, notes, ocrRawText } = req.body;
    if (!patientId || !diagnosis || !medicines || medicines.length === 0) {
      return res.status(400).json({ success: false, message: 'patientId, diagnosis, and medicines are required.' });
    }
    const patient = await User.findOne({ patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    // Fetch existing medicines for drug interaction check
    const existingRecords = await MedicalRecord.find({ patientId }).sort({ createdAt: -1 }).limit(3);
    const existingMedicines = existingRecords.flatMap(r => r.medicines);
    // Run AI pipeline
    const [aiExplanation, interactionAlerts, reminders] = await Promise.all([
      generateMedicineExplanation(medicines, patient.name, diagnosis),
      checkDrugInteractions(medicines, existingMedicines),
      generateSmartReminders(medicines)
    ]);
    const record = await MedicalRecord.create({
      patientId,
      patientName: patient.name,
      doctorName: req.user.name,
      doctorId: req.user._id,
      diagnosis,
      medicines,
      aiExplanation,
      interactionAlerts,
      reminders,
      ocrRawText: ocrRawText || '',
      notes: notes || ''
    });
    res.status(201).json({ success: true, record, interactionAlerts });
  } catch (error) {
    console.error('Create record error:', error);
    res.status(500).json({ success: false, message: 'Server error creating record.' });
  }
});

// GET /api/records/patient/:patientId - Get all records for a patient
router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user.patientId !== req.params.patientId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const records = await MedicalRecord.find({ patientId: req.params.patientId }).sort({ createdAt: -1 });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/records/:id - Get single record
router.get('/:id', protect, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/records/upload-prescription - Upload prescription image (doctor only)
router.post('/upload-prescription', protect, requireRole('doctor'), upload.single('prescription'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    res.json({
      success: true,
      message: 'Prescription image uploaded. OCR will be performed client-side.',
      filePath: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Upload error.' });
  }
});

module.exports = router;
