import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, Nfc, Shield, Brain, Stethoscope, User, Lock, Mail, ChevronRight, Loader, AlertCircle, CheckCircle } from 'lucide-react';

const LandingLogin = () => {
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('patient');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', age: '', bloodGroup: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    let result;
    if (mode === 'login') {
      result = await login(formData.email, formData.password);
    } else {
      result = await register({ ...formData, role });
    }
    if (result.success) {
      setSuccess(mode === 'login' ? 'Login successful! Redirecting...' : 'Account created! Redirecting...');
      setTimeout(() => {
        const r = result.user.role;
        if (r === 'doctor') navigate('/doctor');
        else if (r === 'admin') navigate('/admin');
        else navigate('/patient');
      }, 800);
    } else {
      setError(result.message);
    }
  };

  const demoLogin = async (email, password) => {
    setError('');
    const result = await login(email, password);
    if (result.success) {
      const r = result.user.role;
      if (r === 'doctor') navigate('/doctor');
      else if (r === 'admin') navigate('/admin');
      else navigate('/patient');
    } else {
      setError(result.message);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  return (
    <div className="min-h-screen page-bg flex relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse-slow" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 animate-pulse-slow" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary-800/30 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

      {/* Left Hero Panel */}
      <div className="hidden lg:flex flex-col justify-center w-1/2 px-16 relative z-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-accent-500 rounded-2xl flex items-center justify-center shadow-xl shadow-primary-500/40">
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-white">MediLink AI</h1>
              <p className="text-primary-300 text-sm font-medium">Smart Patient Management System</p>
            </div>
          </div>
          <h2 className="text-5xl font-display font-bold text-white leading-tight mb-4">
            Healthcare,
            <br />
            <span className="gradient-text">Reimagined</span>
            <br />
            with AI + NFC
          </h2>
          <p className="text-primary-200/70 text-lg leading-relaxed max-w-md">
            Seamlessly connect patients, doctors, and AI assistance. Tap an NFC card to instantly load medical profiles.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Nfc, title: 'NFC Smart Cards', desc: 'Instant patient ID via NTAG213' },
            { icon: Brain, title: 'Gemini AI', desc: 'Drug interactions & explanations' },
            { icon: Shield, title: 'Secure & Private', desc: 'JWT auth + role-based access' },
            { icon: Stethoscope, title: 'Live Dashboard', desc: 'Real-time Socket.io updates' }
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card p-4 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02]">
              <Icon className="w-6 h-6 text-primary-300 mb-2" />
              <h3 className="text-white font-semibold text-sm">{title}</h3>
              <p className="text-primary-300/60 text-xs mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {/* Demo credentials */}
        <div className="mt-8 glass-card p-4">
          <p className="text-primary-300 text-xs font-semibold uppercase tracking-wider mb-3">🎯 Quick Demo Access</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '👨‍⚕️ Doctor', email: 'doctor@medilink.com', pass: '123456', color: 'from-blue-500 to-primary-600' },
              { label: '🧑‍🦳 Patient', email: 'patient@medilink.com', pass: '123456', color: 'from-accent-500 to-primary-500' },
              { label: '🔧 Admin', email: 'admin@medilink.com', pass: '123456', color: 'from-purple-500 to-primary-600' }
            ].map(({ label, email, pass, color }) => (
              <button
                key={label}
                onClick={() => demoLogin(email, pass)}
                disabled={loading}
                className={`bg-gradient-to-r ${color} text-white text-xs font-semibold py-2 px-3 rounded-lg hover:opacity-90 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50`}
                id={`demo-btn-${label.split(' ')[1].toLowerCase()}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Auth Panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-accent-500 rounded-xl flex items-center justify-center">
              <Heart className="w-7 h-7 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">MediLink AI</h1>
            </div>
          </div>

          <div className="glass-card p-8 animate-fade-in">
            {/* Tab switcher */}
            <div className="flex bg-white/5 rounded-xl p-1 mb-6">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  mode === 'login' ? 'bg-primary-600 text-white shadow-lg' : 'text-white/50 hover:text-white'
                }`}
                id="tab-login"
              >
                Sign In
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  mode === 'signup' ? 'bg-primary-600 text-white shadow-lg' : 'text-white/50 hover:text-white'
                }`}
                id="tab-signup"
              >
                Register
              </button>
            </div>

            <h2 className="text-2xl font-display font-bold text-white mb-1">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-white/50 text-sm mb-6">
              {mode === 'login' ? 'Sign in to your MediLink account' : 'Join the MediLink AI platform'}
            </p>

            {/* Error / Success alerts */}
            {error && (
              <div className="alert-danger flex items-center gap-2 mb-4 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            {success && (
              <div className="alert-success flex items-center gap-2 mb-4 animate-fade-in">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 w-4 h-4 text-white/40" />
                    <input id="input-name" name="name" type="text" placeholder="Full Name" value={formData.name} onChange={handleChange} required className="input-field pl-10" />
                  </div>

                  {/* Role selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {['patient', 'doctor', 'admin'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize transition-all duration-300 border ${
                          role === r
                            ? 'bg-primary-600 border-primary-400 text-white shadow-lg'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                        id={`role-btn-${r}`}
                      >
                        {r === 'patient' ? '🧑‍🦳' : r === 'doctor' ? '👨‍⚕️' : '🔧'} {r}
                      </button>
                    ))}
                  </div>

                  {role === 'patient' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input id="input-age" name="age" type="number" placeholder="Age" value={formData.age} onChange={handleChange} className="input-field" min="1" max="120" />
                      <select id="input-bloodgroup" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="input-field">
                        <option value="" className="bg-primary-900">Blood Group</option>
                        {bloodGroups.map(bg => <option key={bg} value={bg} className="bg-primary-900">{bg}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-white/40" />
                <input id="input-email" name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required className="input-field pl-10" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-white/40" />
                <input id="input-password" name="password" type="password" placeholder="Password (min 6 chars)" value={formData.password} onChange={handleChange} required className="input-field pl-10" minLength={6} />
              </div>

              <button id="submit-auth" type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            {/* Mobile demo buttons */}
            <div className="mt-6 lg:hidden">
              <p className="text-white/40 text-xs text-center mb-3">Quick Demo Access</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Doctor', email: 'doctor@medilink.com', color: 'bg-blue-600' },
                  { label: 'Patient', email: 'patient@medilink.com', color: 'bg-accent-600' },
                  { label: 'Admin', email: 'admin@medilink.com', color: 'bg-purple-600' }
                ].map(({ label, email, color }) => (
                  <button key={label} onClick={() => demoLogin(email, '123456')} disabled={loading}
                    className={`${color} text-white text-xs font-semibold py-2 rounded-lg hover:opacity-90 transition-all`}
                    id={`mobile-demo-${label.toLowerCase()}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-white/30 text-xs text-center mt-6">
            MediLink AI v1.0 — EPICS Project 2026 | Powered by Google Gemini + Socket.io
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingLogin;
