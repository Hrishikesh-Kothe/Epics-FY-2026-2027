const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const getGenAI = () => {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return null;
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

const generateMedicineExplanation = async (medicines, patientName, diagnosis) => {
  const client = getGenAI();
  if (!client) {
    return generateFallbackExplanation(medicines, diagnosis);
  }
  try {
    const model = client.getGenerativeModel({ model: MODEL_NAME });
    const medicineList = medicines.map(m => `${m.name} (${m.dosage}, ${m.frequency}, for ${m.duration})`).join('\n- ');
    const prompt = `You are a friendly healthcare assistant. Explain the following prescribed medicines in very simple, easy-to-understand language for a patient named ${patientName} who has been diagnosed with ${diagnosis}. Use simple words suitable for elderly patients. Include what each medicine does, how to take it, and any important tips. Format your response in a clear, friendly way with emoji.

Medicines prescribed:
- ${medicineList}

Provide a warm, encouraging explanation in 200-300 words.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini explanation error:', error.message);
    return generateFallbackExplanation(medicines, diagnosis);
  }
};

const checkDrugInteractions = async (newMedicines, existingMedicines) => {
  const client = getGenAI();
  if (!client) {
    return [];
  }
  if (!existingMedicines || existingMedicines.length === 0) {
    return [];
  }
  try {
    const model = client.getGenerativeModel({ model: MODEL_NAME });
    const newMedList = newMedicines.map(m => m.name).join(', ');
    const existingMedList = existingMedicines.map(m => m.name).join(', ');
    const prompt = `You are a clinical pharmacist AI. Check for potential drug interactions between:

NEWLY PRESCRIBED: ${newMedList}
EXISTING MEDICATIONS: ${existingMedList}

Respond ONLY with a JSON array of interaction alert strings. Each string should be a concise, clear warning. If no significant interactions, return an empty array [].

Example format: ["Aspirin + Warfarin: Increased bleeding risk - monitor closely", "Metformin + Alcohol: Avoid alcohol consumption"]

Return only the JSON array, no other text.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('Gemini drug interaction error:', error.message);
    return [];
  }
};

const generateSmartReminders = async (medicines) => {
  const client = getGenAI();
  if (!client) {
    return generateFallbackReminders(medicines);
  }
  try {
    const model = client.getGenerativeModel({ model: MODEL_NAME });
    const medicineList = medicines.map(m => `${m.name}: ${m.dosage}, ${m.frequency}`).join('\n');
    const prompt = `You are a healthcare scheduling assistant. Create a smart daily reminder schedule for the following medicines:

${medicineList}

Respond ONLY with a JSON array of reminder objects. Each object must have: medicineName, time (HH:MM format), period (Morning/Afternoon/Evening/Night), dosage.

Example: [{"medicineName": "Metformin", "time": "08:00", "period": "Morning", "dosage": "500mg"}, {"medicineName": "Metformin", "time": "20:00", "period": "Night", "dosage": "500mg"}]

Return only the JSON array, no other text.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return generateFallbackReminders(medicines);
  } catch (error) {
    console.error('Gemini reminders error:', error.message);
    return generateFallbackReminders(medicines);
  }
};

const chatWithPatient = async (message, patientContext) => {
  const client = getGenAI();
  if (!client) {
    return 'I am MediLink AI Assistant. Currently the AI service is not configured. Please add your Gemini API key to the .env file. For now, please consult your doctor for any medical questions.';
  }
  try {
    const model = client.getGenerativeModel({ model: MODEL_NAME });
    const context = patientContext
      ? `Patient: ${patientContext.name}, Diagnosis: ${patientContext.diagnosis || 'N/A'}, Medicines: ${patientContext.medicines ? patientContext.medicines.map(m => m.name).join(', ') : 'N/A'}`
      : 'General patient';
    const prompt = `You are MediLink AI, a friendly and empathetic healthcare assistant chatbot. You help patients understand their medications, health conditions, and lifestyle tips. You NEVER replace a doctor but provide supportive guidance.

Patient Context: ${context}

Patient Message: ${message}

Respond in a warm, helpful, and simple language. Keep response concise (under 150 words). Always encourage consulting the doctor for serious concerns.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini chat error:', error.message);
    return 'I am having trouble processing your request right now. Please try again or consult your doctor directly.';
  }
};

const generateFallbackExplanation = (medicines, diagnosis) => {
  const medNames = medicines.map(m => `${m.name} (${m.dosage})`).join(', ');
  return `💊 Your Prescription Summary\n\nYou have been prescribed the following medicines for ${diagnosis}:\n${medNames}\n\nPlease follow your doctor's instructions carefully. Take medicines at the same time each day for best results. Do not skip doses. Contact your doctor if you experience any unusual symptoms.\n\n⚠️ Note: AI explanation service is not configured. Please add your Gemini API key for detailed, personalized explanations.`;
};

const generateFallbackReminders = (medicines) => {
  const reminders = [];
  medicines.forEach(medicine => {
    const freq = medicine.frequency.toLowerCase();
    if (freq.includes('twice') || freq.includes('2') || freq.includes('bd') || freq.includes('bid')) {
      reminders.push({ medicineName: medicine.name, time: '08:00', period: 'Morning', dosage: medicine.dosage });
      reminders.push({ medicineName: medicine.name, time: '20:00', period: 'Night', dosage: medicine.dosage });
    } else if (freq.includes('three') || freq.includes('3') || freq.includes('tds') || freq.includes('tid')) {
      reminders.push({ medicineName: medicine.name, time: '08:00', period: 'Morning', dosage: medicine.dosage });
      reminders.push({ medicineName: medicine.name, time: '14:00', period: 'Afternoon', dosage: medicine.dosage });
      reminders.push({ medicineName: medicine.name, time: '20:00', period: 'Night', dosage: medicine.dosage });
    } else {
      reminders.push({ medicineName: medicine.name, time: '08:00', period: 'Morning', dosage: medicine.dosage });
    }
  });
  return reminders;
};

module.exports = { generateMedicineExplanation, checkDrugInteractions, generateSmartReminders, chatWithPatient };
