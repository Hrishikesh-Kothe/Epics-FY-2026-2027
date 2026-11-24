const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { chatWithPatient } = require('../services/aiService');
const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');

// POST /api/ai/chat - AI chatbot endpoint
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, patientId } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    let patientContext = null;
    const contextPatientId = patientId || (req.user.role === 'patient' ? req.user.patientId : null);
    if (contextPatientId) {
      const patient = await User.findOne({ patientId: contextPatientId }).select('name age bloodGroup allergies');
      const latestRecord = await MedicalRecord.findOne({ patientId: contextPatientId }).sort({ createdAt: -1 });
      if (patient) {
        patientContext = {
          name: patient.name,
          diagnosis: latestRecord ? latestRecord.diagnosis : null,
          medicines: latestRecord ? latestRecord.medicines : []
        };
      }
    }
    const response = await chatWithPatient(message, patientContext);
    res.json({ success: true, response });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ success: false, message: 'AI service error.' });
  }
});

// GET /api/ai/status - Check if AI is configured
router.get('/status', async (req, res) => {
  const isConfigured = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';
  res.json({ success: true, aiEnabled: isConfigured });
});

module.exports = router;
