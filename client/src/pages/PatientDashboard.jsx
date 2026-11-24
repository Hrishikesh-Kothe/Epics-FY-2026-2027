import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  Heart, Nfc, Pill, Calendar, Clock, AlertTriangle,
  CheckCircle2, Sparkles, Send, User, Phone, Shield,
  LogOut, ChevronRight, Activity, MessageSquare,
  FileText, Loader, Check, Info, AlertCircle
} from 'lucide-react';

const PatientDashboard = () => {
  const { user, logout, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [takenReminders, setTakenReminders] = useState({});

  // Chatbot state
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: `Hello ${user?.name || 'there'}! 👋 I am your MediLink AI Health Assistant. I can explain your prescriptions, remind you about dosage instructions, and answer questions about your health and medications. How can I help you today?`
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    age: '',
    bloodGroup: '',
    allergies: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: ''
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchPatientData();
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/patients/profile');
      if (data.success) {
        setProfile(data.patient);
        setRecords(data.records || []);
        setProfileForm({
          name: data.patient.name || '',
          age: data.patient.age || '',
          bloodGroup: data.patient.bloodGroup || '',
          allergies: data.patient.allergies?.join(', ') || '',
          emergencyName: data.patient.emergencyContact?.name || '',
          emergencyPhone: data.patient.emergencyContact?.phone || '',
          emergencyRelation: data.patient.emergencyContact?.relation || ''
        });
      }
    } catch (err) {
      console.error('Failed to load patient data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileMsg({ type: '', text: '' });
    try {
      const allergiesArray = profileForm.allergies
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      const updatePayload = {
        name: profileForm.name,
        age: profileForm.age ? Number(profileForm.age) : null,
        bloodGroup: profileForm.bloodGroup,
        allergies: allergiesArray,
        emergencyContact: {
          name: profileForm.emergencyName,
          phone: profileForm.emergencyPhone,
          relation: profileForm.emergencyRelation
        }
      };

      const { data } = await API.put('/patients/profile', updatePayload);
      if (data.success) {
        setProfile(data.patient);
        setUser(prev => ({ ...prev, ...data.patient }));
        setProfileMsg({ type: 'success', text: 'Profile & Emergency contacts saved successfully!' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleSendMessage = async (customMessage) => {
    const textToSend = customMessage || chatInput.trim();
    if (!textToSend || chatLoading) return;

    const userMsg = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!customMessage) setChatInput('');
    setChatLoading(true);

    try {
      const { data } = await API.post('/ai/chat', {
        message: textToSend,
        patientId: user?.patientId
      });
      if (data.success) {
        setMessages(prev => [...prev, { sender: 'ai', text: data.response }]);
      } else {
        setMessages(prev => [...prev, { sender: 'ai', text: 'I am temporarily unable to respond. Please consult your physician.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, I encountered an issue connecting to the AI service. Please try again later.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleReminder = (id) => {
    setTakenReminders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Extract all reminders from records
  const allReminders = records.flatMap((rec, rIdx) =>
    (rec.reminders || []).map((rem, remIdx) => ({
      ...rem,
      id: `${rec._id || rIdx}-${remIdx}`,
      diagnosis: rec.diagnosis,
      doctorName: rec.doctorName
    }))
  );

  const getPeriodBadge = (period) => {
    switch (period) {
      case 'Morning':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Afternoon':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Evening':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
      case 'Night':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-primary-500/20 text-primary-300 border-primary-500/30';
    }
  };

  return (
    <div className="min-h-screen page-bg">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-500 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-white font-display font-bold text-lg">MediLink AI</h1>
              <p className="text-primary-300 text-xs">Patient Health Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent-600/30 border border-accent-500/40 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-accent-300" />
              </div>
              <div className="hidden sm:block">
                <p className="text-white text-sm font-medium">{profile?.name || user?.name}</p>
                <p className="text-accent-400 text-xs font-mono">{profile?.patientId || user?.patientId}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-danger-500/20 text-white/80 hover:text-danger-300 border border-white/10 hover:border-danger-500/30 text-xs font-medium transition-all"
              title="Logout"
              id="patient-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* NFC Smart Card & Status Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Digital NFC Smart Card */}
          <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950 border border-primary-400/30 shadow-2xl shadow-primary-900/50">
            <div className="absolute top-0 right-0 w-48 h-48 bg-accent-400/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-400/15 rounded-full blur-xl" />

            <div className="relative z-10 flex flex-col justify-between h-52">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-primary-200/80 font-bold">MediLink Health Card</p>
                  <p className="text-xs text-white/50">NTAG213 Smart NFC</p>
                </div>
                <div className="nfc-pulse w-9 h-9 rounded-full bg-accent-400/20 border border-accent-400/50 flex items-center justify-center">
                  <Nfc className="w-5 h-5 text-accent-300" />
                </div>
              </div>

              <div>
                <p className="text-xs text-white/50 uppercase">Patient ID</p>
                <p className="text-2xl font-mono font-bold text-white tracking-wider">
                  {profile?.patientId || user?.patientId || 'MLP-26-XXXXXX'}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                <div>
                  <p className="text-white/40">Holder Name</p>
                  <p className="font-semibold text-white truncate max-w-[140px]">{profile?.name || user?.name}</p>
                </div>
                <div>
                  <p className="text-white/40">Blood Group</p>
                  <p className="font-semibold text-accent-300">{profile?.bloodGroup || 'O+'}</p>
                </div>
                <div>
                  <p className="text-white/40">Age</p>
                  <p className="font-semibold text-white">{profile?.age ? `${profile.age} yrs` : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 font-medium">Active Diagnoses</span>
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary-300" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-white">{records.length}</p>
                <p className="text-xs text-primary-300 mt-1">
                  {records[0]?.diagnosis ? `Latest: ${records[0].diagnosis}` : 'No active prescriptions'}
                </p>
              </div>
            </div>

            <div className="stat-card flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 font-medium">Daily Doses</span>
                <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center">
                  <Pill className="w-4 h-4 text-accent-300" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-white">{allReminders.length}</p>
                <p className="text-xs text-accent-400 mt-1">
                  {Object.values(takenReminders).filter(Boolean).length} of {allReminders.length} taken today
                </p>
              </div>
            </div>

            <div className="stat-card flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 font-medium">Emergency Contact</span>
                <div className="w-8 h-8 rounded-lg bg-danger-500/20 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-danger-300" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-lg font-bold text-white truncate">
                  {profile?.emergencyContact?.name || 'Not Configured'}
                </p>
                <p className="text-xs text-danger-300 mt-1">
                  {profile?.emergencyContact?.phone || 'Add in profile tab'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: "Today's Schedule", icon: Clock },
            { id: 'prescriptions', label: 'My Prescriptions & AI Explanations', icon: Pill },
            { id: 'chat', label: 'MediLink AI Assistant', icon: Sparkles },
            { id: 'profile', label: 'Profile & Emergency', icon: Shield }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`patient-tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                activeTab === id
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW & SCHEDULE */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary-300" /> Today's Smart Medicine Schedule
                  </h3>
                  <p className="text-white/50 text-xs mt-0.5">
                    AI-generated reminders based on your active prescription instructions
                  </p>
                </div>
                <span className="text-xs text-accent-400 bg-accent-500/10 px-3 py-1 rounded-full border border-accent-500/20">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader className="w-6 h-6 text-primary-400 animate-spin" />
                </div>
              ) : allReminders.length === 0 ? (
                <div className="py-12 text-center text-white/40 space-y-2">
                  <Pill className="w-10 h-10 mx-auto text-white/20 mb-2" />
                  <p className="text-sm font-medium">No medicine reminders scheduled</p>
                  <p className="text-xs">Once your doctor prescribes medicines, your smart schedule will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allReminders.map(rem => {
                    const isTaken = takenReminders[rem.id];
                    return (
                      <div
                        key={rem.id}
                        className={`p-4 rounded-xl border transition-all duration-300 ${
                          isTaken
                            ? 'bg-accent-500/10 border-accent-500/40 opacity-75'
                            : 'bg-white/5 border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getPeriodBadge(rem.period)}`}>
                            {rem.period || 'Scheduled'} • {rem.time || 'Daily'}
                          </span>
                          <button
                            onClick={() => toggleReminder(rem.id)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                              isTaken
                                ? 'bg-accent-500 text-white'
                                : 'bg-white/10 hover:bg-white/20 text-white/50'
                            }`}
                            title={isTaken ? 'Mark as not taken' : 'Mark as taken'}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="mt-3">
                          <h4 className={`text-base font-bold ${isTaken ? 'line-through text-white/60' : 'text-white'}`}>
                            {rem.medicineName}
                          </h4>
                          <p className="text-xs text-primary-300/80 mt-0.5">Dosage: {rem.dosage}</p>
                          <p className="text-xs text-white/40 mt-1">Prescribed for: {rem.diagnosis}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PRESCRIPTIONS & AI EXPLANATIONS */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-6 animate-fade-in">
            {loading ? (
              <div className="py-12 flex justify-center items-center">
                <Loader className="w-6 h-6 text-primary-400 animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <div className="glass-card p-12 text-center text-white/40">
                <FileText className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <p className="text-base font-medium">No medical records found</p>
                <p className="text-xs mt-1">Tap your NFC card during your clinic visit to record prescriptions.</p>
              </div>
            ) : (
              records.map(rec => (
                <div key={rec._id} className="glass-card p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-accent-400" />
                        <h3 className="text-lg font-bold text-white">{rec.diagnosis}</h3>
                      </div>
                      <p className="text-xs text-primary-300/70 mt-0.5">
                        Prescribed by Dr. {rec.doctorName} • {new Date(rec.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                      </p>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 self-start sm:self-auto">
                      {rec.medicines?.length || 0} Medicine(s)
                    </span>
                  </div>

                  {/* AI Explanation Box */}
                  {rec.aiExplanation && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-accent-500/10 via-primary-500/10 to-transparent border border-accent-400/30 space-y-2">
                      <div className="flex items-center gap-2 text-accent-300 text-xs font-semibold">
                        <Sparkles className="w-4 h-4 text-accent-400" />
                        <span>Gemini AI — Friendly Medicine Explanation</span>
                      </div>
                      <p className="text-white/80 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                        {rec.aiExplanation}
                      </p>
                    </div>
                  )}

                  {/* Interaction Alerts */}
                  {rec.interactionAlerts?.length > 0 && (
                    <div className="p-4 rounded-xl bg-warning-500/10 border border-warning-500/30 space-y-1">
                      <div className="flex items-center gap-2 text-warning-400 text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Potential Interactions Detected</span>
                      </div>
                      {rec.interactionAlerts.map((alt, i) => (
                        <p key={i} className="text-xs text-warning-300/80">• {alt}</p>
                      ))}
                    </div>
                  )}

                  {/* Medicines Table */}
                  <div>
                    <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Prescribed Medicines</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {rec.medicines?.map((m, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-white text-sm">{m.name}</span>
                            <span className="text-accent-400 font-mono">{m.dosage}</span>
                          </div>
                          <p className="text-primary-200/70">Frequency: <strong>{m.frequency}</strong> • Duration: <strong>{m.duration}</strong></p>
                          {m.instructions && (
                            <p className="text-white/50 italic">Note: {m.instructions}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {rec.notes && (
                    <div className="pt-2 text-xs text-white/50 border-t border-white/5">
                      <strong className="text-white/70">Doctor Notes:</strong> {rec.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: AI ASSISTANT CHAT */}
        {activeTab === 'chat' && (
          <div className="glass-card p-6 flex flex-col h-[600px] animate-fade-in">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-primary-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">MediLink AI Health Assistant</h3>
                <p className="text-white/40 text-xs">Powered by Google Gemini • Contextual medicine guidance</p>
              </div>
            </div>

            {/* Quick Prompts */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
              {[
                'How do I take my prescribed medicines?',
                'Are there any side effects I should watch for?',
                'Can I take my medicines with food or water?',
                'What should I do if I accidentally miss a dose?'
              ].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => handleSendMessage(prompt)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-primary-600 text-white rounded-br-none shadow-lg'
                        : 'bg-white/10 border border-white/10 text-white/90 rounded-bl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-none p-3 flex items-center gap-2 text-white/50 text-xs">
                    <Loader className="w-3.5 h-3.5 animate-spin" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="mt-4 flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about your medicines, dosage, or health advice..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className="input-field text-xs sm:text-sm py-2.5"
                id="chat-input"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="btn-primary py-2.5 px-4 flex items-center justify-center disabled:opacity-50"
                id="chat-send-btn"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: PROFILE & EMERGENCY */}
        {activeTab === 'profile' && (
          <div className="glass-card p-6 max-w-2xl mx-auto animate-fade-in">
            <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-300" /> Patient Profile & Emergency Contact
            </h3>
            <p className="text-white/50 text-xs mb-6">
              Keep your contact and emergency details updated for immediate clinical access.
            </p>

            {profileMsg.text && (
              <div className={`p-4 rounded-xl mb-4 flex items-center gap-2 text-xs ${
                profileMsg.type === 'success' ? 'alert-success' : 'alert-danger'
              }`}>
                {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-xs font-medium mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs font-medium mb-1 block">Age</label>
                  <input
                    type="number"
                    value={profileForm.age}
                    onChange={e => setProfileForm(prev => ({ ...prev, age: e.target.value }))}
                    className="input-field text-xs"
                    min="1"
                    max="120"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-xs font-medium mb-1 block">Blood Group</label>
                  <select
                    value={profileForm.bloodGroup}
                    onChange={e => setProfileForm(prev => ({ ...prev, bloodGroup: e.target.value }))}
                    className="input-field text-xs"
                  >
                    <option value="" className="bg-primary-900">Select Blood Group</option>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg} className="bg-primary-900">{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-xs font-medium mb-1 block">Allergies (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Peanuts"
                    value={profileForm.allergies}
                    onChange={e => setProfileForm(prev => ({ ...prev, allergies: e.target.value }))}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 mt-4">
                <h4 className="text-white font-semibold text-sm mb-3 text-danger-300 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-danger-400" /> Emergency Contact
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-white/60 text-xs font-medium mb-1 block">Contact Person Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sunita Kumar"
                      value={profileForm.emergencyName}
                      onChange={e => setProfileForm(prev => ({ ...prev, emergencyName: e.target.value }))}
                      className="input-field text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/60 text-xs font-medium mb-1 block">Emergency Phone</label>
                      <input
                        type="tel"
                        placeholder="+91-9876543210"
                        value={profileForm.emergencyPhone}
                        onChange={e => setProfileForm(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                        className="input-field text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-xs font-medium mb-1 block">Relationship</label>
                      <input
                        type="text"
                        placeholder="e.g. Spouse, Parent, Child"
                        value={profileForm.emergencyRelation}
                        onChange={e => setProfileForm(prev => ({ ...prev, emergencyRelation: e.target.value }))}
                        className="input-field text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={updatingProfile}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
                id="save-profile-btn"
              >
                {updatingProfile ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Saving Changes...</>
                ) : (
                  <><Check className="w-4 h-4" /> Save Profile Details</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
