/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Mic, 
  Send, 
  Search, 
  Settings as SettingsIcon, 
  BookOpen, 
  Home as HomeIcon,
  Copy,
  Volume2,
  Save,
  Check,
  ChevronLeft,
  X,
  Languages,
  Trash2,
  Loader2,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  User as UserIcon,
  Zap,
  Activity,
  History,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { doc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { cn } from './lib/utils';
import { GlassCard } from './components/GlassCard';
import { VoiceWaveform } from './components/VoiceWaveform';
import { useSpeech } from './hooks/useSpeech';
import { analyzeIntent, generateProfessionalResponse } from './lib/gemini';
import { saveQuery, getAllQueries, markAsSynced, deleteQuery, clearAllQueries } from './lib/storage';
import { syncQueries, saveToRemote, deleteFromRemote } from './lib/sync';
import { DeskQuery, Intent, ResponseStyle } from './types';

type Screen = 'AUTH' | 'HOME' | 'RECORDING' | 'RESPONSE' | 'KNOWLEDGE' | 'SETTINGS';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('AUTH');
  const [inputText, setInputText] = useState('');
  const [currentQuery, setCurrentQuery] = useState<DeskQuery | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [queries, setQueries] = useState<DeskQuery[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<ResponseStyle>('formal');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [knowledgeFilter, setKnowledgeFilter] = useState<'local' | 'cloud'>('local');

  const { isRecording, transcript, startRecording, stopRecording, speak, setTranscript } = useSpeech();

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        // Try a non-existent doc in a valid sub-collection structure to avoid rule issues if possible,
        // but just checking connectivity to the root of the db instance.
        await getDocFromServer(doc(db, 'system', 'connectivity_check'));
        console.log("Firebase connection established.");
      } catch (error: any) {
        if (error?.code === 'permission-denied') {
          console.log("Firebase connected (Permission verified).");
          return;
        }
        
        console.warn("Firebase connectivity warning:", error?.message || error);
        
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Critical: Could not reach Firestore. Please check if your project is correctly provisioned or if you are in an offline environment.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setScreen('HOME');
        handleSync();
      } else {
        setScreen('AUTH');
      }
    });
    return unsubscribe;
  }, []);

  // Load history
  useEffect(() => {
    if (user) {
      getAllQueries().then(setQueries);
    }
  }, [user]);

  const handleSync = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    await syncQueries();
    const all = await getAllQueries();
    setQueries(all);
    setIsSyncing(false);
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      
      // Initialize User Profile
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        await setDoc(userRef, {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName || 'Desk Officer',
          role: 'officer', // Default role
          lastLogin: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setScreen('AUTH');
  };

  const handleStartRecording = () => {
    const langMap: Record<string, string> = {
      'English': 'en-US',
      'Yoruba': 'yo-NG',
      'Igbo': 'ig-NG',
      'Hausa': 'ha-NG'
    };
    setTranscript('');
    setScreen('RECORDING');
    startRecording(langMap[selectedLanguage] || 'en-US');
  };

  const handleDeleteQuery = async (id: string) => {
    await deleteQuery(id);
    if (user) await deleteFromRemote(id);
    setQueries(prev => prev.filter(q => q.id !== id));
    showSuccess("Record deleted.");
  };

  const handleClearData = async () => {
    if (confirm("Are you sure you want to clear all local application data? This will not affect cloud records.")) {
      await clearAllQueries();
      setQueries([]);
      showSuccess("Local records purged.");
    }
  };

  const handleTemplateClick = (text: string) => {
    setInputText(text);
    showSuccess("Template applied.");
  };

  const handleArchive = () => {
    showSuccess("Query archived in permanent registry.");
  };

  const handleDispatch = () => {
    showSuccess("Response dispatched to secretariat nodes.");
  };

  const handleStopRecording = () => {
    stopRecording();
    setInputText(transcript);
    setScreen('HOME');
  };

  const handleProcessQuery = async (text: string) => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setScreen('RESPONSE');
    
    try {
      const intent = await analyzeIntent(text);
      const response = await generateProfessionalResponse(text, intent, selectedStyle, selectedLanguage);
      
      const newQuery: DeskQuery = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        text,
        intent,
        replyStyle: selectedStyle,
        response,
        isSynced: false,
        language: selectedLanguage
      };

      setCurrentQuery(newQuery);
      await saveQuery(newQuery);
      if (user) {
        await saveToRemote(newQuery);
        await markAsSynced(newQuery.id);
      }
      setQueries(prev => [newQuery, ...prev]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStyleChange = async (style: ResponseStyle) => {
    if (!currentQuery) return;
    setSelectedStyle(style);
    setIsAnalyzing(true);
    try {
      const response = await generateProfessionalResponse(currentQuery.text, currentQuery.intent, style, selectedLanguage);
      const updatedQuery = { ...currentQuery, response, replyStyle: style };
      setCurrentQuery(updatedQuery);
      
      // Update in storage and list
      await saveQuery(updatedQuery);
      if (user) {
        await saveToRemote(updatedQuery);
        await markAsSynced(updatedQuery.id);
      }
      setQueries(prev => prev.map(q => q.id === updatedQuery.id ? updatedQuery : q));
      showSuccess(`Style refined to ${style}.`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] sleek-gradient">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-indigo-500 font-sans font-bold text-2xl tracking-tighter"
        >
          DeskGenie AI
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-screen flex sleek-gradient overflow-hidden">
      <div className="atmosphere" />
      
      {/* Sidebar Navigation - Sleek Interface Pattern */}
      {user && (
        <aside className="w-20 bg-white/5 backdrop-blur-3xl border-r border-white/10 flex flex-col items-center py-8 gap-10 z-50">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Zap className="text-white w-7 h-7" />
          </div>
          
          <div className="flex flex-col gap-8">
            <button 
              onClick={() => setScreen('HOME')}
              className={cn(
                "p-3 rounded-xl transition-all duration-300",
                screen === 'HOME' ? "bg-white/10 text-white shadow-xl shadow-white/5" : "text-slate-400 hover:text-white"
              )}
            >
              <HomeIcon className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setScreen('KNOWLEDGE')}
              className={cn(
                "p-3 rounded-xl transition-all duration-300",
                screen === 'KNOWLEDGE' ? "bg-white/10 text-white shadow-xl shadow-white/5" : "text-slate-400 hover:text-white"
              )}
            >
              <History className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setScreen('SETTINGS')}
              className={cn(
                "p-3 rounded-xl transition-all duration-300",
                screen === 'SETTINGS' ? "bg-white/10 text-white shadow-xl shadow-white/5" : "text-slate-400 hover:text-white"
              )}
            >
              <SettingsIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="mt-auto flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-white/20 flex items-center justify-center font-bold text-xs">
              {user?.displayName?.slice(0, 2).toUpperCase() || 'DO'}
            </div>
            <button 
              onClick={handleLogout}
              className="p-3 text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-emerald-500 text-white rounded-full font-bold shadow-2xl flex items-center gap-3 border border-emerald-400"
            >
              <Check className="w-5 h-5" />
              {successMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="px-10 pt-8 pb-4 flex items-center justify-between z-10 sticky top-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              DeskGenie AI 
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-wider rounded border border-emerald-500/30">
                Offline Mode
              </span>
            </h1>
            <p className="text-slate-400 text-sm">Administrative Assistant — Branch Secretariat</p>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-lg">
                <div className="flex gap-2">
                  <span className={cn("w-2 h-2 rounded-full", isSyncing ? "bg-emerald-400 animate-pulse" : "bg-indigo-400")}></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-400/40"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-400/40"></span>
                </div>
                <span className="text-[10px] font-mono uppercase text-slate-300">
                  {isSyncing ? "Syncing..." : "AI Engaged"}
                </span>
              </div>
            )}
            
            {user && (
              <button 
                onClick={handleSync}
                className="glass-button p-2.5 rounded-xl border-white/5"
              >
                <Cloud className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>
        </header>

        {/* Interaction Viewport */}
        <main className="flex-1 p-10 overflow-auto relative">
          <AnimatePresence mode="wait">
            {screen === 'AUTH' && !user && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-12 max-w-4xl mx-auto"
              >
                <div className="space-y-4">
                  <h2 className="text-6xl font-bold text-white tracking-tight leading-[1.1]">
                    Professional <br /> <span className="text-indigo-400">Desk Intelligence</span>
                  </h2>
                  <p className="text-slate-400 text-xl max-w-2xl mx-auto">
                    A sleek administrative assistant for modern governance and healthcare professionals.
                  </p>
                </div>

                <div className="max-w-md w-full">
                  <GlassCard className="p-8 space-y-8 rounded-[40px] border-white/10 bg-white/5 backdrop-blur-3xl shadow-2xl">
                    <div className="w-20 h-20 bg-indigo-600/20 rounded-[2rem] flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
                      <Zap className="w-10 h-10 text-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white tracking-tight">Agency Access</h3>
                      <p className="text-slate-400">Authenticate with your department credentials to securely sync administrative records.</p>
                    </div>
                    <button 
                      onClick={handleLogin}
                      className="w-full bg-white text-black py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-200 transition-all font-sans shadow-xl shadow-white/5"
                    >
                      <LogIn className="w-5 h-5" />
                      Sign In with Google
                    </button>
                  </GlassCard>
                </div>

                <div className="flex items-center gap-6 opacity-40">
                   <div className="bg-slate-500 h-[1px] flex-1 w-24"></div>
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Encrypted Intelligence</p>
                   <div className="bg-slate-500 h-[1px] flex-1 w-24"></div>
                </div>
              </motion.div>
            )}

            {screen === 'HOME' && user && (
              <motion.div
                key="home"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-12 gap-8 h-full"
              >
                {/* Left Sidebar: Templates & Language */}
                <div className="col-span-3 flex flex-col gap-6">
                  <GlassCard className="p-6 bg-white/5 border-white/10 rounded-[2.5rem]">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                      <BookOpen className="w-3 h-3" /> Smart Templates
                    </h3>
                    <div className="space-y-3">
                      <button 
                        onClick={() => handleTemplateClick("Draft an official memo regarding the quarterly budget allocation for the branch secretariat.")}
                        className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/50 hover:bg-white/10 transition-all text-left group"
                      >
                        <p className="text-sm font-semibold text-slate-200 group-hover:text-white">Official Memo</p>
                        <p className="text-[10px] text-slate-500 italic mt-1">Yoruba / English / formal</p>
                      </button>
                      <button 
                        onClick={() => handleTemplateClick("Request a patient referral form for a specialist consultation at the general hospital.")}
                        className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/50 hover:bg-white/10 transition-all text-left group"
                      >
                        <p className="text-sm font-semibold text-slate-200 group-hover:text-white">Patient Referral</p>
                        <p className="text-[10px] text-slate-500 italic mt-1">Medical Correspondence</p>
                      </button>
                      <button 
                        onClick={() => handleTemplateClick("Respond to a citizen's inquiry regarding the new Land Use Act protocols.")}
                        className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/50 hover:bg-white/10 transition-all text-left group"
                      >
                        <p className="text-sm font-semibold text-slate-200 group-hover:text-white">Citizen Response</p>
                        <p className="text-[10px] text-slate-500 italic mt-1">LGA Inquiry Protocol</p>
                      </button>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-6 bg-white/5 border-white/10 rounded-[2.5rem] flex-1">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                      <Languages className="w-3 h-3" /> Language Protocol
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {['English', 'Yoruba', 'Igbo', 'Hausa'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setSelectedLanguage(lang)}
                          className={cn(
                            "py-3 rounded-xl text-xs font-bold transition-all",
                            selectedLanguage === lang 
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                              : "bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent hover:border-white/5"
                          )}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </GlassCard>
                </div>

                {/* Center: Command Center */}
                <div className="col-span-9 flex flex-col gap-6">
                  <div className="flex-1 bg-white/5 backdrop-blur-[40px] rounded-[3rem] border border-white/10 p-10 relative overflow-hidden flex flex-col shadow-2xl">
                    <div className="flex flex-col gap-8 flex-1">
                       <div className="space-y-4">
                        <h2 className="text-4xl font-bold text-white tracking-tight">How can I assist <br /><span className="text-indigo-400">The Agency today?</span></h2>
                        <p className="text-slate-500">Secure Administrative Pipeline • Llama-3-Quik Active</p>
                      </div>

                      <div className="relative group">
                        <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="Type an administrative query or complaint..."
                          className="w-full bg-white/5 rounded-[2rem] p-8 min-h-[240px] resize-none outline-none text-xl border border-white/10 focus:border-indigo-500/50 transition-all font-medium placeholder-slate-600 text-white"
                        />
                        <div className="absolute bottom-6 right-6">
                           <button 
                            onClick={() => handleProcessQuery(inputText)}
                            disabled={!inputText.trim() || isAnalyzing}
                            className="w-16 h-16 rounded-[2rem] bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-110 shadow-2xl shadow-indigo-600/40"
                          >
                            <Send className="w-7 h-7 text-white" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-8 border-t border-white/5">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={handleStartRecording}
                          className="flex items-center gap-3 text-slate-400 hover:text-indigo-400 transition-colors font-bold uppercase tracking-widest text-[10px]"
                        >
                          <Mic className="w-5 h-5" />
                          <span>Voice Protocol</span>
                        </button>
                        <div className="h-4 w-[1px] bg-slate-800" />
                        <div className="flex items-center gap-2">
                           <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                           <span className="text-[10px] uppercase font-bold tracking-widest text-slate-600 font-mono">Real-time Inference</span>
                        </div>
                      </div>
                      
                      <div className="flex -space-x-2">
                         {[1,2,3].map(i => (
                           <div key={i} className="w-6 h-6 rounded-full border border-[#0f172a] bg-indigo-600/20 flex items-center justify-center">
                             <UserIcon className="w-3 h-3 text-indigo-400" />
                           </div>
                         ))}
                         <div className="w-6 h-6 rounded-full border border-[#0f172a] bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500">+12</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {screen === 'RECORDING' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center justify-center gap-16 py-20 text-center h-full max-w-2xl mx-auto"
            >
              <div className="space-y-4">
                <h2 className="text-4xl font-bold text-white tracking-tight">Agency Voice Protocol</h2>
                <p className="text-slate-500">The microphone is active. Voice data is processed locally for enhanced privacy.</p>
              </div>

              <VoiceWaveform isRecording={isRecording} />

              <GlassCard className="w-full p-8 rounded-[2rem] border-white/10 bg-white/5 italic text-slate-300 min-h-[160px] flex items-center justify-center text-lg shadow-inner">
                {transcript || "Speak now..."}
              </GlassCard>

              <button 
                onClick={handleStopRecording}
                className="w-24 h-24 rounded-3xl bg-red-500/20 border border-red-500/30 flex items-center justify-center group relative shadow-2xl transition-all hover:scale-95 active:scale-90"
              >
                <div className="absolute inset-0 bg-red-500 animate-ping opacity-10 rounded-full" />
                <div className="w-10 h-10 bg-red-500 rounded-xl group-hover:scale-90 transition-transform shadow-lg shadow-red-500/50" />
              </button>
            </motion.div>
          )}

          {screen === 'RESPONSE' && (
            <motion.div
              key="response"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 h-full flex flex-col"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setScreen('HOME')}
                  className="glass-button p-3 rounded-2xl flex items-center gap-2 text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Workspace</span>
                </button>
                <div className="flex gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                  {(['formal', 'concise', 'detailed'] as ResponseStyle[]).map((style) => (
                    <button
                      key={style}
                      onClick={() => handleStyleChange(style)}
                      className={cn(
                        "px-6 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                        selectedStyle === style 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                          : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                      )}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <GlassCard className="p-0 border-white/10 shadow-indigo-600/5 flex-1 flex flex-col rounded-[3rem] overflow-hidden">
                <div className="p-8 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Transcription Archive</h3>
                    <p className="text-slate-300 font-medium truncate max-w-lg italic">"{currentQuery?.text}"</p>
                  </div>
                  <div className="px-4 py-1.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-500/20 uppercase tracking-widest">
                    Intent: {currentQuery?.intent || 'Analysis...'}
                  </div>
                </div>
                
                <div className="p-10 flex-1 relative overflow-auto custom-scrollbar prose-indigo">
                  {isAnalyzing ? (
                    <div className="h-full flex flex-col items-center justify-center gap-6 py-12">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                         <div className="relative">
                            <Loader2 className="w-12 h-12 text-indigo-500" />
                            <div className="absolute inset-0 blur-xl bg-indigo-500 animate-pulse opacity-20"></div>
                         </div>
                      </motion.div>
                      <div className="space-y-2 text-center">
                        <p className="text-white text-lg font-bold tracking-tight">Processing Intelligence</p>
                        <p className="text-slate-500 text-sm animate-pulse">Running semantic analysis on local nodes...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="prose-custom max-w-none">
                      <ReactMarkdown>
                        {currentQuery?.response || ""}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {!isAnalyzing && (
                  <div className="p-6 grid grid-cols-4 gap-4 border-t border-white/10 bg-white/[0.03]">
                    <button 
                      onClick={() => copyToClipboard(currentQuery?.response || '')}
                      className="glass-button py-4 flex flex-col items-center gap-2 rounded-2xl hover:bg-white/10 border-white/5"
                    >
                      {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-400" />}
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Copy</span>
                    </button>
                    <button 
                      onClick={() => {
                        const langMap: Record<string, string> = {
                          'English': 'en-US',
                          'Yoruba': 'yo-NG',
                          'Igbo': 'ig-NG',
                          'Hausa': 'ha-NG'
                        };
                        speak(currentQuery?.response || '', langMap[selectedLanguage] || 'en-US');
                      }}
                      className="glass-button py-4 flex flex-col items-center gap-2 rounded-2xl hover:bg-white/10 border-white/5"
                    >
                      <Volume2 className="w-5 h-5 text-slate-400" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Speak</span>
                    </button>
                    <button 
                      onClick={handleArchive}
                      className="glass-button py-4 flex flex-col items-center gap-2 rounded-2xl hover:bg-white/10 border-white/5"
                    >
                      <Save className="w-5 h-5 text-slate-400" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Archive</span>
                    </button>
                    <button 
                      onClick={handleDispatch}
                      className="glass-button py-4 flex flex-col items-center gap-2 rounded-2xl hover:bg-white/10 border-white/5"
                    >
                      <Languages className="w-5 h-5 text-slate-400" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Dispatch</span>
                    </button>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {screen === 'KNOWLEDGE' && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col gap-10"
            >
              <div className="flex items-center justify-between">
                 <div className="space-y-1">
                    <h2 className="text-4xl font-bold text-white tracking-tight">Registry <span className="text-indigo-400">Archives</span></h2>
                    <p className="text-slate-500 italic">Total Records Sync: {queries.length} entries</p>
                 </div>
                 <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
                    <button 
                      onClick={() => setKnowledgeFilter('local')}
                      className={cn(
                        "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                        knowledgeFilter === 'local' ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20" : "text-slate-400 hover:text-white"
                      )}
                    >
                      All Local
                    </button>
                    <button 
                      onClick={() => setKnowledgeFilter('cloud')}
                      className={cn(
                        "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                        knowledgeFilter === 'cloud' ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20" : "text-slate-400 hover:text-white"
                      )}
                    >
                      Cloud Backend
                    </button>
                 </div>
              </div>

              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 w-6 h-6 transition-colors group-focus-within:text-indigo-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search agency archives, memos, or protocols..."
                  className="w-full bg-white/5 rounded-[2.5rem] pl-16 pr-6 py-6 outline-none text-lg border border-white/10 focus:border-indigo-500/50 transition-all font-medium placeholder-slate-600 text-white"
                />
              </div>

              <div className="flex-1 space-y-6 overflow-auto custom-scrollbar pb-10">
                <h3 className="text-xs uppercase tracking-widest text-slate-600 font-bold flex items-center gap-2 border-b border-white/5 pb-4">
                  <Activity className="w-3 h-3" /> Historical Timeline
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {queries
                    .filter(q => {
                      const matchesSearch = q.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                           q.response.toLowerCase().includes(searchQuery.toLowerCase());
                      const matchesFilter = knowledgeFilter === 'local' ? true : q.isSynced;
                      return matchesSearch && matchesFilter;
                    })
                    .map((q) => (
                    <GlassCard 
                      key={q.id} 
                      className="p-6 rounded-[2rem] border-white/5 hover:border-indigo-500/30 hover:bg-white/10 transition-all cursor-pointer group"
                      onClick={() => {
                        setCurrentQuery(q);
                        setScreen('RESPONSE');
                      }}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest border",
                            q.intent === 'emergency' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            q.intent === 'complaint' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                          )}>
                            {q.intent}
                          </span>
                          <div className="flex items-center gap-2 text-slate-600 font-mono text-[10px]">
                             <Activity className="w-3 h-3" />
                             {new Date(q.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                        <p className="text-slate-200 font-bold text-lg line-clamp-2 leading-tight group-hover:text-white transition-colors">{q.text}</p>
                        <div className="flex items-center justify-between pt-2">
                           <div className="flex -space-x-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteQuery(q.id);
                                }}
                                className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                           <span className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Formal Review</span>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                  {queries.length === 0 && (
                    <div className="col-span-2 text-center py-40 text-slate-700 space-y-4">
                      <BookOpen className="w-20 h-20 mx-auto mb-4 opacity-5" />
                      <p className="text-xl font-bold tracking-tight">No intelligence captured yet.</p>
                      <button 
                        onClick={() => setScreen('HOME')}
                        className="text-indigo-500 hover:underline underline-offset-8"
                      >
                        Initiate first request
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'SETTINGS' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full max-w-3xl border-l border-white/5 pl-12 ml-auto"
            >
              <div className="space-y-12 py-10">
                <div className="space-y-1">
                  <h2 className="text-4xl font-bold text-white tracking-tight">System <span className="text-indigo-400">Control</span></h2>
                  <p className="text-slate-500 italic">Configure agency nodes and interface dialect.</p>
                </div>

                <div className="space-y-10">
                  <div className="space-y-6">
                    <h3 className="text-xs uppercase tracking-widest text-slate-600 font-bold border-b border-white/5 pb-2">Intelligence Profile</h3>
                    <div className="flex items-center gap-6">
                       <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-600 border-2 border-white/20 flex items-center justify-center text-3xl font-bold shadow-2xl">
                         {user?.displayName?.slice(0, 1) || 'D'}
                       </div>
                       <div className="space-y-1">
                          <p className="text-2xl font-bold text-white tracking-tight">{user?.displayName || 'Desk Officer'}</p>
                          <p className="text-slate-500 font-mono text-sm">{user?.email}</p>
                          <div className="pt-2">
                             <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase">Primary Node</span>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs uppercase tracking-widest text-slate-600 font-bold border-b border-white/5 pb-2">System Config</h3>
                    <div className="grid gap-4">
                      <div className="glass-card p-6 flex items-center justify-between rounded-[2rem] bg-white/5 border-white/10">
                        <div className="flex items-center gap-5">
                          <div className="p-3 bg-white/5 rounded-2xl">
                             <Languages className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-white font-bold">Standard Protocol Dialect</p>
                            <p className="text-xs text-slate-500">Determines linguistic nuance for AI generation</p>
                          </div>
                        </div>
                        <select 
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2 text-sm outline-none text-indigo-400 font-bold"
                        >
                          <option value="English">English</option>
                          <option value="Yoruba">Yoruba</option>
                          <option value="Igbo">Igbo</option>
                          <option value="Hausa">Hausa</option>
                        </select>
                      </div>

                      <div className="glass-card p-6 flex items-center justify-between rounded-[2rem] bg-white/5 border-white/10">
                        <div className="flex items-center gap-5">
                          <div className="p-3 bg-white/5 rounded-2xl">
                             <Cloud className="w-5 h-5 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-white font-bold">Cloud Synchronization</p>
                            <p className="text-xs text-slate-500">Synchronize records with central command</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-xl border border-emerald-500/20">
                           <Activity className="w-3 h-3" /> Active
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs uppercase tracking-widest text-slate-600 font-bold border-b border-white/5 pb-2">Network Terminals</h3>
                    <div className="grid gap-3">
                      <button 
                        onClick={handleClearData}
                        className="w-full glass-card p-6 flex items-center justify-between hover:bg-white/10 transition-all rounded-[2rem] border-white/5 group border-red-500/10 text-red-500/80 hover:text-red-500"
                      >
                        <div className="flex items-center gap-5">
                          <div className="p-3 bg-red-500/5 rounded-2xl group-hover:bg-red-500/10 transition-colors">
                             <Trash2 className="w-5 h-5" />
                          </div>
                          <span className="font-bold">Purge Local Agency Crypt</span>
                        </div>
                        <Info className="w-4 h-4 opacity-40" />
                      </button>

                      <button 
                        onClick={handleLogout}
                        className="w-full glass-card p-6 flex items-center justify-between hover:bg-white/10 transition-all rounded-[2rem] border-white/5 group"
                      >
                        <div className="flex items-center gap-5">
                          <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-red-500/10 transition-colors">
                             <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-400" />
                          </div>
                          <span className="text-slate-400 font-bold group-hover:text-white">Relinquish Node Control</span>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-slate-600 rotate-180" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-20 text-center opacity-20">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">DeskGenie v1.0.0 • Federal Intelligence Protocol Enabled</p>
                    <p className="text-[8px] text-slate-700 mt-2">Node: europe-west3-secretariat-03</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  </div>
  );
}
