import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import Tesseract from 'tesseract.js';
import {
  Heart, Nfc, Search, User, FileText, Plus, AlertTriangle,
  CheckCircle, Loader, LogOut, Wifi, WifiOff, Upload, X,
  Stethoscope, Pill, Clock, ChevronRight, Activity,
  Trash2, Eye, Brain
} from 'lucide-react';

const SOCKET_URL = window.location.origin;

const DoctorDashboard = () => {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [nfcAlert, setNfcAlert] = useState(null);
  const [simulatePatientId, setSimulatePatientId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [submittingRecord, setSubmittingRecord] = useState(false);
  const [drugAlerts, setDrugAlerts] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const fileInputRef = useRef(null);
  const nfcAlertTimer = useRef(null);
  const serialPortRef = useRef(null);

  const [prescription, setPrescription] = useState({
    patientId: '',
    diagnosis: '',
    notes: '',
    medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
  });

  // Socket.io connection
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    s.on('connect', () => {
      setSocketConnected(true);
      s.emit('join_doctor_room', user?.id || user?._id);
    });
    s.on('disconnect', () => setSocketConnected(false));
    s.on('nfc_scanned', (data) => {
      setNfcAlert(data);
      if (nfcAlertTimer.current) clearTimeout(nfcAlertTimer.current);
      nfcAlertTimer.current = setTimeout(() => setNfcAlert(null), 30000);
      loadPatientById(data.patientId);
    });
    setSocket(s);
    return () => {
      s.disconnect();
      if (nfcAlertTimer.current) clearTimeout(nfcAlertTimer.current);
    };
  }, [user]);

  // Load all patients on mount
  useEffect(() => {
    fetchAllPatients();
  }, []);

  const fetchAllPatients = async () => {
    setLoadingPatients(true);
    try {
      const { data } = await API.get('/patients');
      if (data.success) setAllPatients(data.patients);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadPatientById = async (patientId) => {
    if (!patientId) return;
    setLoadingPatient(true);
    setActiveTab('prescribe');
    setDrugAlerts([]);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const { data } = await API.get(`/patients/by-id/${patientId}`);
      if (data.success) {
        setSelectedPatient(data.patient);
        setPatientRecords(data.records);
        setPrescription(prev => ({ ...prev, patientId }));
      }
    } catch (err) {
      setErrorMsg(`Patient not found: ${patientId}`);
    } finally {
      setLoadingPatient(false);
    }
  };

  const handleSimulateNfc = async () => {
    const pid = simulatePatientId.trim();
    if (!pid) return;
    try {
      await API.post('/hardware/scan', { patientId: pid });
      setSimulatePatientId('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'NFC simulation failed.');
    }
  };

  const handleConnectSerial = async () => {
    if (!('serial' in navigator)) {
      setErrorMsg('Web Serial is not supported in this browser. Please use Chrome, Edge, or Opera GX.');
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;
      setSerialConnected(true);
      setSuccessMsg('🔌 Connected to ESP32 via USB! Tapping NFC card will auto-load patient.');

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      let buffer = '';
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
              const match = line.match(/MLP-26-\d{6}/);
              if (match) {
                const detectedId = match[0];
                await API.post('/hardware/scan', { patientId: detectedId });
              }
            }
          }
        } catch (readErr) {
          console.error('Serial read error:', readErr);
        } finally {
          setSerialConnected(false);
        }
      })();
    } catch (err) {
      console.error('Serial connection error:', err);
      setErrorMsg('Failed to open USB Serial port. Ensure Arduino Serial Monitor is closed first!');
      setSerialConnected(false);
    }
  };

  const handleMedicineChange = (index, field, value) => {
    setPrescription(prev => {
      const meds = [...prev.medicines];
      meds[index] = { ...meds[index], [field]: value };
      return { ...prev, medicines: meds };
    });
  };

  const addMedicine = () => {
    setPrescription(prev => ({
      ...prev,
      medicines: [...prev.medicines, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
    }));
  };

  const removeMedicine = (index) => {
    if (prescription.medicines.length === 1) {
      setPrescription(prev => ({
        ...prev,
        medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
      }));
      return;
    }
    setPrescription(prev => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index)
    }));
  };

  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrRunning(true);
    setOcrProgress(0);
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });
      const text = result.data.text;
      setPrescription(prev => ({
        ...prev,
        notes: prev.notes ? `[OCR Extracted Text]:\n${text}\n\n${prev.notes}` : `[OCR Extracted Text]:\n${text}`
      }));
      setSuccessMsg('OCR text extracted into notes! Review and enter structured medicines.');
    } catch (err) {
      setErrorMsg('OCR failed. Please enter medicines manually.');
    } finally {
      setOcrRunning(false);
      setOcrProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitPrescription = async (e) => {
    e.preventDefault();
    if (!prescription.patientId || !prescription.diagnosis) {
      setErrorMsg('Patient ID and diagnosis are required.');
      return;
    }
    const validMeds = prescription.medicines.filter(m => m.name && m.dosage && m.frequency && m.duration);
    if (validMeds.length === 0) {
      setErrorMsg('Add at least one complete medicine entry (Name, Dosage, Frequency, Duration).');
      return;
    }
    setSubmittingRecord(true);
    setDrugAlerts([]);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const { data } = await API.post('/records', {
        ...prescription,
        medicines: validMeds,
        ocrRawText: prescription.notes.includes('[OCR Extracted Text]:') ? prescription.notes : ''
      });
      if (data.success) {
        setSuccessMsg('✅ Prescription saved! AI explanation and smart reminders generated.');
        setDrugAlerts(data.interactionAlerts || []);
        // Refresh patient records
        const refreshed = await API.get(`/patients/by-id/${prescription.patientId}`);
        if (refreshed.data.success) {
          setPatientRecords(refreshed.data.records);
        }
        // Reset form inputs except patientId
        setPrescription(prev => ({
          ...prev,
          diagnosis: '',
          notes: '',
          medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
        }));
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save prescription.');
    } finally {
      setSubmittingRecord(false);
    }
  };

  const filteredPatients = allPatients.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.patientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <p className="text-primary-300 text-xs">Doctor Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Socket status */}
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
              socketConnected
                ? 'text-accent-400 border-accent-500/30 bg-accent-500/10'
                : 'text-danger-400 border-danger-500/30 bg-danger-500/10'
            }`}>
              {socketConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {socketConnected ? 'Live' : 'Offline'}
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-primary-300" />
              </div>
              <div className="hidden sm:block">
                <p className="text-white text-sm font-medium">{user?.name}</p>
                <p className="text-primary-300/60 text-xs">Physician</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-danger-500/20 text-white/80 hover:text-danger-300 border border-white/10 hover:border-danger-500/30 text-xs font-medium transition-all"
              title="Logout"
              id="logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* NFC Alert Banner */}
      {nfcAlert && (
        <div className="bg-gradient-to-r from-accent-500/20 to-primary-600/20 border-b border-accent-500/30 animate-fade-in">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="nfc-pulse w-10 h-10 bg-accent-500 rounded-full flex items-center justify-center">
                <Nfc className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-accent-300 font-semibold text-sm">🎯 NFC Card Scanned!</p>
                <p className="text-white/80 text-xs">
                  Patient: <strong>{nfcAlert.patientName}</strong> • ID: <strong>{nfcAlert.patientId}</strong> • {new Date(nfcAlert.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <button onClick={() => setNfcAlert(null)} className="text-white/50 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* NFC Waiting Banner (when no alert) */}
      {!nfcAlert && (
        <div className="border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-2 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-primary-300/60">
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
              Waiting for NFC Card Tap...
            </div>
            {/* Simulate NFC Bar */}
            <div className="flex items-center gap-2 flex-1 justify-center sm:justify-end">
              <label className="text-xs text-white/40 whitespace-nowrap">Simulate NFC:</label>
              <input
                id="simulate-nfc-input"
                type="text"
                value={simulatePatientId}
                onChange={e => setSimulatePatientId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSimulateNfc()}
                placeholder="MLP-26-000001"
                className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none focus:border-primary-400 w-36"
              />
              <button
                id="simulate-nfc-btn"
                onClick={handleSimulateNfc}
                className="bg-primary-700 hover:bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
              >
                <Nfc className="w-3 h-3" /> Tap
              </button>

              <button
                id="usb-serial-btn"
                type="button"
                onClick={handleConnectSerial}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 border ${
                  serialConnected
                    ? 'bg-accent-500/20 text-accent-300 border-accent-500/40 hover:bg-accent-500/30'
                    : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/20 hover:text-white'
                }`}
                title="Connect physical ESP32 via USB (No Wi-Fi required)"
              >
                🔌 {serialConnected ? 'USB Reader Active' : 'Connect USB Reader'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Nav tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'prescribe', label: 'Prescribe', icon: FileText },
            { id: 'patients', label: 'Patients', icon: User }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === id
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Patients', value: allPatients.length, icon: User, color: 'text-primary-300', bg: 'from-primary-600/20 to-primary-800/20' },
                { label: 'NFC Ready', value: allPatients.filter(p => p.patientId).length, icon: Nfc, color: 'text-accent-400', bg: 'from-accent-500/20 to-primary-800/20' },
                { label: 'Socket', value: socketConnected ? 'Live' : 'Off', icon: Wifi, color: socketConnected ? 'text-green-400' : 'text-red-400', bg: 'from-green-600/10 to-primary-800/20' },
                { label: 'AI Status', value: 'Active', icon: Brain, color: 'text-purple-400', bg: 'from-purple-600/20 to-primary-800/20' }
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={`glass-card bg-gradient-to-br ${bg} p-5 hover:scale-[1.02] transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${color} mb-3`} />
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-white/50 text-xs mt-1">{label}</p>
                </div>
              ))}
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <User className="w-5 h-5 text-primary-300" /> Recent Patients
                </h3>
                <button onClick={fetchAllPatients} className="text-xs text-primary-300 hover:text-white transition-colors">
                  Refresh List
                </button>
              </div>
              {loadingPatients ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 text-primary-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {allPatients.slice(0, 6).map(p => (
                    <button
                      key={p._id}
                      onClick={() => loadPatientById(p.patientId)}
                      className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-all text-left group"
                      id={`patient-row-${p.patientId}`}
                    >
                      <div className="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{p.name}</p>
                        <p className="text-primary-300/60 text-xs">{p.patientId} • Blood: {p.bloodGroup || 'N/A'} • Age: {p.age || 'N/A'}</p>
                      </div>
                      <span className="text-xs text-accent-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Open <ChevronRight className="w-4 h-4" />
                      </span>
                    </button>
                  ))}
                  {allPatients.length === 0 && <p className="text-white/40 text-sm text-center py-4">No patients registered yet.</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRESCRIBE TAB */}
        {activeTab === 'prescribe' && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column: Patient Info + History */}
            <div className="lg:col-span-2 space-y-4">
              {loadingPatient ? (
                <div className="glass-card p-8 flex items-center justify-center">
                  <Loader className="w-6 h-6 text-primary-400 animate-spin mr-3" />
                  <span className="text-white/60">Loading patient...</span>
                </div>
              ) : selectedPatient ? (
                <>
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg">{selectedPatient.name}</h3>
                        <span className="badge-nfc text-xs">
                          <Nfc className="w-3 h-3" /> {selectedPatient.patientId}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: 'Age', value: selectedPatient.age || 'N/A' },
                        { label: 'Blood Group', value: selectedPatient.bloodGroup || 'N/A' },
                        { label: 'Allergies', value: selectedPatient.allergies?.length ? selectedPatient.allergies.join(', ') : 'None reported' },
                        { label: 'Email', value: selectedPatient.email }
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white/5 rounded-lg p-2">
                          <p className="text-white/40">{label}</p>
                          <p className="text-white font-medium mt-0.5 truncate">{value}</p>
                        </div>
                      ))}
                    </div>
                    {selectedPatient.emergencyContact?.name && (
                      <div className="mt-3 bg-danger-500/10 border border-danger-500/20 rounded-lg p-2 text-xs">
                        <p className="text-danger-400 font-medium">🚨 Emergency Contact: {selectedPatient.emergencyContact.name}</p>
                        <p className="text-white/60">{selectedPatient.emergencyContact.phone} ({selectedPatient.emergencyContact.relation || 'Contact'})</p>
                      </div>
                    )}
                  </div>

                  {/* Medical History */}
                  <div className="glass-card p-5">
                    <h4 className="text-white/70 font-semibold text-sm mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Medical History ({patientRecords.length})
                    </h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {patientRecords.map(rec => (
                        <div key={rec._id} className="bg-white/5 rounded-lg p-3 text-xs">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-primary-300 font-medium">{rec.diagnosis}</span>
                            <span className="text-white/30">{new Date(rec.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-white/60">{rec.medicines?.length} medicine(s) • Dr. {rec.doctorName}</p>
                          {rec.interactionAlerts?.length > 0 && (
                            <p className="text-warning-400 mt-1">⚠️ {rec.interactionAlerts.length} interaction alert(s)</p>
                          )}
                          {rec.aiExplanation && (
                            <p className="text-accent-400/80 mt-1 line-clamp-2">💡 {rec.aiExplanation}</p>
                          )}
                        </div>
                      ))}
                      {patientRecords.length === 0 && <p className="text-white/30 text-center py-2">No previous records.</p>}
                    </div>
                  </div>
                </>
              ) : (
                <div className="glass-card p-8 text-center">
                  <div className="w-16 h-16 bg-primary-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Nfc className="w-8 h-8 text-primary-300 animate-pulse" />
                  </div>
                  <p className="text-white/60 font-medium">Waiting for NFC scan</p>
                  <p className="text-white/30 text-xs mt-2">Use the simulate bar above or scan a physical NFC card</p>
                </div>
              )}
            </div>

            {/* Right Column: Prescription Form */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSubmitPrescription} className="glass-card p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary-300" /> New Prescription
                  </h3>

                  {/* OCR Upload button */}
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleOcrUpload}
                      accept="image/*"
                      className="hidden"
                      id="ocr-upload-input"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={ocrRunning}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-xs text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                      id="ocr-upload-btn"
                    >
                      {ocrRunning ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {ocrRunning ? `OCR ${ocrProgress}%` : 'OCR Scan Image'}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="alert-danger flex items-center gap-2 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="alert-success flex items-center gap-2 animate-fade-in">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{successMsg}</span>
                  </div>
                )}

                {/* Drug Interaction Alerts */}
                {drugAlerts.length > 0 && (
                  <div className="alert-warning space-y-1 animate-fade-in">
                    <p className="font-semibold flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4" /> ⚠️ Drug Interaction Alerts
                    </p>
                    {drugAlerts.map((alert, i) => (
                      <p key={i} className="text-xs text-warning-300">• {alert}</p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/60 text-xs font-medium mb-1 block">Patient ID</label>
                    <input
                      id="rx-patientid"
                      type="text"
                      value={prescription.patientId}
                      onChange={e => setPrescription(prev => ({ ...prev, patientId: e.target.value }))}
                      placeholder="MLP-26-000001"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs font-medium mb-1 block">Diagnosis</label>
                    <input
                      id="rx-diagnosis"
                      type="text"
                      value={prescription.diagnosis}
                      onChange={e => setPrescription(prev => ({ ...prev, diagnosis: e.target.value }))}
                      placeholder="e.g., Type 2 Diabetes Mellitus"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                {/* Medicines List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-white/60 text-xs font-medium">Prescribed Medicines</label>
                    <button
                      type="button"
                      onClick={addMedicine}
                      className="text-xs text-primary-300 hover:text-white flex items-center gap-1 transition-colors"
                      id="add-medicine-btn"
                    >
                      <Plus className="w-3 h-3" /> Add Medicine
                    </button>
                  </div>

                  <div className="space-y-3">
                    {prescription.medicines.map((med, index) => (
                      <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-3 relative space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-primary-300 flex items-center gap-1">
                            <Pill className="w-3.5 h-3.5" /> Medicine #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMedicine(index)}
                            className="text-white/40 hover:text-danger-400 transition-colors p-1"
                            title="Remove Medicine"
                            id={`delete-med-btn-${index}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Medicine Name (e.g. Metformin)"
                            value={med.name}
                            onChange={e => handleMedicineChange(index, 'name', e.target.value)}
                            className="input-field text-xs py-2"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Dosage (e.g. 500mg)"
                            value={med.dosage}
                            onChange={e => handleMedicineChange(index, 'dosage', e.target.value)}
                            className="input-field text-xs py-2"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Frequency (e.g. Twice daily, 1-0-1)"
                            value={med.frequency}
                            onChange={e => handleMedicineChange(index, 'frequency', e.target.value)}
                            className="input-field text-xs py-2"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Duration (e.g. 30 days)"
                            value={med.duration}
                            onChange={e => handleMedicineChange(index, 'duration', e.target.value)}
                            className="input-field text-xs py-2"
                            required
                          />
                        </div>

                        <input
                          type="text"
                          placeholder="Special Instructions (e.g. After food with water)"
                          value={med.instructions}
                          onChange={e => handleMedicineChange(index, 'instructions', e.target.value)}
                          className="input-field text-xs py-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes & OCR Text */}
                <div>
                  <label className="text-white/60 text-xs font-medium mb-1 block">Clinical Notes / OCR Raw Text</label>
                  <textarea
                    id="rx-notes"
                    value={prescription.notes}
                    onChange={e => setPrescription(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Doctor notes, dietary advice, lifestyle recommendations, or extracted OCR text..."
                    rows={4}
                    className="input-field resize-none text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingRecord}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                  id="submit-prescription-btn"
                >
                  {submittingRecord ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Saving & Analyzing via Gemini AI...</>
                  ) : (
                    <><FileText className="w-4 h-4" /> Save Prescription & AI Analysis</>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PATIENTS TAB */}
        {activeTab === 'patients' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search patients by name, ID, or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field pl-10 text-xs"
                  id="patient-search-input"
                />
              </div>
              <button
                onClick={fetchAllPatients}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-xs text-white px-4 py-2.5 rounded-xl transition-all"
              >
                Refresh List
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatients.map(p => (
                <div key={p._id} className="glass-card p-5 space-y-3 hover:scale-[1.01] transition-transform">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-300" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-sm">{p.name}</h4>
                        <p className="text-white/40 text-xs">{p.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-2.5 space-y-1 text-xs">
                    <div className="flex justify-between text-white/60">
                      <span>NFC ID:</span>
                      <span className="font-mono text-accent-400 font-semibold">{p.patientId || 'Not assigned'}</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Blood Group / Age:</span>
                      <span className="text-white">{p.bloodGroup || 'N/A'} • {p.age ? `${p.age} yrs` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Allergies:</span>
                      <span className="text-warning-300 truncate max-w-[150px]">{p.allergies?.length ? p.allergies.join(', ') : 'None'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => loadPatientById(p.patientId)}
                    className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                    id={`prescribe-patient-${p.patientId}`}
                  >
                    <FileText className="w-3.5 h-3.5" /> Prescribe & View Records
                  </button>
                </div>
              ))}
              {filteredPatients.length === 0 && (
                <div className="col-span-full glass-card p-12 text-center text-white/40">
                  No patients match your search criteria.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard;
