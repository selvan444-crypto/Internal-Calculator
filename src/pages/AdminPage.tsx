import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy,
  deleteDoc,
  doc,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MarkRecord, UserProfile, LoginLog } from '../types';
import { CourseType } from '../constants';
import { 
  Users, 
  FileText, 
  Download, 
  Trash2, 
  Search, 
  Filter, 
  User as UserIcon,
  HardDriveDownload,
  Database,
  History,
  ShieldCheck,
  Monitor,
  LayoutGrid,
  Clock,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Activity,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  Legend
} from 'recharts';

type AdminView = 'marks' | 'users' | 'history' | 'analytics';

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [activeView, setActiveView] = useState<AdminView>('history');
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Analytics Data Preparation
  const deptPerformanceData = useMemo(() => {
    const depts: Record<string, { total: number, count: number }> = {};
    marks.forEach(m => {
      if (!depts[m.department]) depts[m.department] = { total: 0, count: 0 };
      depts[m.department].total += m.totalMarks;
      depts[m.department].count += 1;
    });
    return Object.entries(depts).map(([name, data]) => ({
      name,
      average: parseFloat((data.total / data.count).toFixed(2))
    })).sort((a, b) => b.average - a.average);
  }, [marks]);

  const courseDistributionData = useMemo(() => {
    const types: Record<string, number> = {};
    marks.forEach(m => {
      types[m.courseType] = (types[m.courseType] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [marks]);

  const loginTrendData = useMemo(() => {
    const daily: Record<string, number> = {};
    logs.forEach(l => {
      const date = l.timestamp?.toDate?.()?.toLocaleDateString() || 'N/A';
      if (date !== 'N/A') daily[date] = (daily[date] || 0) + 1;
    });
    return Object.entries(daily)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7); // Last 7 days
  }, [logs]);

  const assessmentPerformanceData = useMemo(() => {
    const types: Record<string, Record<string, { total: number, count: number }>> = {
      THEORY: {}, TCPL: {}, TCPR: {}
    };

    marks.forEach(m => {
      if (!types[m.courseType]) return;
      Object.entries(m.scores || {}).forEach(([component, score]) => {
        if (!types[m.courseType][component]) {
          types[m.courseType][component] = { total: 0, count: 0 };
        }
        types[m.courseType][component].total += parseFloat(score as string) || 0;
        types[m.courseType][component].count += 1;
      });
    });

    const result: Record<string, any[]> = {};
    Object.entries(types).forEach(([type, components]) => {
      result[type] = Object.entries(components).map(([name, data]) => ({
        name,
        average: parseFloat((data.total / data.count).toFixed(2))
      })).sort((a, b) => a.name.localeCompare(b.name));
    });
    return result;
  }, [marks]);

  const [selectedCourseType, setSelectedCourseType] = useState<CourseType>('THEORY');

  const COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const parseUA = (ua: string) => {
    const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : ua.includes('Firefox') ? 'Firefox' : 'Browser';
    const os = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'MacOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'OS';
    return { browser, os };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (!isAdmin) return;

    // Listen to marks
    const marksQuery = query(collection(db, 'marks'), orderBy('createdAt', 'desc'));
    const unsubscribeMarks = onSnapshot(marksQuery, (snapshot) => {
      setMarks(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as MarkRecord)));
    });

    // Listen to users
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as UserProfile)));
    });

    // Listen to login logs (limited to last 200 for performance)
    const logsQuery = query(collection(db, 'login_logs'), orderBy('timestamp', 'desc'), limit(200));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as LoginLog)));
      setLoading(false);
    });

    return () => {
      unsubscribeMarks();
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, [isAdmin]);

  const deleteRecord = async (id: string, coll: string) => {
    if (!window.confirm('Confirm deletion from Master Repository? This action is irreversible.')) return;
    try {
      await deleteDoc(doc(db, coll, id));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const exportToCSV = (type: AdminView | 'all' = activeView) => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = '';

    const targetType = type === 'analytics' || type === 'all' ? 'users' : type;

    if (targetType === 'marks') {
      headers = ['Register No', 'Student Name', 'Department', 'Year/Sem', 'Course', 'Internal', 'ESE', 'Total', 'Date'];
      rows = marks.map(m => [
        m.registerNo, m.userName, m.department, m.yearSem, m.courseType, 
        m.internalMarks, m.eseMarks, m.totalMarks, m.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'
      ]);
      filename = `mark_records_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (targetType === 'users') {
      headers = ['UID', 'Name', 'Register No', 'Email', 'Dept', 'Year/Sem', 'Role', 'Created At'];
      rows = users.map(u => [
        u.uid, u.displayName, u.registerNo, u.email, u.department, u.yearSem, u.role,
        u.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'
      ]);
      filename = `user_profiles_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (targetType === 'history') {
      headers = ['ID', 'User', 'Reg No', 'Timestamp', 'Device'];
      rows = logs.map(l => [
        l.id, l.displayName, l.registerNo, l.timestamp?.toDate?.()?.toLocaleString() || 'N/A', l.userAgent
      ]);
      filename = `login_history_${new Date().toISOString().split('T')[0]}.csv`;
    }

    if (headers.length === 0) return;

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMarks = marks.filter(m => 
    m.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.registerNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.registerNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = logs.filter(l => 
    l.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.registerNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-slate-50 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <Trash2 size={32} />
        </div>
        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">Restricted Access</h2>
        <p className="text-slate-500 max-w-xs mt-2 text-sm leading-relaxed">
          Administrative privileges required for Master Repository verification.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Admin Toolbar */}
      <div className="p-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg text-white">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 leading-tight">Master Repository</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Security Clearance: Admin</p>
            </div>
          </div>
          
          <div className="h-10 w-px bg-slate-200" />

          {/* View Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button 
              onClick={() => setActiveView('analytics')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                activeView === 'analytics' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Activity size={14} />
              Analytics
            </button>
            <button 
              onClick={() => setActiveView('marks')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                activeView === 'marks' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <FileText size={14} />
              Records ({marks.length})
            </button>
            <button 
              onClick={() => setActiveView('users')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                activeView === 'users' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Users size={14} />
              Profiles ({users.length})
            </button>
            <button 
              onClick={() => setActiveView('history')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                activeView === 'history' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <History size={14} />
              History ({logs.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <button 
              className="px-6 py-3 bg-slate-900 text-white rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all transform active:scale-95 peer"
            >
              <HardDriveDownload size={14} />
              Export Repository
              <ChevronRight size={12} className="rotate-90" />
            </button>
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] py-2">
              <button 
                onClick={() => exportToCSV('users')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Users size={14} className="text-blue-500" />
                Download User Base
              </button>
              <button 
                onClick={() => exportToCSV('marks')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <FileText size={14} className="text-emerald-500" />
                Download Mark Records
              </button>
              <button 
                onClick={() => exportToCSV('history')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <History size={14} className="text-slate-400" />
                Download Login Logs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 p-8 pt-0 overflow-hidden flex flex-col gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full relative">
          
          {/* Search Header (Hide for Analytics) */}
          {activeView !== 'analytics' && (
            <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="relative w-full max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={16} />
                <input 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Synchronized identification search..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all tracking-tight"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  Live Stream Active
                </span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeView === 'analytics' && (
                <motion.div 
                  key="analytics-dashboard"
                  initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                  className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8"
                >
                  {/* Performance Chart */}
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <TrendingUp size={18} />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Performance by Dept</h3>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">AVERAGE TOTAL MARKS</span>
                    </div>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deptPerformanceData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={10} fontWeight="bold" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} fontWeight="bold" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="average" fill="#0f172a" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Course Distribution */}
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <PieChartIcon size={18} />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Course Distribution</h3>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">RECORD VOLUME</span>
                    </div>
                    <div className="h-[300px] flex items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={courseDistributionData}
                            cx="50%" cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {courseDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                          />
                          <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{value}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Login Trends */}
                  <div className="lg:col-span-2 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 text-white rounded-lg shadow-md">
                          <Activity size={18} />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Login Activity Trends</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rolling 7-Day Matrix</span>
                      </div>
                    </div>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={loginTrendData}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" fontSize={10} fontWeight="bold" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} fontWeight="bold" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                             contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                          />
                          <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Component Breakdown */}
                  <div className="lg:col-span-2 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <LayoutGrid size={18} />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Detailed Component Breakdown</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {(['THEORY', 'TCPL', 'TCPR'] as CourseType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => setSelectedCourseType(type)}
                            className={cn(
                              "px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all border",
                              selectedCourseType === type 
                                ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                                : "bg-white text-slate-400 border-slate-200 hover:text-slate-600"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-[350px]">
                      {assessmentPerformanceData[selectedCourseType]?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={assessmentPerformanceData[selectedCourseType]} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" fontSize={10} fontWeight="bold" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis dataKey="name" type="category" fontSize={10} fontWeight="bold" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} width={100} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                              cursor={{ fill: '#f8fafc' }}
                            />
                            <Bar dataKey="average" fill="#6366f1" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20">
                          <LayoutGrid size={48} className="mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No Component Data Synchronization Found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeView === 'marks' && (
                <motion.table 
                  key="marks-table"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="w-full border-collapse"
                >
                  <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                      <th className="p-5 text-left">Record Identification</th>
                      <th className="p-5 text-left">Internal</th>
                      <th className="p-5 text-left">ESE Weight</th>
                      <th className="p-5 text-left text-blue-600">Total Calculation</th>
                      <th className="p-5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredMarks.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 group transition-colors">
                        <td className="p-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-sans font-black text-slate-800 text-sm uppercase">{m.userName}</span>
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black">{m.courseType}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{m.registerNo} • {m.department} • {m.yearSem}</span>
                          </div>
                        </td>
                        <td className="p-5 font-mono text-sm font-black text-slate-600">{m.internalMarks}</td>
                        <td className="p-5 font-mono text-sm font-black text-slate-400">{m.eseMarks}</td>
                        <td className="p-5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="font-mono text-base font-black text-blue-600 tracking-tighter">{m.totalMarks}</span>
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => deleteRecord(m.id, 'marks')}
                              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </motion.table>
              )}

              {activeView === 'users' && (
                <motion.table 
                  key="users-table"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="w-full border-collapse"
                >
                  <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                      <th className="p-5 text-left">Institutional Profile</th>
                      <th className="p-5 text-left">Contact Info</th>
                      <th className="p-5 text-left">Access Role</th>
                      <th className="p-5 text-left">Registration Date</th>
                      <th className="p-5 text-center">Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50/50 group transition-colors">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                              <UserIcon size={16} />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-slate-800 text-sm uppercase">{u.displayName}</span>
                              <span className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-widest">{u.registerNo}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-600 font-bold">{u.email}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{u.department}</span>
                          </div>
                        </td>
                        <td className="p-5">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                            u.role === 'admin' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                          )}>
                            {u.role === 'admin' ? <ShieldCheck size={10} /> : <UserIcon size={10} />}
                            {u.role}
                          </div>
                        </td>
                        <td className="p-5 text-[11px] text-slate-400 font-bold uppercase">
                          {u.createdAt?.toDate?.()?.toLocaleDateString()}
                        </td>
                        <td className="p-5">
                          <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => deleteRecord(u.uid, 'users')}
                              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </motion.table>
              )}

              {activeView === 'history' && (
                <div className="flex flex-col gap-6">
                  {/* Session Insights */}
                  <div className="px-8 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                        <Activity size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sessions</p>
                        <p className="text-lg font-black text-slate-800">{logs.length}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                        <Clock size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent (1h)</p>
                        <p className="text-lg font-black text-slate-800">
                          {logs.filter(l => (new Date().getTime() - (l.timestamp?.toDate?.()?.getTime() || 0)) < 3600000).length}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center">
                        <Monitor size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monitoring</p>
                        <p className="text-lg font-black text-slate-800">ACTIVE</p>
                      </div>
                    </div>
                  </div>

                  <motion.table 
                  key="logs-table"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="w-full border-collapse"
                >
                  <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                      <th className="p-5 text-left">Session Identity</th>
                      <th className="p-5 text-left">Temporal Signature</th>
                      <th className="p-5 text-left">Access Vector (Device)</th>
                      <th className="p-5 text-center">Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredLogs.map((l) => {
                      const { browser, os } = parseUA(l.userAgent);
                      const logDate = l.timestamp?.toDate?.() || new Date();
                      
                      return (
                        <tr key={l.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-5">
                            <div className="flex flex-col">
                              <span className="font-black text-slate-800 text-[11px] uppercase tracking-tighter">{l.displayName}</span>
                              <span className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-widest">{l.registerNo}</span>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2 text-slate-600">
                                <Clock size={12} className="text-slate-300" />
                                <span className="text-[11px] font-bold uppercase">{logDate.toLocaleString()}</span>
                              </div>
                              <span className="text-[9px] font-black text-blue-500 uppercase ml-5">{getRelativeTime(logDate)}</span>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                <Monitor size={10} className="text-slate-400" />
                                <span className="text-[9px] font-black text-slate-600 uppercase">{os} • {browser}</span>
                              </div>
                              <span className="text-[9px] text-slate-300 font-medium truncate max-w-[120px] lg:max-w-xs" title={l.userAgent}>
                                {l.userAgent}
                              </span>
                            </div>
                          </td>
                          <td className="p-5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></span>
                              <button 
                                onClick={() => deleteRecord(l.id, 'login_logs')}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </motion.table>
              </div>
              )}
            </AnimatePresence>

            {/* Empty States */}
            {((activeView === 'marks' && filteredMarks.length === 0) || 
               (activeView === 'users' && filteredUsers.length === 0) ||
               (activeView === 'history' && filteredLogs.length === 0)) && !loading && (
              <div className="flex flex-col items-center justify-center p-32 text-center opacity-30">
                <LayoutGrid size={48} className="mb-4 text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Synchronized Data Found</p>
              </div>
            )}
          </div>
          
          {/* Footer Status */}
          <div className="p-5 bg-white border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck size={14} />
              <p className="text-[9px] font-black uppercase tracking-widest italic">
                Encrypted Master Stream Active • 2026-27 Session
              </p>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Connection Stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
