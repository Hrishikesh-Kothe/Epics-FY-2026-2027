const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const generatePatientId = async () => {
  const lastPatient = await User.findOne({ role: 'patient', patientId: { $exists: true, $ne: null } })
    .sort({ createdAt: -1 })
    .select('patientId');
  if (!lastPatient || !lastPatient.patientId) {
    return 'MLP-26-000001';
  }
  const lastNum = parseInt(lastPatient.patientId.split('-')[2], 10);
  const nextNum = lastNum + 1;
  return `MLP-26-${String(nextNum).padStart(6, '0')}`;
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, age, bloodGroup, emergencyContact } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    const passwordHash = await User.hashPassword(password);
    const userRole = role || 'patient';
    const userData = { name, email, passwordHash, role: userRole, age, bloodGroup };
    if (emergencyContact) {
      userData.emergencyContact = emergencyContact;
    }
    if (userRole === 'patient') {
      userData.patientId = await generatePatientId();
    }
    const user = await User.create(userData);
    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        patientId: user.patientId || null
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const token = generateToken(user._id);
    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        patientId: user.patientId || null,
        emergencyContact: user.emergencyContact,
        age: user.age,
        bloodGroup: user.bloodGroup,
        allergies: user.allergies
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
