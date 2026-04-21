/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  ChevronRight, 
  GraduationCap, 
  Save, 
  RefreshCcw, 
  FileText,
  AlertCircle,
  Info,
  ArrowRight,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  User as UserIcon,
  Loader2
} from 'lucide-react';
import { COURSE_DATA, CourseType } from './constants';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

export default function App() {
  const { user, profile, loading, isAdmin } = useAuth();
  const [view, setView] = useState<'generator' | 'admin'>('generator');
  const [courseType, setCourseType] = useState<CourseType>('THEORY');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [eseScore, setEseScore] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const config = COURSE_DATA[courseType];

  const handleScoreChange = (id: string, value: string) => {
    const numValue = parseFloat(value);
    if (value === '' || (!isNaN(numValue) && numValue >= 0)) {
      setScores(prev => ({ ...prev, [id]: value }));
    }
  };

  const internalMarks = useMemo(() => {
    let total = 0;
    const breakdown = config.items.map(item => {
      const score = parseFloat(scores[item.id] || '0');
      const weightObtained = (score / item.max) * item.weight;
      total += weightObtained;
      return {
        ...item,
        score,
        weightObtained: parseFloat(weightObtained.toFixed(2))
      };
    });
    return {
      total: parseFloat(total.toFixed(2)),
      breakdown
    };
  }, [scores, config]);

  const finalCalculation = useMemo(() => {
    const ese = parseFloat(eseScore || '0');
    const eseWeightObtained = (ese / config.ese.max) * config.ese.weight;
    const total = internalMarks.total + eseWeightObtained;
    return {
      eseWeightObtained: parseFloat(eseWeightObtained.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }, [internalMarks.total, eseScore, config]);

  const reset = () => {
    setScores({});
    setEseScore('');
  };

  const handleSaveToFirebase = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'marks'), {
        userId: profile.uid,
        userName: profile.displayName,
        registerNo: profile.registerNo,
        department: profile.department,
        yearSem: profile.yearSem,
        courseType,
        internalMarks: internalMarks.total,
        eseMarks: finalCalculation.eseWeightObtained,
        totalMarks: finalCalculation.total,
        scores,
        eseScore,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert('Record saved successfully to Master Repository');
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving record. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verifying Identity</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  if (view === 'admin' && isAdmin) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 shadow-sm z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-sm flex items-center justify-center">
              <Calculator size={18} className="text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800 uppercase">Admin Hub</h1>
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setView('generator')}
              className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <LayoutDashboard size={18} />
            </button>
             <div className="h-4 w-px bg-slate-200" />
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{profile.displayName}</span>
                <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500">
                  <LogOut size={16} />
                </button>
             </div>
          </div>
        </header>
        <AdminPage />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden select-none">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-sm flex items-center justify-center">
            <Calculator size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 uppercase">Internal Mark Generator</h1>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
          <div className="flex items-center gap-4 mr-4">
             {isAdmin && (
                <button 
                  onClick={() => setView('admin')}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                >
                  <ShieldCheck size={12} />
                  <span className="text-[10px] font-black uppercase tracking-tight">Admin Console</span>
                </button>
             )}
             <div className="flex items-center gap-2 group cursor-pointer" onClick={() => signOut(auth)}>
                <UserIcon size={14} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-tight text-slate-400 group-hover:text-red-500 transition-colors">Sign Out</span>
             </div>
          </div>
          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
            <span className="text-[10px] font-black uppercase tracking-widest">2026-27 Active</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-72 border-r border-slate-200 bg-white p-6 flex flex-col gap-8 shrink-0 overflow-y-auto">
          <section className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
             <div className="flex items-center gap-2 mb-3">
                <UserIcon size={14} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Profile</span>
             </div>
             <p className="font-black text-slate-800 uppercase text-xs truncate">{profile.displayName}</p>
             <p className="font-mono text-[9px] text-slate-400 mt-1 uppercase truncate font-bold">{profile.registerNo} • {profile.department}</p>
          </section>

          <section>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Course Structure</label>
            <div className="flex flex-col gap-2">
              {(Object.keys(COURSE_DATA) as CourseType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setCourseType(type);
                    reset();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded transition-all duration-200 font-bold text-sm ${
                    courseType === type 
                    ? "bg-slate-900 border-2 border-slate-900 text-white shadow-md shadow-slate-200" 
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span>{type}</span>
                  <div className={`w-4 h-4 rounded-full border-4 ${courseType === type ? 'border-white bg-slate-900' : 'border-slate-300 bg-transparent'}`}></div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Calculation Logic</label>
            <div className="space-y-4">
              <div className="flex flex-col gap-1 p-3 bg-slate-50 rounded border border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Auto-Scale Weightage</span>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Distribute marks based on mandatory credits: {config.ratio}</p>
              </div>
            </div>
          </section>

          <section className="mt-auto pt-6 border-t border-slate-100">
            <div className="bg-slate-50 p-4 rounded-lg flex items-start gap-3">
              <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500 font-medium leading-normal">
                Final marks are calculated using weightage normalization as per institutional guidelines.
              </p>
            </div>
          </section>
        </aside>

        {/* Content Area */}
        <section className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto bg-slate-50">
          {/* Summary Row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-5 border border-slate-200 rounded shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Internal Marks</span>
              <div className="text-2xl font-mono font-bold mt-1 text-slate-800 flex items-baseline gap-1">
                {internalMarks.total} <span className="text-[10px] opacity-40">/ {config.internalMax}</span>
              </div>
            </div>
            <div className="bg-white p-5 border border-slate-200 rounded shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ESE Weightage</span>
              <div className="text-2xl font-mono font-bold mt-1 text-slate-800 flex items-baseline gap-1">
                {finalCalculation.eseWeightObtained} <span className="text-[10px] opacity-40">/ {config.eseWeight}</span>
              </div>
            </div>
            <div className="bg-white p-5 border border-slate-200 rounded shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Course Weight</span>
              <div className="text-2xl font-mono font-bold mt-1 text-slate-800">{config.ratio}</div>
            </div>
            <div className="bg-white p-5 border border-slate-200 rounded shadow-sm border-l-4 border-l-blue-500">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Score</span>
              <div className="text-2xl font-mono font-bold mt-1 text-blue-600">{finalCalculation.total}</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 bg-slate-100 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-slate-500" />
                <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.2em]">Data Entry & Breakdown</h3>
              </div>
              <button 
                onClick={reset}
                className="px-3 py-1 text-[10px] font-bold border border-slate-300 rounded hover:bg-slate-50 group flex items-center gap-1.5 transition-colors"
              >
                <RefreshCcw size={10} className="group-hover:rotate-180 transition-transform duration-500" />
                RESET DATA
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {config.items.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.id}</label>
                      <span className="text-[10px] font-mono text-slate-400">MAX: {item.max} | WT: {item.weight}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={scores[item.id] || ''}
                        onChange={(e) => handleScoreChange(item.id, e.target.value)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val > item.max) handleScoreChange(item.id, item.max.toString());
                        }}
                        className={`w-full bg-slate-50 border border-slate-200 rounded p-3 font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all ${
                          parseFloat(scores[item.id] || '0') > item.max ? 'border-red-300 text-red-600' : 'text-slate-700'
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        WT: {((parseFloat(scores[item.id] || '0') / item.max) * item.weight).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="lg:col-span-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{config.ese.id}</label>
                    <span className="text-[10px] font-mono text-slate-400">MAX: {config.ese.max} | WT: {config.ese.weight}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={eseScore}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (e.target.value === '' || (!isNaN(val) && val >= 0)) setEseScore(e.target.value);
                      }}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val > config.ese.max) setEseScore(config.ese.max.toString());
                      }}
                      className="w-full bg-blue-50 border border-blue-100 rounded p-3 font-mono text-base font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                      ESE WT: {finalCalculation.eseWeightObtained}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress and Warnings */}
              <div className="mt-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Internal Fulfillment</span>
                    </div>
                    <span className="font-mono text-sm font-bold">{Math.min(100, (internalMarks.total / config.internalMax) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Final Achievement</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-blue-600">{finalCalculation.total}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveToFirebase}
                  disabled={saving}
                  className="px-4 py-2 text-[10px] font-extrabold bg-slate-900 text-white rounded-sm hover:bg-slate-800 shadow-lg shadow-slate-200 flex items-center gap-2 uppercase tracking-tight disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                  Save Final Record
                </button>
              </div>
              <div className="text-[11px] text-slate-400 font-medium italic uppercase tracking-widest flex items-center gap-2">
                <ArrowRight size={12} className="opacity-40" />
                Computation Engine v4.1 (Authorized Profile: {profile.registerNo})
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
