const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
  patientId: { type: String, unique: true, sparse: true },
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    relation: { type: String, default: '' }
  },
  age: { type: Number, default: null },
  bloodGroup: { type: String, default: '' },
  allergies: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = async function(password) {
  return bcrypt.hash(password, 12);
};

module.exports = mongoose.model('User', userSchema);
