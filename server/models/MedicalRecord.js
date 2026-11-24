const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  duration: { type: String, required: true },
  instructions: { type: String, default: '' }
});

const reminderSchema = new mongoose.Schema({
  medicineName: { type: String },
  time: { type: String },
  period: { type: String, enum: ['Morning', 'Afternoon', 'Evening', 'Night'] },
  dosage: { type: String }
});

const medicalRecordSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, default: '' },
  doctorName: { type: String, required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  diagnosis: { type: String, required: true },
  medicines: [medicineSchema],
  aiExplanation: { type: String, default: '' },
  interactionAlerts: [{ type: String }],
  reminders: [reminderSchema],
  ocrRawText: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

medicalRecordSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
