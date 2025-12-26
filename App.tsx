
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  FileUp, 
  Download, 
  Trash2, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  LayoutGrid, 
  List, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Zap,
  ChevronLeft,
  ChevronRight,
  Check,
  Tv,
  Film,
  PlayCircle,
  Grid3X3,
  Copy,
  Move,
  X,
  Plus,
  Settings2,
  FolderEdit,
  Pencil,
  Save,
  FolderPlus,
  Globe,
  Database,
  UploadCloud,
  Loader2
} from 'lucide-react';
import { M3UItem, PlaylistStats, SortOption, StreamCategory } from './types';
import { parseM3UAsync, generateM3U } from './utils/m3uParser';
import { cleanTitlesWithAI, categorizeWithAI } from './services/geminiService';
import Dashboard from './components/Dashboard';

const ITEMS_PER_PAGE = 100;

const App: React.FC = () => {
  // --- All State Declarations ---
  const [items, setItems] = useState<M3UItem[]>([]);
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<StreamCategory | 'All'>('All');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.NAME_ASC);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMethod, setImportMethod] = useState<'file' | 'url' | 'xtream'>('file');
  const [importUrl, setImportUrl] = useState('');
  const [xtreamData, setXtreamData] = useState({ host: '', user: '', pass: '' });
  const [isDragging, setIsDragging] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'move' | 'copy'>('move');
  const [targetGroupInput, setTargetGroupInput] = useState('');
  const [groupModalSelection, setGroupModalSelection] = useState<string | null>(null);
  const [itemsToProcess, setItemsToProcess] = useState<string[]>([]);

  // Group Manager State
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupValue, setEditGroupValue] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  // Context Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenuId]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // --- Import Handlers ---
  const processM3UContent = async (content: string, sourceName: string) => {
    if (!content.trim().startsWith('#EXTM3U')) {
      showToast("Invalid M3U playlist format.", "error");
      return;
    }

    setIsProcessing(true);
    setLoadingMessage(`Parsing playlist from ${sourceName}...`);
    try {
      const parsed = await parseM3UAsync(content);
      setItems(parsed);
      setCurrentPage(1);
      setIsImportModalOpen(false);
      showToast(`Successfully imported ${parsed.length} items!`);
    } catch (err) {
      console.error("Parsing error:", err);
      showToast("Failed to parse playlist content.", "error");
    } finally {
      setIsProcessing(false);
      setLoadingMessage('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.m3u') && !file.name.toLowerCase().endsWith('.m3u8')) {
      showToast("Please select a valid .m3u or .m3u8 file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processM3UContent(content, file?.name || 'Local File');
    };
    reader.readAsText(file);
  };

  const handleUrlImport = async () => {
    if (!importUrl.trim()) return;
    setIsProcessing(true);
    setLoadingMessage('Fetching remote playlist...');
    try {
      const response = await fetch(importUrl);
      if (!response.ok) throw new Error("Fetch failed");
      const content = await response.text();
      await processM3UContent(content, 'Remote URL');
    } catch (err) {
      showToast("Connection error. Ensure the URL is correct and CORS is allowed.", "error");
    } finally {
      setIsProcessing(false);
      setLoadingMessage('');
    }
  };

  const handleXtreamImport = async () => {
    const { host, user, pass } = xtreamData;
    if (!host || !user || !pass) {
      showToast("Please fill all Xtream fields.", "error");
      return;
    }

    let cleanHost = host.trim().replace(/\/$/, "");
    if (!cleanHost.startsWith('http')) cleanHost = `http://${cleanHost}`;
    
    const finalUrl = `${cleanHost}/get.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&type=m3u_plus&output=ts`;
    
    setIsProcessing(true);
    setLoadingMessage('Connecting to Xtream API...');
    try {
      const response = await fetch(finalUrl);
      if (!response.ok) throw new Error("Connection failed");
      const content = await response.text();
      await processM3UContent(content, 'Xtream API');
    } catch (err) {
      showToast("Could not connect to Xtream. Check credentials or CORS restrictions.", "error");
    } finally {
      setIsProcessing(false);
      setLoadingMessage('');
    }
  };

  // --- Group Logic ---
  const allGroups = useMemo(() => {
    const set = new Set(items.map(i => i.group));
    customGroups.forEach(g => set.add(g));
    return Array.from(set).sort();
  }, [items, customGroups]);

  const groupStats = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      counts[item.group] = (counts[item.group] || 0) + 1;
    });
    customGroups.forEach(g => {
        if (!counts[g]) counts[g] = 0;
    });
    return counts;
  }, [items, customGroups]);

  const handleGroupAction = (newGroup: string) => {
    if (itemsToProcess.length === 0) return;
    const targetSet = new Set(itemsToProcess);

    if (modalMode === 'move') {
      setItems(prev => prev.map(item => {
        if (targetSet.has(item.id)) {
          return { ...item, group: newGroup, rawAttributes: { ...item.rawAttributes, 'group-title': newGroup } };
        }
        return item;
      }));
    } else {
      setItems(prev => {
        const copies = prev.filter(item => targetSet.has(item.id)).map(item => ({
          ...item,
          id: 'copy-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
          group: newGroup,
          name: `${item.name} (Copy)`,
          rawAttributes: { ...item.rawAttributes, 'group-title': newGroup }
        }));
        return [...prev, ...copies];
      });
    }
    
    setIsGroupModalOpen(false);
    setTargetGroupInput('');
    setGroupModalSelection(null);
    setSelectedItems(new Set());
    setActiveMenuId(null);
    setItemsToProcess([]);
    showToast(`Items ${modalMode === 'move' ? 'moved' : 'copied'} to "${newGroup}"`);
  };

  const renameGroup = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingGroup(null);
      return;
    }
    setItems(prev => prev.map(item => 
      item.group === oldName ? { ...item, group: newName, rawAttributes: { ...item.rawAttributes, 'group-title': newName } } : item
    ));
    setCustomGroups(prev => prev.map(g => g === oldName ? newName : g));
    setEditingGroup(null);
    if (selectedGroup === oldName) setSelectedGroup(newName);
    showToast(`Group renamed to "${newName}"`);
  };

  const deleteGroup = (groupName: string) => {
    const count = groupStats[groupName] || 0;
    if (window.confirm(`Are you sure you want to delete the folder "${groupName}" and all its ${count} items?`)) {
      setItems(prev => prev.filter(item => item.group !== groupName));
      setCustomGroups(prev => prev.filter(g => g !== groupName));
      if (selectedGroup === groupName) setSelectedGroup('All');
      showToast(`Folder "${groupName}" deleted`);
    }
  };

  const createGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (allGroups.includes(name)) {
      showToast("Group already exists.", "error");
      return;
    }
    setCustomGroups(prev => [...prev, name]);
    showToast(`Folder "${name}" created successfully!`);
    setNewGroupName('');
  };

  const openGroupModal = (mode: 'move' | 'copy', singleId?: string) => {
    setModalMode(mode);
    const targets = singleId ? [singleId] : Array.from(selectedItems);
    setItemsToProcess(targets);
    setIsGroupModalOpen(true);
  };

  const selectGroupAndClose = (groupName: string) => {
    setSelectedGroup(groupName);
    setCurrentPage(1);
    setIsManagerModalOpen(false);
    setGroupSearch('');
    showToast(`Showing folder: ${groupName}`);
  };

  // --- Fix: toggleSelection Function ---
  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Fix: validateStreams Function ---
  const validateStreams = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);
    setLoadingMessage('Validating stream health...');
    
    // Validate the first 50 items for demonstration (CORS might block many)
    const itemsToValidate = items.slice(0, 50);
    
    const results = await Promise.all(itemsToValidate.map(async (item) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        await fetch(item.url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
        clearTimeout(timeoutId);
        return { id: item.id, status: 'online' as const };
      } catch (e) {
        return { id: item.id, status: 'offline' as const };
      }
    }));

    setItems(prev => prev.map(item => {
      const found = results.find(r => r.id === item.id);
      return found ? { ...item, status: found.status } : item;
    }));

    setIsProcessing(false);
    setLoadingMessage('');
    showToast(`Validation complete for ${results.length} streams.`);
  };

  // --- Fix: runAICleanup Function ---
  const runAICleanup = async () => {
    const targets = selectedItems.size > 0 
      ? items.filter(i => selectedItems.has(i.id))
      : items;

    if (targets.length === 0) {
      showToast("No items to clean", "error");
      return;
    }
    
    setIsProcessing(true);
    setLoadingMessage('AI is cleaning stream titles...');
    
    try {
      const cleaned = await cleanTitlesWithAI(targets);
      if (cleaned && cleaned.length > 0) {
        const cleanMap = new Map(cleaned.map(c => [c.id, c.name]));
        setItems(prev => prev.map(item => {
          if (cleanMap.has(item.id)) {
            return { ...item, name: cleanMap.get(item.id)! };
          }
          return item;
        }));
        showToast(`AI cleaned ${cleaned.length} titles`);
      } else {
        showToast("AI returned no results", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("AI Cleanup failed", "error");
    } finally {
      setIsProcessing(false);
      setLoadingMessage('');
    }
  };

  // --- Fix: runAICategorize Function ---
  const runAICategorize = async () => {
    const targets = selectedItems.size > 0 
      ? items.filter(i => selectedItems.has(i.id))
      : items;

    if (targets.length === 0) {
      showToast("No items to categorize", "error");
      return;
    }
    
    setIsProcessing(true);
    setLoadingMessage('AI is analyzing content types...');
    
    try {
      const categorized = await categorizeWithAI(targets);
      if (categorized && categorized.length > 0) {
        const groupMap = new Map(categorized.map(c => [c.id, c.group]));
        setItems(prev => prev.map(item => {
          if (groupMap.has(item.id)) {
            const newGroup = groupMap.get(item.id)!;
            return { 
              ...item, 
              group: newGroup, 
              rawAttributes: { ...item.rawAttributes, 'group-title': newGroup } 
            };
          }
          return item;
        }));
        showToast(`AI categorized ${categorized.length} items`);
      } else {
        showToast("AI returned no results", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("AI Grouping failed", "error");
    } finally {
      setIsProcessing(false);
      setLoadingMessage('');
    }
  };

  // --- Memos ---
  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                            item.url.toLowerCase().includes(search.toLowerCase());
      const matchesTab = activeTab === 'All' || item.category === activeTab;
      const matchesGroup = selectedGroup === 'All' || item.group === selectedGroup;
      return matchesSearch && matchesTab && matchesGroup;
    });

    switch (sortBy) {
      case SortOption.NAME_ASC: result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case SortOption.NAME_DESC: result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case SortOption.GROUP_ASC: result.sort((a, b) => a.group.localeCompare(b.group)); break;
      case SortOption.URL_ASC: result.sort((a, b) => a.url.localeCompare(b.url)); break;
    }

    return result;
  }, [items, search, activeTab, selectedGroup, sortBy]);

  const managedGroups = useMemo(() => {
    return allGroups.filter(g => g.toLowerCase().includes(groupSearch.toLowerCase()));
  }, [allGroups, groupSearch]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  const groupsForFilter = useMemo(() => {
    const relevantGroups = new Set(activeTab === 'All' ? allGroups : items.filter(i => i.category === activeTab).map(i => i.group));
    if (activeTab === 'All') {
        customGroups.forEach(g => relevantGroups.add(g));
    }
    return ['All', ...Array.from(relevantGroups)].sort();
  }, [items, activeTab, allGroups, customGroups]);

  const stats: PlaylistStats = useMemo(() => ({
    total: items.length,
    online: items.filter(i => i.status === 'online').length,
    offline: items.filter(i => i.status === 'offline').length,
    groups: allGroups.length,
    duplicates: items.length - new Set(items.map(i => i.url)).size,
    tvCount: items.filter(i => i.category === 'TV').length,
    movieCount: items.filter(i => i.category === 'Movie').length,
    seriesCount: items.filter(i => i.category === 'Series').length,
  }), [items, allGroups]);

  return (
    <div className="min-h-screen pb-20 bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-200">
              <Zap className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">M3U Ultra Editor <span className="text-indigo-600">Pro</span></h1>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-200 font-bold text-sm shadow-sm"
            >
              <FileUp size={18} />
              Import Playlist
            </button>
            <button 
              onClick={() => {
                const content = generateM3U(items);
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'playlist_edited.m3u';
                a.click();
                URL.revokeObjectURL(url);
                showToast("Playlist exported successfully");
              }} 
              disabled={items.length === 0} 
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50 font-bold text-sm"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <Dashboard stats={stats} />

        {/* Category Navigation Tabs */}
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl mb-6 w-fit shadow-inner">
          <button 
            onClick={() => { setActiveTab('All'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'All' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Grid3X3 size={18} /> All Content
          </button>
          <button 
            onClick={() => { setActiveTab('TV'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'TV' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Tv size={18} /> TV Channels
          </button>
          <button 
            onClick={() => { setActiveTab('Movie'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'Movie' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Film size={18} /> Movies (VOD)
          </button>
          <button 
            onClick={() => { setActiveTab('Series'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'Series' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <PlayCircle size={18} /> Series
          </button>
        </div>

        {/* Search & Toolbar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-1 min-w-[300px] items-center gap-2 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
              <Search className="text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder={`Search in ${activeTab}...`} 
                className="bg-transparent border-none outline-none w-full text-sm font-medium"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
                <select 
                  className="bg-transparent px-3 py-1 text-sm font-bold outline-none min-w-[140px] text-slate-700 cursor-pointer"
                  value={selectedGroup}
                  onChange={(e) => { setSelectedGroup(e.target.value); setCurrentPage(1); }}
                >
                  {groupsForFilter.map(g => <option key={g} value={g}>{g === 'All' ? 'All Folders' : g}</option>)}
                </select>
                <button 
                  onClick={() => setIsManagerModalOpen(true)}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 hover:text-indigo-600 transition-all"
                  title="Manage Groups"
                >
                  <Settings2 size={18} />
                </button>
              </div>

              <select 
                className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-slate-700 cursor-pointer"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                {Object.values(SortOption).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-slate-100">
            <button onClick={validateStreams} disabled={isProcessing || items.length === 0} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
              <ShieldCheck size={14} /> Validate
            </button>
            <button onClick={runAICleanup} disabled={isProcessing || items.length === 0} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 disabled:opacity-50 transition-colors">
              <Sparkles size={14} /> AI Cleanup
            </button>
            <button onClick={runAICategorize} disabled={isProcessing || items.length === 0} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 disabled:opacity-50 transition-colors">
              <LayoutGrid size={14} /> AI Grouping
            </button>
            <div className="flex-1"></div>
            {selectedItems.size > 0 && (
                <button onClick={() => {
                  const targets = Array.from(selectedItems);
                  setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                  setSelectedItems(new Set());
                  showToast(`Removed ${targets.length} items`);
                }} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 transition-colors">
                    <Trash2 size={14} /> Delete Selected ({selectedItems.size})
                </button>
            )}
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 w-10 text-center">
                      <input 
                          type="checkbox" 
                          className="rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                          checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                          onChange={() => {
                              if (selectedItems.size === filteredItems.length) setSelectedItems(new Set());
                              else setSelectedItems(new Set(filteredItems.map(i => i.id)));
                          }}
                      />
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Stream Info</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Group</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length > 0 ? paginatedItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${selectedItems.has(item.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      <input 
                          type="checkbox" 
                          checked={selectedItems.has(item.id)} 
                          onChange={() => toggleSelection(item.id)}
                          className="rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {item.logo ? (
                          <img src={item.logo} alt="" className="w-12 h-12 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1.5 shadow-sm" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                            {item.category === 'TV' ? <Tv size={24} /> : item.category === 'Movie' ? <Film size={24} /> : <PlayCircle size={24} />}
                          </div>
                        )}
                        <div className="max-w-md overflow-hidden">
                          <p className="font-bold text-sm text-slate-900 truncate" title={item.name}>{item.name}</p>
                          <p className="text-[10px] text-slate-400 truncate font-mono mt-1" title={item.url}>{item.url}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                            {item.category === 'TV' && <Tv size={14} className="text-indigo-500" />}
                            {item.category === 'Movie' && <Film size={14} className="text-rose-500" />}
                            {item.category === 'Series' && <PlayCircle size={14} className="text-amber-500" />}
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">{item.category}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        {item.group}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'online' && <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={14} /> Online</div>}
                      {item.status === 'offline' && <div className="flex items-center gap-1.5 text-rose-600 text-[10px] font-black uppercase tracking-widest"><XCircle size={14} /> Offline</div>}
                      {item.status === 'unknown' && <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest"><AlertCircle size={14} /> Unknown</div>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === item.id ? null : item.id);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {activeMenuId === item.id && (
                          <div 
                            className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl border border-slate-100 z-50 py-1 animate-in fade-in zoom-in duration-100 origin-top-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={(e) => { e.stopPropagation(); openGroupModal('move', item.id); }} 
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium"
                            >
                              <Move size={14} /> Move to Group
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); openGroupModal('copy', item.id); }} 
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium"
                            >
                              <Copy size={14} /> Copy to Group
                            </button>
                            <div className="h-px bg-slate-100 my-1"></div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setItems(prev => prev.filter(i => i.id !== item.id)); setActiveMenuId(null); }} 
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium"
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                          <div className="bg-slate-100 p-8 rounded-full">
                              {activeTab === 'TV' ? <Tv className="text-slate-400 w-12 h-12" /> : activeTab === 'Movie' ? <Film className="text-slate-400 w-12 h-12" /> : activeTab === 'Series' ? <PlayCircle className="text-slate-400 w-12 h-12" /> : <Grid3X3 className="text-slate-400 w-12 h-12" />}
                          </div>
                          <div>
                            <p className="text-slate-600 font-black text-xl">No {activeTab === 'All' ? 'Content' : activeTab} found</p>
                            <p className="text-slate-400 text-sm mt-1 font-medium">Import a playlist or change filters to see streams.</p>
                          </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-6 bg-slate-50/50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-500 font-medium">
                Displaying <span className="font-bold text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="font-bold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}</span> of{' '}
                <span className="font-bold text-slate-900">{filteredItems.length.toLocaleString()}</span> items
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors shadow-sm"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2 font-bold text-sm">
                  Page <input 
                    type="number" 
                    value={currentPage} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0 && val <= totalPages) setCurrentPage(val);
                    }}
                    className="w-14 text-center border border-slate-200 rounded-lg py-1.5 mx-1 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  /> of {totalPages}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2.5 rounded-2xl">
                  <FileUp className="text-indigo-600" size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Import Playlist</h3>
                  <p className="text-slate-500 text-sm font-medium mt-0.5">Select your preferred import method</p>
                </div>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
                <X size={28} />
              </button>
            </div>

            <div className="p-10 space-y-8">
              {/* Tabs */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button 
                  onClick={() => setImportMethod('file')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${importMethod === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <UploadCloud size={18} /> Local File
                </button>
                <button 
                  onClick={() => setImportMethod('url')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${importMethod === 'url' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Globe size={18} /> From URL
                </button>
                <button 
                  onClick={() => setImportMethod('xtream')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${importMethod === 'xtream' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Database size={18} /> Xtream API
                </button>
              </div>

              {/* Tab Content */}
              <div className="min-h-[240px] flex flex-col justify-center">
                {importMethod === 'file' && (
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e); }}
                    className={`relative border-2 border-dashed rounded-[2rem] p-12 transition-all flex flex-col items-center justify-center gap-4 text-center cursor-pointer group ${isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    <input id="file-input" type="file" className="hidden" accept=".m3u,.m3u8" onChange={handleFileUpload} />
                    <div className={`p-6 rounded-full transition-all ${isDragging ? 'bg-indigo-600 text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                      <UploadCloud size={48} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 tracking-tight">Drag & drop your M3U file</p>
                      <p className="text-slate-500 font-medium text-sm mt-1">or click to browse your local storage</p>
                    </div>
                    <div className="px-4 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest mt-2">.m3u, .m3u8 files only</div>
                  </div>
                )}

                {importMethod === 'url' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Playlist URL</label>
                      <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
                        <Globe className="ml-3 text-slate-400" size={20} />
                        <input 
                          type="url" 
                          placeholder="http://example.com/playlist.m3u" 
                          className="w-full bg-transparent border-none py-3 pr-4 text-sm font-bold outline-none"
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleUrlImport}
                      disabled={!importUrl.trim()}
                      className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={20} /> Import from URL
                    </button>
                    <p className="text-xs text-slate-400 text-center font-medium">Note: CORS must be enabled on the remote server to fetch directly.</p>
                  </div>
                )}

                {importMethod === 'xtream' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Host URL</label>
                        <input 
                          type="text" 
                          placeholder="http://provider.link:8080" 
                          className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                          value={xtreamData.host}
                          onChange={(e) => setXtreamData({...xtreamData, host: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username</label>
                        <input 
                          type="text" 
                          placeholder="Username" 
                          className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                          value={xtreamData.user}
                          onChange={(e) => setXtreamData({...xtreamData, user: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                          value={xtreamData.pass}
                          onChange={(e) => setXtreamData({...xtreamData, pass: e.target.value})}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleXtreamImport}
                      className="w-full py-4 mt-2 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Database size={20} /> Connect & Import
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="px-8 py-3 rounded-2xl text-sm font-black text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-rose-600 text-white border-rose-400'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <span className="text-sm font-bold tracking-tight">{toast.message}</span>
        </div>
      )}

      {/* Group Action Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight capitalize">{modalMode} to Group</h3>
                <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">Target: {itemsToProcess.length} item(s)</p>
              </div>
              <button onClick={() => setIsGroupModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8">
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 block">New Group Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Plus size={18} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Type a new group name..."
                      className="w-full bg-slate-100 border-none rounded-2xl py-3.5 pl-11 pr-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                      value={targetGroupInput}
                      onChange={(e) => { setTargetGroupInput(e.target.value); setGroupModalSelection(null); }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 block">Or Choose Existing</label>
                  <div className="max-h-60 overflow-y-auto pr-2 flex flex-wrap gap-2">
                    {allGroups.map(group => (
                      <button 
                        key={group}
                        onClick={() => { setGroupModalSelection(group); setTargetGroupInput(''); }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${groupModalSelection === group ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button 
                onClick={() => setIsGroupModalOpen(false)}
                className="flex-1 px-6 py-3 rounded-2xl text-sm font-black text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={!targetGroupInput && !groupModalSelection}
                onClick={() => handleGroupAction(targetGroupInput || groupModalSelection!)}
                className="flex-1 px-6 py-3 rounded-2xl text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
              >
                Confirm {modalMode}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Manager Modal */}
      {isManagerModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2.5 rounded-2xl">
                  <Settings2 className="text-indigo-600" size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Group Manager</h3>
                  <p className="text-slate-500 text-sm font-medium mt-0.5">Manage, Create or Organize folders</p>
                </div>
              </div>
              <button onClick={() => { setIsManagerModalOpen(false); setGroupSearch(''); }} className="p-3 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
                <X size={28} />
              </button>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto">
              <div className="flex flex-col md:flex-row gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
                <div className="flex-1 space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Create New Folder</label>
                   <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                    <input 
                      type="text" 
                      placeholder="Folder name..."
                      className="flex-1 bg-transparent border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createGroup()}
                    />
                    <button 
                      onClick={createGroup}
                      disabled={!newGroupName.trim()}
                      className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      <FolderPlus size={18} />
                    </button>
                   </div>
                </div>
                <div className="flex-1 space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Folders</label>
                   <div className="relative group flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                    <Search className="ml-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder="Filter groups..."
                      className="w-full bg-transparent border-none rounded-xl px-3 py-2 text-sm font-bold outline-none"
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                    />
                   </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">Managed Folders ({managedGroups.length})</label>
                <div className="space-y-3">
                  {managedGroups.length > 0 ? managedGroups.map(group => (
                    <div key={group} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-200 hover:bg-white hover:shadow-md transition-all">
                      <div 
                        className={`flex-1 mr-4 ${editingGroup !== group ? 'cursor-pointer group/name' : ''}`}
                        onClick={() => editingGroup !== group && selectGroupAndClose(group)}
                      >
                        {editingGroup === group ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input 
                              autoFocus
                              className="bg-white border-2 border-indigo-500 rounded-xl px-4 py-2 text-sm font-bold w-full outline-none"
                              value={editGroupValue}
                              onChange={(e) => setEditGroupValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') renameGroup(group, editGroupValue);
                                if (e.key === 'Escape') setEditingGroup(null);
                              }}
                            />
                            <button onClick={() => renameGroup(group, editGroupValue)} className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                              <Save size={18} />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="font-black text-slate-900 group-hover/name:text-indigo-600 transition-colors flex items-center gap-2">
                              {group}
                              <ChevronRight size={14} className="opacity-0 group-hover/name:opacity-100 transition-all -translate-x-1 group-hover/name:translate-x-0" />
                            </p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{groupStats[group]} items inside</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => { setEditingGroup(group); setEditGroupValue(group); }}
                          className="p-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                        >
                          <Pencil size={20} />
                        </button>
                        <button 
                          onClick={() => deleteGroup(group)}
                          className="p-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold">No groups matching "{groupSearch}"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">{allGroups.length} Folders total</p>
              <button 
                onClick={() => { setIsManagerModalOpen(false); setGroupSearch(''); }}
                className="px-8 py-3 rounded-2xl text-sm font-black bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Processing Overlay */}
      {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-lg z-50 flex items-center justify-center p-6">
              <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-8 max-w-md text-center border border-white/20">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-slate-100 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-24 h-24 border-8 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 w-10 h-10 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{loadingMessage || 'Processing...'}</h3>
                  <p className="text-slate-500 text-sm mt-3 leading-relaxed font-medium">
                    Please wait while we process your playlist and organize your content.
                  </p>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full w-1/2 animate-[loading_1.5s_ease-in-out_infinite]"></div>
                </div>
              </div>
          </div>
      )}

      {/* Floating Selection Bar */}
      {selectedItems.size > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-10 py-5 rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.4)] border border-slate-700/50 flex items-center gap-10 animate-in slide-in-from-bottom-10 duration-500 ease-out">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-2 rounded-xl">
                  <Check size={20} className="text-white" />
                </div>
                <span className="text-base font-black tracking-tight">{selectedItems.size.toLocaleString()} Selected</span>
              </div>
              <div className="h-8 w-px bg-slate-700"></div>
              <div className="flex items-center gap-6">
                <button onClick={() => openGroupModal('move')} className="flex items-center gap-2 text-xs font-black hover:text-indigo-400 transition-all uppercase tracking-widest active:scale-95">
                  <Move size={14} /> Move
                </button>
                <button onClick={() => openGroupModal('copy')} className="flex items-center gap-2 text-xs font-black hover:text-indigo-400 transition-all uppercase tracking-widest active:scale-95">
                  <Copy size={14} /> Copy
                </button>
                <button onClick={() => {
                  const targets = Array.from(selectedItems);
                  setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                  setSelectedItems(new Set());
                  showToast(`Removed ${targets.length} items`);
                }} className="flex items-center gap-2 text-xs font-black text-rose-500 hover:text-rose-400 transition-all uppercase tracking-widest active:scale-95">
                  <Trash2 size={14} /> Remove
                </button>
                <button onClick={() => setSelectedItems(new Set())} className="text-xs font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest active:scale-95">Cancel</button>
              </div>
          </div>
      )}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
};

export default App;
