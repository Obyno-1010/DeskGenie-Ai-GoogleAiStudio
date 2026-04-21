import React, { useState } from 'react';
import { Protocol } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Search, 
  Book, 
  Activity,
  History,
  Tag
} from 'lucide-react';

interface Props {
  protocols: Protocol[];
  onSave: (protocol: Protocol) => void;
  onDelete: (id: string) => void;
}

export const ProtocolsManager: React.FC<Props> = ({ protocols, onSave, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Partial<Protocol> | null>(null);
  const [search, setSearch] = useState('');

  const handleStartNew = () => {
    setEditingProtocol({
      id: crypto.randomUUID(),
      title: '',
      content: '',
      keywords: [],
      category: 'general',
      lastUpdated: Date.now()
    });
    setIsEditing(true);
  };

  const handleEdit = (protocol: Protocol) => {
    setEditingProtocol(protocol);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editingProtocol && editingProtocol.title && editingProtocol.content) {
      onSave(editingProtocol as Protocol);
      setIsEditing(false);
      setEditingProtocol(null);
    }
  };

  const filtered = protocols.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.content.toLowerCase().includes(search.toLowerCase()) ||
    p.keywords.some(k => k.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-4xl font-bold text-white tracking-tight">Grounding <span className="text-indigo-400">Protocols</span></h2>
          <p className="text-slate-500 italic">Inject local knowledge and intelligence directives.</p>
        </div>
        <button 
          onClick={handleStartNew}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" />
          New Protocol
        </button>
      </div>

      <div className="flex gap-6 h-full overflow-hidden">
        {/* List Side */}
        <div className="w-[400px] flex flex-col gap-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Search knowledge node..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-slate-300 outline-none focus:border-indigo-500/50 transition-all font-sans"
            />
          </div>

          <div className="flex-1 overflow-auto space-y-4 pr-2 custom-scrollbar">
            {filtered.map(p => (
              <button 
                key={p.id}
                onClick={() => handleEdit(p)}
                className="w-full text-left glass-card p-6 rounded-3xl border-white/5 hover:border-indigo-500/30 transition-all group relative overflow-hidden bg-white/5"
              >
                <div className="relative z-10 space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded">
                      {p.category}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {new Date(p.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-lg group-hover:text-indigo-400 transition-colors">{p.title}</h4>
                  <p className="text-slate-500 text-sm line-clamp-2 italic leading-relaxed">
                    {p.content}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {p.keywords.slice(0, 3).map((k, i) => (
                      <span key={i} className="text-[9px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-white/5 uppercase tracking-tighter">
                        {k}
                      </span>
                    ))}
                    {p.keywords.length > 3 && (
                      <span className="text-[9px] text-slate-600 italic">+{p.keywords.length - 3} more</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-20 opacity-20 space-y-4">
                 <History className="w-12 h-12 mx-auto" />
                 <p className="font-mono text-sm">No protocols found in localized crypt.</p>
              </div>
            )}
          </div>
        </div>

        {/* Editor Side */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div 
                key="editor"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col gap-6"
              >
                <div className="glass-card flex-1 p-10 rounded-[3rem] border-white/10 bg-white/5 flex flex-col gap-8">
                  <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                         <Book className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Edit Grounding Protocol</h3>
                        <p className="text-xs text-slate-500 font-mono">{editingProtocol?.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <button 
                        onClick={() => onDelete(editingProtocol?.id!)}
                        className="p-3 text-slate-500 hover:text-red-400 transition-colors"
                        title="Purge Node"
                       >
                         <Trash2 className="w-5 h-5" />
                       </button>
                       <button 
                        onClick={() => setIsEditing(false)}
                        className="p-3 text-slate-500 hover:text-white transition-colors"
                       >
                         <X className="w-6 h-6" />
                       </button>
                    </div>
                  </div>

                  <div className="space-y-8 flex-1 overflow-auto pr-4 custom-scrollbar">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-600 block pl-1">Protocol Designation (Title)</label>
                      <input 
                        type="text"
                        value={editingProtocol?.title || ''}
                        onChange={(e) => setEditingProtocol(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Regional Secretariat Onboarding Protocol"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white text-lg outline-none focus:border-indigo-500/50 transition-all font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-slate-600 block pl-1">Intelligence Sector (Category)</label>
                        <select 
                          value={editingProtocol?.category || 'general'}
                          onChange={(e) => setEditingProtocol(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-indigo-400 outline-none focus:border-indigo-500/50 transition-all font-bold appearance-none"
                        >
                          <option value="general">General Administrative</option>
                          <option value="medical">Medical Disclosure</option>
                          <option value="legal">Legal Framework</option>
                          <option value="emergency">First Response</option>
                          <option value="onboarding">Secretariat Onboarding</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-slate-600 block pl-1">Semantic Triggers (Keywords)</label>
                        <input 
                          type="text"
                          placeholder="press enter to add triggers..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val && !editingProtocol?.keywords?.includes(val)) {
                                setEditingProtocol(prev => ({ ...prev, keywords: [...(prev?.keywords || []), val] }));
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-slate-300 outline-none focus:border-indigo-500/50 transition-all"
                        />
                        <div className="flex flex-wrap gap-2 pt-2">
                           {editingProtocol?.keywords?.map((k, i) => (
                             <span key={i} className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 text-[10px] font-bold">
                               <Tag className="w-3 h-3" />
                               {k}
                               <button onClick={() => setEditingProtocol(prev => ({ ...prev, keywords: prev?.keywords?.filter(kw => kw !== k) }))}>
                                 <X className="w-3 h-3 opacity-50 hover:opacity-100" />
                               </button>
                             </span>
                           ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 flex-1 flex flex-col min-h-[300px]">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-600 block pl-1">Core Intelligence Data (Content)</label>
                      <textarea 
                        value={editingProtocol?.content || ''}
                        onChange={(e) => setEditingProtocol(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Detailed knowledge text, rules, or professional directives for the AI node..."
                        className="w-full flex-1 bg-white/5 border border-white/10 rounded-3xl py-6 px-8 text-slate-300 outline-none focus:border-indigo-500/50 transition-all font-sans leading-relaxed resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button 
                      onClick={handleSave}
                      disabled={!editingProtocol?.title || !editingProtocol?.content}
                      className="bg-white text-black px-10 py-5 rounded-3xl font-bold flex items-center gap-3 hover:bg-slate-200 transition-all shadow-2xl disabled:opacity-30"
                    >
                      <Save className="w-5 h-5" />
                      Commit Protocol to Collective
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30"
              >
                <div className="w-32 h-32 bg-slate-800 rounded-[3rem] flex items-center justify-center border border-white/5">
                   <Activity className="w-16 h-16 text-slate-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white tracking-tight">Intelligence Node Inactive</h3>
                  <p className="text-slate-500 max-w-sm mx-auto italic">Select an existing knowledge node from the localized archives or initialize a new protocol.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
