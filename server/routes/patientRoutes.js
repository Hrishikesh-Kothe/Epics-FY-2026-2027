const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MedicalRecord = require('../models/MedicalRecord');
const { protect, requireRole } = require('../middleware/authMiddleware');

// GET /api/patients - Get all patients (doctor/admin only)
router.get('/', protect, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const patients = await User.find({ role: 'patient' }).select('-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, patients });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/patients/by-id/:patientId - Get patient by NFC patientId string
router.get('/by-id/:patientId', protect, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const patient = await User.findOne({ patientId: req.params.patientId, role: 'patient' }).select('-passwordHash');
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found with this ID.' });
    }
    const records = await MedicalRecord.find({ patientId: req.params.patientId }).sort({ createdAt: -1 });
    res.json({ success: true, patient, records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/patients/profile - Patient views own profile
router.get('/profile', protect, requireRole('patient'), async (req, res) => {
  try {
    const patient = await User.findById(req.user._id).select('-passwordHash');
    const records = await MedicalRecord.find({ patientId: patient.patientId }).sort({ createdAt: -1 });
    res.json({ success: true, patient, records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/patients/profile - Patient updates own profile
router.put('/profile', protect, requireRole('patient'), async (req, res) => {
  try {
    const { name, age, bloodGroup, allergies, emergencyContact } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (age) updateData.age = age;
    if (bloodGroup) updateData.bloodGroup = bloodGroup;
    if (allergies) updateData.allergies = allergies;
    if (emergencyContact) updateData.emergencyContact = emergencyContact;
    const updated = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-passwordHash');
    res.json({ success: true, patient: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
