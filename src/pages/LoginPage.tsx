import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  addDoc,
  collection,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_REG_NOS } from '../constants';
import { 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  ShieldCheck, 
  Loader2,
  Calculator,
  ChevronRight,
  IdCard,
  Building2,
  CalendarDays,
  KeyRound,
  Fingerprint,
  UserCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function LoginPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [authLoading, setAuthLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'student' | 'admin'>('student');
  const [studentMode, setStudentMode] = useState<'login' | 'signup'>('signup');
  
  const [formData, setFormData] = useState({
    name: '',
    registerNo: '',
    department: '',
    year: 'I',
    semester: '1',
    password: ''
  });

  const recordLoginEvent = async (uid: string, name: string, regNo: string) => {
    try {
      await addDoc(collection(db, 'login_logs'), {
        userId: uid,
        displayName: name,
        registerNo: regNo,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Failed to log session entry:', error);
    }
  };

  const handleStudentAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const regNo = formData.registerNo.trim().toUpperCase();
    
    // Validation Pattern: First 6 numeric, next 3 alpha, then 3 digits
    const regNoRegex = /^\d{6}[A-Z]{3}\d{3}$/;
    
    if (!regNoRegex.test(regNo)) {
      alert("Invalid Register Number Format.\nExpected: 6 Digits + 3 Letters + 3 Digits (Total 12 chars).\nExample: 927625BSC001");
      setAuthLoading(false);
      return;
    }

    const yearSem = `${formData.year} / ${formData.semester.padStart(2, '0')}`;

    if (studentMode === 'signup') {
      if (!formData.name.trim() || !formData.department || !formData.password) {
        alert("Verification failed: All fields including password are mandatory for first-time synchronization.");
        setAuthLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        alert("Password must be at least 6 characters for sequence security.");
        setAuthLoading(false);
        return;
      }
    } else {
      if (!formData.password) {
        alert("Secret Access Key required for workspace entry.");
        setAuthLoading(false);
        return;
      }
    }

    const email = `${regNo.toLowerCase()}@internal.app`;

    try {
      let userCredential;
      if (studentMode === 'signup') {
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
          await updateProfile(userCredential.user, { displayName: formData.name });
          
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            email: email,
            displayName: formData.name.toUpperCase(),
            registerNo: regNo,
            department: formData.department.toUpperCase(),
            yearSem: yearSem,
            role: 'user',
            createdAt: serverTimestamp()
          });
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use') {
            alert("This identity is already synchronized. Please use the LOG IN mode.");
          } else {
            throw err;
          }
          setAuthLoading(false);
          return;
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, formData.password);
      }

      const displayName = formData.name || userCredential.user.displayName || 'Student';
      await recordLoginEvent(userCredential.user.uid, displayName, regNo);
      await refreshProfile(userCredential.user.uid);
    } catch (error: any) {
      console.error("Student access error:", error);
      
      // auth/invalid-credential is the modern Firebase catch-all for:
      // 1. Incorrect password
      // 2. User not found (enumeration protection)
      // 3. Invalid email format
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        alert("Identity verification failed.\n\nPossible reasons:\n• You may have entered an incorrect password.\n• This identity may not be synchronized yet. If this is your first session, please use the 'NEW STUDENT SYNC' mode.\n• Ensure your Register Number format is correct.");
      } else if (error.code === 'auth/user-not-found') {
        alert("Identity synchronization not found. Please use the 'NEW STUDENT SYNC' mode to initialize your workspace.");
      } else if (error.code === 'auth/network-request-failed') {
        alert("Network synchronization failed. Please check your connection to the campus infrastructure.");
      } else {
        alert(`Access Error: ${error.message}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const regNo = formData.registerNo.trim();
    const email = `${regNo.toLowerCase()}@admin.app`;
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, formData.password);
      
      // Auto-re-verify admin status for whitelisted IDs to fix potential sync issues
      if (ADMIN_REG_NOS.includes(regNo)) {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          role: 'admin'
        }, { merge: true });
        
        // Also ensure specific admin record exists
        await setDoc(doc(db, 'admins', userCredential.user.uid), { exists: true });
      }
      
      await recordLoginEvent(userCredential.user.uid, 'Admin User', regNo);
      await refreshProfile(userCredential.user.uid);
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        alert("Email/Password login is not enabled in Firebase. Please enable it in Firebase Console.");
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        alert("Administrative Authorization Failed.\n\nVerify your ID and Secret Access Key. Ensure your account has been initialized.");
      } else {
        alert(`Admin Access Error: ${error.message}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminSignup = async () => {
    const regNo = formData.registerNo.trim();
    if (!ADMIN_REG_NOS.includes(regNo)) {
      alert("This Register Number is not whitelisted for Administrative clearance.");
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    setAuthLoading(true);
    const email = `${regNo.toLowerCase()}@admin.app`;
    try {
      const result = await createUserWithEmailAndPassword(auth, email, formData.password);
      await updateProfile(result.user, { displayName: formData.name || 'Admin User' });
      
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: email,
        displayName: formData.name || 'Admin User',
        registerNo: regNo,
        department: formData.department || 'Administration',
        yearSem: `${formData.year} / ${formData.semester.padStart(2, '0')}`,
        role: 'admin',
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'admins', result.user.uid), { exists: true });
      await refreshProfile(result.user.uid);
      alert("Administrative Account Successfully Initialized.");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verifying Security Protocols</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 select-none font-sans">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Left Side - Infrastructure Info */}
        <div className="hidden lg:flex flex-col p-12 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg text-slate-900">
                <Calculator size={24} />
              </div>
              <h1 className="text-xl font-black tracking-tighter uppercase">Internal System</h1>
            </div>

            <div className="space-y-8 mt-12">
              <h2 className="text-4xl font-black leading-tight tracking-tight uppercase">
                {loginMode === 'student' ? 'Student Workspace' : 'Administrator Hub'}
              </h2>
              <p className="text-slate-400 leading-relaxed text-sm max-w-sm font-medium">
                Authorized computation gateway for the 2026-27 academic session. All data interactions are logged for integrity.
              </p>
            </div>

            <div className="mt-24 space-y-6">
               <div className="flex items-center gap-4 group">
                <div className={cn(
                  "w-8 h-8 rounded flex items-center justify-center transition-colors",
                  loginMode === 'student' ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                )}>
                  <ShieldCheck size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-white transition-colors">
                  {loginMode === 'student' ? 'Verified Student Access' : 'Encrypted Admin Token Active'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-auto relative z-10 flex items-center gap-8 opacity-20 group">
             <Calculator size={80} className="text-white" />
          </div>
        </div>

        {/* Right Side - Forms */}
        <div className="p-8 lg:p-16 flex flex-col justify-center bg-white min-h-[600px]">
          <AnimatePresence mode="wait">
            {!user ? (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8"
              >
                <div className="text-center lg:text-left">
                  <h3 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">System Login</h3>
                  <p className="text-slate-500 text-sm font-medium">Please enter your credentials to initiate calculation.</p>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
                  <button 
                    onClick={() => setLoginMode('student')}
                    className={cn(
                      "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                      loginMode === 'student' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Student
                  </button>
                  <button 
                    onClick={() => setLoginMode('admin')}
                    className={cn(
                      "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                      loginMode === 'admin' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Administrator
                  </button>
                </div>

                <form onSubmit={loginMode === 'student' ? handleStudentAccess : handleAdminLogin} className="space-y-4">
                  {loginMode === 'student' ? (
                    <>
                      {/* Student Sub-toggle */}
                      <div className="flex bg-slate-50 border border-slate-200 p-0.5 rounded-lg mb-4">
                        <button 
                          type="button"
                          onClick={() => setStudentMode('signup')}
                          className={cn(
                            "flex-1 py-1.5 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all",
                            studentMode === 'signup' ? "bg-slate-900 text-white shadow-md" : "text-slate-400"
                          )}
                        >
                          New Student Sync
                        </button>
                        <button 
                          type="button"
                          onClick={() => setStudentMode('login')}
                          className={cn(
                            "flex-1 py-1.5 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all",
                            studentMode === 'login' ? "bg-slate-900 text-white shadow-md" : "text-slate-400"
                          )}
                        >
                          Returning Student Log In
                        </button>
                      </div>

                      {studentMode === 'signup' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            <UserCircle2 size={12} /> Full Name
                          </label>
                          <input
                            required
                            placeholder="ENTER FULL NAME"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all uppercase"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                          <IdCard size={12} /> Register Number
                        </label>
                        <input
                          required
                          maxLength={12}
                          placeholder="e.g. 927625BSC001"
                          value={formData.registerNo}
                          onChange={e => setFormData({ ...formData, registerNo: e.target.value.toUpperCase() })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                        />
                      </div>

                      {studentMode === 'signup' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                Dept
                            </label>
                            <select
                              required
                              value={formData.department}
                              onChange={e => setFormData({ ...formData, department: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all uppercase appearance-none cursor-pointer"
                            >
                              <option value="" disabled>Select Dept</option>
                              <option value="CSE">CSE</option>
                              <option value="IT">IT</option>
                              <option value="ECE">ECE</option>
                              <option value="EEE">EEE</option>
                              <option value="MECH">MECH</option>
                              <option value="CSBS">CSBS</option>
                              <option value="CIVIL">CIVIL</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                 Year
                              </label>
                              <select
                                required
                                value={formData.year}
                                onChange={e => setFormData({ ...formData, year: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all uppercase appearance-none cursor-pointer"
                              >
                                <option value="I">I</option>
                                <option value="II">II</option>
                                <option value="III">III</option>
                                <option value="IV">IV</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                 Sem
                              </label>
                              <select
                                required
                                value={formData.semester}
                                onChange={e => setFormData({ ...formData, semester: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all uppercase appearance-none cursor-pointer"
                              >
                                {[1,2,3,4,5,6,7,8].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                          <KeyRound size={12} /> {studentMode === 'signup' ? 'Create Password' : 'Secret Access Key'}
                        </label>
                        <input
                          required
                          type="password"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                          <IdCard size={12} /> Admin ID (Reg No)
                        </label>
                        <input
                          required
                          placeholder="Whitelisted Register No"
                          value={formData.registerNo}
                          onChange={e => setFormData({ ...formData, registerNo: e.target.value.toUpperCase() })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                          <KeyRound size={12} /> Secret Access Key
                        </label>
                        <input
                          required
                          type="password"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                        />
                      </div>
                      {/* One-time Admin Initializer */}
                      <p className="text-[9px] text-slate-400 text-center uppercase tracking-tighter cursor-pointer hover:text-blue-500 transition-colors pt-2" onClick={handleAdminSignup}>
                        Whitelisted Admin? Initialize account here
                      </p>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className={cn(
                      "w-full h-14 rounded-xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 mt-4",
                      loginMode === 'student' ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                    )}
                  >
                    {authLoading ? <Loader2 className="animate-spin" size={18} /> : (
                      <>
                        {loginMode === 'student' ? 'Access Workspace' : 'Authorize Entry'}
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : !profile ? (
              <motion.div
                key="syncizing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center gap-4 py-20"
              >
                <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
                <div className="text-center">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Synchronizing Profile</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Directing to workspace...</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="auth-complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
              >
                <div className={cn(
                  "w-20 h-20 rounded-full mx-auto flex items-center justify-center shadow-inner",
                  profile?.role === 'admin' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-500"
                )}>
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Identity Loaded</h3>
                  <p className="text-slate-500 text-sm mt-2 font-medium">Session initialized for {profile?.role || 'user'} clearance.</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-left">
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{profile?.displayName}</p>
                    <p className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{profile?.registerNo} • {profile?.department}</p>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter shadow-sm",
                    profile?.role === 'admin' ? "bg-blue-600 text-white" : "bg-slate-900 text-white"
                  )}>
                    {profile?.role}
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                   <button 
                    disabled={true}
                    className="h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200"
                  >
                    WORKSPACE ACTIVE
                  </button>
                  <button 
                    onClick={() => signOut(auth)}
                    className="h-10 text-slate-400 hover:text-red-500 font-black uppercase text-[9px] tracking-[0.2em] transition-all"
                  >
                    Logout and Switch Profile
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
