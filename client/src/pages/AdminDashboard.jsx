import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  Heart, Nfc, Shield, Users, Activity, Server,
  Wifi, WifiOff, LogOut, Search, UserPlus, RefreshCw,
  Clock, CheckCircle, AlertTriangle, ChevronRight, X, Loader
} from 'lucide-react';

const SOCKET_URL = window.location.origin;

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [socketConnected, setSocketConnected] = useState(false);
  const [patients, setPatients] = useState([]);
  const [hardwareStats, setHardwareStats] = useState({ totalScans: 0, recentScans: [] });
  const [liveScanLogs, setLiveScanLogs] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulate NFC
  const [simulateId, setSimulateId] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // New Patient Modal / Form
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    email: '',
    password: 'password123',
    age: '',
    bloodGroup: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: ''
  });
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  useEffect(() => {
    // Socket.io connection for real-time NFC events
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    s.on('connect', () => setSocketConnected(true));
    s.on('disconnect', () => setSocketConnected(false));
    s.on('nfc_scanned', (data) => {
      setLiveScanLogs(prev => [
        {
          patientId: data.patientId,
          patientName: data.patientName,
          scannedAt: data.timestamp || new Date().toISOString(),
          deviceInfo: 'ESP32 / Simulated'
        },
        ...prev.slice(0, 19)
      ]);
    });

    fetchAllData();

    return () => s.disconnect();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [patientsRes, statsRes, healthRes, aiRes] = await Promise.allSettled([
        API.get('/patients'),
        API.get('/hardware/stats'),
        API.get('/health'),
        API.get('/ai/status')
      ]);

      if (patientsRes.status === 'fulfilled' && patientsRes.value.data.success) {
        setPatients(patientsRes.value.data.patients || []);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.data.success) {
        setHardwareStats(statsRes.value.data);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value.data.success) {
        setSystemHealth(healthRes.value.data);
      }
      if (aiRes.status === 'fulfilled' && aiRes.value.data.success) {
        setAiStatus(aiRes.value.data);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = async () => {
    const pid = simulateId.trim();
    if (!pid) return;
    setSimulating(true);
    setSimResult(null);
    try {
      const { data } = await API.post('/hardware/scan', { patientId: pid });
      setSimResult({ success: true, text: `Scanned: ${data.patientName} (${data.patientId})` });
      setSimulateId('');
      // Refresh hardware stats
      const s = await API.get('/hardware/stats');
      if (s.data.success) setHardwareStats(s.data);
    } catch (err) {
      setSimResult({
        success: false,
        text: err.response?.data?.message || 'Simulation failed'
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    setCreatingPatient(true);
    setCreateMsg('');
    try {
      const payload = {
        name: newPatient.name,
        email: newPatient.email,
        password: newPatient.password,
        role: 'patient',
        age: newPatient.age ? Number(newPatient.age) : undefined,
        bloodGroup: newPatient.bloodGroup,
        emergencyContact: {
          name: newPatient.emergencyName,
          phone: newPatient.emergencyPhone,
          relation: newPatient.emergencyRelation
        }
      };
      const { data } = await API.post('/auth/register', payload);
      if (data.success) {
        setCreateMsg(`✅ Registered! Assigned NFC ID: ${data.user.patientId}`);
        setNewPatient({
          name: '',
          email: '',
          password: 'password123',
          age: '',
          bloodGroup: '',
          emergencyName: '',
          emergencyPhone: '',
          emergencyRelation: ''
        });
        fetchAllData();
        setTimeout(() => {
          setShowAddPatient(false);
          setCreateMsg('');
        }, 1500);
      }
    } catch (err) {
      setCreateMsg(err.response?.data?.message || 'Registration failed');
    } finally {
      setCreatingPatient(false);
    }
  };

  const filteredPatients = patients.filter(p =>
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
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-primary-500 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-display font-bold text-lg">MediLink AI</h1>
              <p className="text-primary-300 text-xs">System Administration & Hardware Ops</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
              socketConnected
                ? 'text-accent-400 border-accent-500/30 bg-accent-500/10'
                : 'text-danger-400 border-danger-500/30 bg-danger-500/10'
            }`}>
              {socketConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {socketConnected ? 'Live Gateway' : 'Gateway Offline'}
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-purple-200" />
              </div>
              <div className="hidden sm:block">
                <p className="text-white text-sm font-medium">{user?.name || 'Administrator'}</p>
                <p className="text-purple-300/60 text-xs">Superuser</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-danger-500/20 text-white/80 hover:text-danger-300 border border-white/10 hover:border-danger-500/30 text-xs font-medium transition-all"
              title="Logout"
              id="admin-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Top Hardware Quick Simulator Bar */}
        <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="nfc-pulse w-9 h-9 rounded-full bg-accent-500/20 border border-accent-400/40 flex items-center justify-center">
              <Nfc className="w-5 h-5 text-accent-300" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">ESP32 Hardware NFC Simulator</p>
              <p className="text-white/40 text-xs">Simulate card tap event received via ESP32 reader</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="e.g. MLP-26-000001"
              value={simulateId}
              onChange={e => setSimulateId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSimulateScan()}
              className="bg-white/10 border border-white/20 text-white text-xs rounded-xl px-4 py-2 outline-none focus:border-primary-400 w-full md:w-48"
              id="admin-simulate-input"
            />
            <button
              onClick={handleSimulateScan}
              disabled={simulating}
              className="btn-primary py-2 px-4 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5"
              id="admin-simulate-btn"
            >
              {simulating ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Nfc className="w-3.5 h-3.5" />}
              Tap Card
            </button>
          </div>
        </div>

        {simResult && (
          <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
            simResult.success ? 'alert-success' : 'alert-danger'
          } animate-fade-in`}>
            <span>{simResult.text}</span>
            <button onClick={() => setSimResult(null)} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* System Overview Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Registered Patients',
              value: patients.length,
              icon: Users,
              desc: 'Total active patient cards',
              color: 'text-primary-300',
              bg: 'from-primary-600/20 to-primary-800/20'
            },
            {
              label: 'NFC Scan Events',
              value: hardwareStats.totalScans || 0,
              icon: Nfc,
              desc: 'All-time card reads',
              color: 'text-accent-400',
              bg: 'from-accent-500/20 to-primary-800/20'
            },
            {
              label: 'Server Status',
              value: systemHealth?.success ? 'Healthy' : 'Connecting',
              icon: Server,
              desc: 'Node.js Express + Mongoose',
              color: 'text-green-400',
              bg: 'from-green-600/10 to-primary-800/20'
            },
            {
              label: 'Gemini AI Engine',
              value: aiStatus?.aiEnabled ? 'Configured' : 'Offline Key',
              icon: Activity,
              desc: 'gemini-2.5-flash clinical model',
              color: 'text-purple-400',
              bg: 'from-purple-600/20 to-primary-800/20'
            }
          ].map(({ label, value, icon: Icon, desc, color, bg }) => (
            <div key={label} className={`glass-card bg-gradient-to-br ${bg} p-5 hover:scale-[1.01] transition-transform`}>
              <Icon className={`w-6 h-6 ${color} mb-3`} />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-white font-medium text-xs mt-0.5">{label}</p>
              <p className="text-white/40 text-[10px] mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2">
          {[
            { id: 'overview', label: 'Live Gateway & Audit Logs', icon: Activity },
            { id: 'patients', label: 'Patient Directory', icon: Users }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* TAB 1: LIVE GATEWAY & AUDIT LOGS */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            {/* Live Real-time Scan Feed */}
            <div className="glass-card p-6 flex flex-col h-[500px]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-400 animate-pulse" />
                  <h3 className="text-white font-bold text-base">Live Socket.io Scan Feed</h3>
                </div>
                <span className="text-xs text-white/40">Real-time broadcast</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {liveScanLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 text-xs space-y-2">
                    <Nfc className="w-8 h-8 text-white/20 animate-pulse" />
                    <p>No card scans detected in this session yet.</p>
                    <p className="text-white/20">Use the simulator above or tap an NFC card.</p>
                  </div>
                ) : (
                  liveScanLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between text-xs animate-slide-in"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent-500/20 text-accent-300 flex items-center justify-center font-bold">
                          <Nfc className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{log.patientName || 'Unknown Patient'}</p>
                          <p className="text-accent-400 font-mono text-[11px]">{log.patientId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60">{new Date(log.scannedAt).toLocaleTimeString()}</p>
                        <p className="text-white/30 text-[10px]">{log.deviceInfo}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Persistent Database Scan Audit */}
            <div className="glass-card p-6 flex flex-col h-[500px]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary-300" /> Database Scan Audit
                </h3>
                <button
                  onClick={fetchAllData}
                  className="text-primary-300 hover:text-white transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(hardwareStats.recentScans || []).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs">
                    No persistent scans recorded in database.
                  </div>
                ) : (
                  hardwareStats.recentScans.map((scan) => (
                    <div
                      key={scan._id}
                      className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-mono text-white font-semibold">{scan.patientId}</p>
                        <p className="text-white/40 text-[10px]">
                          Device: {scan.deviceInfo} {scan.ipAddress ? `• IP: ${scan.ipAddress}` : ''}
                        </p>
                      </div>
                      <span className="text-white/50 text-[11px]">
                        {new Date(scan.scannedAt).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PATIENT DIRECTORY */}
        {activeTab === 'patients' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Filter by name, NFC ID, or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field pl-10 text-xs"
                  id="admin-search-patients"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddPatient(true)}
                  className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
                  id="admin-add-patient-btn"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Register New Patient
                </button>
                <button
                  onClick={fetchAllData}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs px-3 py-2 rounded-xl transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-white/60 uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="px-6 py-3">Patient Name</th>
                      <th className="px-6 py-3">NFC Patient ID</th>
                      <th className="px-6 py-3">Blood Group</th>
                      <th className="px-6 py-3">Age</th>
                      <th className="px-6 py-3">Emergency Contact</th>
                      <th className="px-6 py-3">Registered On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPatients.map((p) => (
                      <tr key={p._id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">
                          <div>{p.name}</div>
                          <div className="text-[10px] text-white/40 font-normal">{p.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-accent-400 font-bold bg-accent-500/10 px-2 py-0.5 rounded border border-accent-500/20">
                            {p.patientId || 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-primary-300 font-medium">{p.bloodGroup || 'N/A'}</td>
                        <td className="px-6 py-4 text-white/70">{p.age ? `${p.age} yrs` : 'N/A'}</td>
                        <td className="px-6 py-4 text-white/70">
                          {p.emergencyContact?.name ? (
                            <div>
                              <span>{p.emergencyContact.name}</span>
                              <div className="text-[10px] text-white/40">{p.emergencyContact.phone}</div>
                            </div>
                          ) : (
                            <span className="text-white/30">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-white/50">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {filteredPatients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-white/40">
                          No patients found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Register New Patient */}
        {showAddPatient && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-lg w-full p-6 animate-fade-in relative max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-accent-400" /> Register New Patient Card
                </h3>
                <button
                  onClick={() => setShowAddPatient(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createMsg && (
                <div className="alert-success text-xs mb-4">
                  {createMsg}
                </div>
              )}

              <form onSubmit={handleCreatePatient} className="space-y-4 text-xs">
                <div>
                  <label className="text-white/60 mb-1 block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newPatient.name}
                    onChange={e => setNewPatient(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field text-xs py-2"
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 mb-1 block">Email Address</label>
                    <input
                      type="email"
                      required
                      value={newPatient.email}
                      onChange={e => setNewPatient(prev => ({ ...prev, email: e.target.value }))}
                      className="input-field text-xs py-2"
                      placeholder="patient@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 mb-1 block">Initial Password</label>
                    <input
                      type="password"
                      required
                      value={newPatient.password}
                      onChange={e => setNewPatient(prev => ({ ...prev, password: e.target.value }))}
                      className="input-field text-xs py-2"
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 mb-1 block">Age</label>
                    <input
                      type="number"
                      value={newPatient.age}
                      onChange={e => setNewPatient(prev => ({ ...prev, age: e.target.value }))}
                      className="input-field text-xs py-2"
                      placeholder="e.g. 45"
                      min="1"
                      max="120"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 mb-1 block">Blood Group</label>
                    <select
                      value={newPatient.bloodGroup}
                      onChange={e => setNewPatient(prev => ({ ...prev, bloodGroup: e.target.value }))}
                      className="input-field text-xs py-2"
                    >
                      <option value="" className="bg-primary-900">Select Blood Group</option>
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                        <option key={bg} value={bg} className="bg-primary-900">{bg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="text-white/70 font-semibold mb-2">Emergency Contact</p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Contact Person Name"
                      value={newPatient.emergencyName}
                      onChange={e => setNewPatient(prev => ({ ...prev, emergencyName: e.target.value }))}
                      className="input-field text-xs py-2"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={newPatient.emergencyPhone}
                        onChange={e => setNewPatient(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                        className="input-field text-xs py-2"
                      />
                      <input
                        type="text"
                        placeholder="Relationship"
                        value={newPatient.emergencyRelation}
                        onChange={e => setNewPatient(prev => ({ ...prev, emergencyRelation: e.target.value }))}
                        className="input-field text-xs py-2"
                      />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-accent-300/80">
                  ℹ️ NFC Patient ID will be automatically generated upon creation (format: MLP-26-XXXXXX).
                </p>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPatient(false)}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingPatient}
                    className="btn-primary py-2 px-5 flex items-center gap-1.5"
                  >
                    {creatingPatient ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
