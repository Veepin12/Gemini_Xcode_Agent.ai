/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, ArrowUp, Loader2, Copy, Check, ChevronDown, X, Menu, Trash2, Plus, LogOut, Search, Sun, Moon } from 'lucide-react';
import { MarkdownOutput } from './components/MarkdownOutput';

function CopyButton({ textToCopy }: { textToCopy: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md flex items-center justify-center transition-colors bg-[#1c1c1f] border border-[#2d2d30] text-[#a1a1aa] hover:bg-[#2d2d30] hover:text-[#e4e4e7]"
      title="Copy to clipboard"
    >
      {isCopied ? <Check size={14} className="text-[#10b981]" /> : <Copy size={14} />}
    </button>
  );
}

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('xcode_current_user');
  });
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Custom states for theme and workspace searching
  const [lightMode, setLightMode] = useState<boolean>(() => {
    return localStorage.getItem('xcode_light_mode') === 'true';
  });
  const [searchQuery, setSearchQuery] = useState('');

  const toggleLightMode = () => {
    const nextMode = !lightMode;
    setLightMode(nextMode);
    localStorage.setItem('xcode_light_mode', String(nextMode));
  };

  // App core states
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  
  // User-namespaced conversations list
  const [conversations, setConversations] = useState<any[]>([
    {
      id: 'initial',
      title: 'New Chat',
      timestamp: Date.now(),
      messages: []
    }
  ]);

  const [activeId, setActiveId] = useState<string>('initial');

  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const loadedUserRef = useRef<string | null>(currentUser);
  const [mode, setMode] = useState('ask');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  
  // Model selector dropdown and generation timer states
  const [selectedModel, setSelectedModel] = useState<'v1.0' | 'v1.1' | 'Beta'>(() => {
    return (localStorage.getItem('xcode_selected_model') as any) || 'v1.0';
  });
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('xcode_selected_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl / Meta is pressed, but not Shift or Alt
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setSelectedModel('v1.0');
          setActiveToast('Switched to Xcode Agent v1.0 (Gemini 2.5 Flash)');
        } else if (e.key === '2') {
          e.preventDefault();
          setSelectedModel('v1.1');
          setActiveToast('Switched to Xcode Agent v1.1 (Gemini 2.5 Pro)');
        } else if (e.key === '3') {
          e.preventDefault();
          setSelectedModel('Beta');
          setActiveToast('Switched to Xcode Agent Beta (Experimental Flash)');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  useEffect(() => {
    let intervalId: any = null;
    if (isGenerating) {
      setGenerationSeconds(0);
      const startTime = Date.now();
      intervalId = setInterval(() => {
        const diff = (Date.now() - startTime) / 1000;
        setGenerationSeconds(diff);
      }, 100);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isGenerating]);

  // Dynamic style parameters mapped for high contrast consistency
  const theme = {
    bgMain: lightMode ? 'bg-[#f4f4f5]' : 'bg-[#09090b]',
    bgSidebar: lightMode ? 'bg-[#fafafa]' : 'bg-[#141416]',
    borderSidebar: lightMode ? 'border-zinc-200' : 'border-[#2d2d30]',
    textPrimary: lightMode ? 'text-[#09090b]' : 'text-[#e4e4e7]',
    textSecondary: lightMode ? 'text-zinc-500' : 'text-[#a1a1aa]',
    border: lightMode ? 'border-zinc-200' : 'border-[#2d2d30]',
    bgCard: lightMode ? 'bg-white shadow-sm border border-zinc-200' : 'bg-[#1c1c1f] border border-[#2d2d30]',
    bgActiveConv: lightMode ? 'text-[#09090b] bg-zinc-200/90 shadow-sm font-semibold border-l-[3px] border-[#10b981]' : 'text-white bg-[#3f3f46] shadow-sm font-medium border-l-[3px] border-[#10b981]',
    bgHoverConv: lightMode ? 'hover:bg-zinc-200/50' : 'hover:bg-[#3f3f46]/30',
    bgViewport: lightMode ? 'bg-white' : 'bg-[#09090b]',
    bgInput: lightMode ? 'bg-zinc-50' : 'bg-[#1c1c1f]',
    bgModal: lightMode ? 'bg-white' : 'bg-[#141416]',
    divider: lightMode ? 'border-zinc-200' : 'border-[#2d2d30]/60',
    borderInput: lightMode ? 'border-zinc-200' : 'border-[#2d2d30]',
    focusInput: lightMode ? 'focus-within:border-zinc-400 focus-within:ring-zinc-300' : 'focus-within:border-[#3f3f46]',
    textPlaceholder: lightMode ? 'placeholder-zinc-450' : 'placeholder-[#a1a1aa]',
    btnSecondary: lightMode ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200' : 'bg-[#1c1c1f] hover:bg-[#2d2d30] text-[#e4e4e7] border border-[#2d2d30]',
    btnSend: lightMode ? 'bg-zinc-900 hover:bg-black text-white' : 'bg-[#e4e4e7] text-[#09090b] hover:bg-white',
    chatUserBg: lightMode ? 'bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-[18px_18px_2px_18px]' : 'bg-[#3f3f46] text-[#e4e4e7] rounded-[18px_18px_2px_18px]',
    topBarBg: lightMode ? 'bg-white/90 border-zinc-200' : 'bg-[#09090b]/80 border-[#2d2d30]',
    badgeBg: lightMode ? 'bg-zinc-100 border-zinc-200' : 'bg-[#1c1c1f] border-[#2d2d30]/80',
    badgeText: lightMode ? 'text-zinc-600' : 'text-[#a1a1aa]',
    authBg: lightMode ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-[#141416] border-[#2d2d30] text-[#e4e4e7]',
    authInputBg: lightMode ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-[#09090b] border-[#2d2d30] text-[#e4e4e7]',
    authLabel: lightMode ? 'text-zinc-500' : 'text-[#a1a1aa]',
    authModalBorder: lightMode ? 'from-transparent via-zinc-300 to-transparent' : 'from-transparent via-[#3f3f46] to-transparent'
  };

  // Computes sidebar item list matching search query strings
  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Synchronize dynamic conversations list from the database when the user changes
  useEffect(() => {
    if (!currentUser) {
      loadedUserRef.current = null;
      return;
    }
    
    const fetchConversations = async () => {
      try {
        const res = await fetch(`/api/conversations?email=${encodeURIComponent(currentUser)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setConversations(data);
            setActiveId(data[0].id);
          } else {
            const welcomeConv = [
              {
                id: 'initial',
                title: 'New Chat',
                timestamp: Date.now(),
                messages: []
              }
            ];
            setConversations(welcomeConv);
            setActiveId('initial');
          }
        }
      } catch (e) {
        console.error('Error loading conversations:', e);
      } finally {
        loadedUserRef.current = currentUser;
      }
    };

    fetchConversations();
  }, [currentUser]);

  // Persistent background sync to MongoDB database
  useEffect(() => {
    if (!currentUser || loadedUserRef.current !== currentUser) {
      return;
    }

    const activeConv = conversations.find(c => c.id === activeId);
    if (!activeConv) return;

    const delayDebounceFn = setTimeout(async () => {
      try {
        await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentUser,
            conversation: activeConv
          })
        });
      } catch (err) {
        console.error('Failed to sync conversation with database:', err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [conversations, activeId, currentUser]);

  // Clean title generation
  const generateShortTitle = (message: string): string => {
    const cleanText = message
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/[^\w\s-]/g, '') // remove symbols
      .trim();
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 'New Chat';
    const limit = Math.min(words.length, 4);
    const titleWords = words.slice(0, limit).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return titleWords.join(' ') + (words.length > limit ? '...' : '');
  };

  const handleNewConversation = () => {
    const newId = Date.now().toString();
    const newConv = {
      id: newId,
      title: 'New Chat',
      timestamp: Date.now(),
      messages: []
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newId);
    setTranscript('');
    if (isGenerating) {
      handleStop();
    }
  };

  const handleDeleteConversation = async (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (currentUser) {
      try {
        await fetch(`/api/conversations/${idToDelete}?email=${encodeURIComponent(currentUser)}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.error('Failed to delete conversation from database:', err);
      }
    }

    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== idToDelete);
      if (activeId === idToDelete) {
        if (filtered.length > 0) {
          setActiveId(filtered[0].id);
        } else {
          const freshId = Date.now().toString();
          const freshConv = {
            id: freshId,
            title: 'New Chat',
            timestamp: Date.now(),
            messages: []
          };
          setActiveId(freshId);
          return [freshConv];
        }
      }
      return filtered;
    });
  };

  const handleClearConversation = () => {
    setConversations(prev => {
      return prev.map(c => {
        if (c.id === activeId) {
          return {
            ...c,
            title: 'New Chat',
            messages: []
          };
        }
        return c;
      });
    });
    setTranscript('');
    if (isGenerating) {
      handleStop();
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const email = authEmail.trim();
    const password = authPassword;

    if (!email || !password) {
      setAuthError('Please fill in all credentials.');
      return;
    }

    try {
      const endpoint = authMode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }

      localStorage.setItem('xcode_current_user', data.email);
      setCurrentUser(data.email);
    } catch (err: any) {
      console.error(err);
      setAuthError('Failed to connect to authentication server.');
    }
  };

  const handleDemoLogin = () => {
    const demoEmail = 'developer@xcode.dev';
    localStorage.setItem('xcode_current_user', demoEmail);
    setCurrentUser(demoEmail);
  };

  const handleLogout = () => {
    localStorage.removeItem('xcode_current_user');
    setCurrentUser(null);
    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
  };

  // Get current active conversation
  const activeConversation = conversations.find(c => c.id === activeId) || conversations[0];
  const messages = activeConversation?.messages || [];

  // Estimate the session tokens based on active messages content
  const estimatedTokens = messages.reduce((acc, m) => {
    const contentLen = m.content ? m.content.length : 0;
    return acc + Math.ceil(contentLen / 4) + 12;
  }, 0);

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return `${tokens}`;
  };

  // Scroll to bottom on updates
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Load API keys
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    setIsSettingsOpen(false);
  };

  // Audio recording initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => {
            const separator = prev && !prev.endsWith(' ') ? ' ' : '';
            return prev + separator + finalTranscript;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
        if (event.error === 'service-not-allowed') {
          setSpeechError("The speech recognition service is not allowed. In modern browsers, this can happen if the microphone is blocked, if Google Chrome quotas are exceeded, or if the page runs inside a sandboxed frame. Consider opening this app in a new tab using the link icon, or check your browser credentials/settings.");
        } else if (event.error === 'not-allowed') {
          setSpeechError("Microphone access is blocked. Please allow microphone access in your browser site permissions to use voice typing.");
        } else if (event.error === 'no-speech') {
          setSpeechError("No speech was detected. Please check your microphone connection and speak directly into it.");
        } else if (event.error === 'network') {
          setSpeechError("A network error occurred. Please verify your internet connection.");
        } else {
          setSpeechError(`Speech recognition helper failed with code: ${event.error}. Please make sure you have allowed microphone access.`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    setSpeechError(null);
    if (!recognitionRef.current) {
      setSpeechError("Speech recognition is not fully supported or allowed in this browser session. Please try running in Google Chrome or verify microphone site permissions.");
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Could not start recording', e);
        setSpeechError("Initialization error: Could not start voice capture. Please check microphone settings.");
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!transcript.trim() || isGenerating || !activeId) return;
    
    const newUserMsg = transcript;
    setTranscript('');
    const newMessages = [...messages, { id: Date.now().toString(), role: 'user', content: newUserMsg }];
    
    // Add prompt immediately and compute title
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        const isFirst = c.messages.filter(m => m.role === 'user').length === 0;
        const newTitle = isFirst ? generateShortTitle(newUserMsg) : c.title;
        return {
          ...c,
          title: newTitle,
          messages: newMessages
        };
      }
      return c;
    }));
    
    setIsGenerating(true);
    isGeneratingRef.current = true;
    
    const searchMsgId = (Date.now() + 1).toString();

    // Add assistant message with scanning status immediately
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        return {
          ...c,
          messages: [...newMessages, {
            id: searchMsgId,
            role: 'assistant',
            isSearching: true,
            content: ''
          }]
        };
      }
      return c;
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, mode, apiKey, model: selectedModel })
      });
      
      if (!response.ok) {
        let errMessage = 'An error occurred during content generation.';
        try {
          const data = await response.json();
          errMessage = data.error || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error("No response body available representing the generator stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        if (!isGeneratingRef.current) {
          try { reader.cancel(); } catch (_) {}
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                accumulatedText += parsed.text;

                if (!isGeneratingRef.current) break;

                setConversations(prev => prev.map(c => {
                  if (c.id === activeId) {
                    return {
                      ...c,
                      messages: c.messages.map(m => m.id === searchMsgId ? {
                        ...m,
                        isSearching: false,
                        content: accumulatedText
                      } : m)
                    };
                  }
                  return c;
                }));
              }
            } catch (errParsing) {
              console.error('SSE parser error:', errParsing);
            }
          }
        }
      }

      if (isGeneratingRef.current) {
        setIsGenerating(false);
        isGeneratingRef.current = false;
        
        // Final state cleanup (ensure searching is set to false)
        setConversations(prev => prev.map(c => {
          if (c.id === activeId) {
            return {
              ...c,
              messages: c.messages.map(m => m.id === searchMsgId ? {
                ...m,
                isSearching: false
              } : m)
            };
          }
          return c;
        }));
      }
    } catch (err: any) {
      if (!isGeneratingRef.current) return;
      setIsGenerating(false);
      isGeneratingRef.current = false;
      setConversations(prev => prev.map(c => {
        if (c.id === activeId) {
          return {
            ...c,
            messages: c.messages.map(m => m.id === searchMsgId ? {
              ...m,
              isSearching: false,
              content: `Error: ${err.message}`
            } : m)
          };
        }
        return c;
      }));
    }
  };

  const handleStop = () => {
    setIsGenerating(false);
    isGeneratingRef.current = false;
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        return {
          ...c,
          messages: c.messages.map(m => m.isSearching ? {
            ...m,
            isSearching: false,
            content: 'Request cancelled.'
          } : m)
        };
      }
      return c;
    }));
  };

  // Render Authentication Gate if user is not logged in
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 relative font-sans text-[#e4e4e7] overflow-y-auto">
        {/* Decorative ambient gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#18181b] via-[#09090b] to-[#09090b] opacity-80 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>

        <div className="w-full max-w-[420px] bg-[#141416] border border-[#2d2d30] rounded-2xl shadow-2xl p-8 z-10 box-border flex flex-col relative overflow-hidden backdrop-blur-sm self-center">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#3f3f46] to-transparent"></div>
          
          <div className="flex flex-col items-center mb-8 select-none">
            <div className="w-10 h-10 rounded-xl bg-[#1c1c1f] border border-[#2d2d30] flex items-center justify-center mb-4 text-[#10b981] shadow-inner">
              <div className="w-3 h-3 rounded-full bg-current animate-pulse"></div>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mb-1">Xcode Agent 1.0</h1>
            <p className="text-[#a1a1aa] text-[13px] font-medium font-mono">Calibrated Autonomous Suite</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
            {authError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[13px] text-red-400 font-medium leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                {authError}
              </div>
            )}

            <div>
              <label className="block text-[12px] text-[#a1a1aa] uppercase tracking-wider mb-2 font-semibold">
                Email or Username
              </label>
              <input
                type="text"
                autoFocus
                placeholder="developer@xcode.dev"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#09090b] border border-[#2d2d30] rounded-xl h-11 px-4 text-[14px] text-[#e4e4e7] placeholder-[#52525b] focus:outline-none focus:border-[#3f3f46] focus:ring-1 focus:ring-[#3f3f46] transition-all"
              />
            </div>

            <div>
              <label className="block text-[12px] text-[#a1a1aa] uppercase tracking-wider mb-2 font-semibold">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#09090b] border border-[#2d2d30] rounded-xl h-11 px-4 text-[14px] text-[#e4e4e7] placeholder-[#52525b] focus:outline-none focus:border-[#3f3f46] focus:ring-1 focus:ring-[#3f3f46] transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-white hover:bg-zinc-100 text-[#09090b] h-11 font-semibold rounded-xl text-[14px] transition-colors mt-2 cursor-pointer shadow-sm active:scale-98 flex items-center justify-center"
            >
              {authMode === 'signin' ? 'Sign In to Workspace' : 'Create Developer Account'}
            </button>
          </form>

          <div className="mt-5 text-center text-[13px] select-none text-[#a1a1aa]">
            {authMode === 'signin' ? (
              <span>
                New member?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className="text-white hover:underline focus:outline-none font-semibold cursor-pointer text-left bg-transparent p-0 m-0 border-0"
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                  className="text-white hover:underline focus:outline-none font-semibold cursor-pointer text-left bg-transparent p-0 m-0 border-0"
                >
                  Sign in here
                </button>
              </span>
            )}
          </div>

          <div className="relative flex py-4 items-center select-none">
            <div className="flex-grow border-t border-[#2d2d30]"></div>
            <span className="flex-shrink mx-4 text-[#52525b] text-[10px] font-mono tracking-widest uppercase">or bypass</span>
            <div className="flex-grow border-t border-[#2d2d30]"></div>
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full bg-[#1c1c1f] hover:bg-[#2d2d30] text-[#e4e4e7] hover:text-white h-11 font-medium border border-[#2d2d30] rounded-xl text-[13px] transition-all cursor-pointer shadow-inner"
          >
            Instant Developer Demo Pass
          </button>
        </div>

        <div className="mt-8 text-[11px] text-[#52525b] font-mono select-none flex gap-6 z-10">
          <span>STATUS: OPERATIONAL</span>
          <span>LATENCY: 240ms</span>
          <span>SECURE PROTOCOL</span>
        </div>
      </div>
    );
  }

  // Active Main Dashboard Workspace
  return (
    <div className={`flex w-full h-screen font-sans overflow-hidden transition-colors duration-300 ${theme.bgMain} ${theme.textPrimary}`}>
      {/* Sidebar */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-[260px] p-6 border-r' : 'w-0 p-0 border-r-0'} h-full ${theme.bgSidebar} ${theme.borderSidebar} flex flex-col shrink-0 overflow-hidden`}>
        <div className={`text-[11px] uppercase tracking-[0.1em] ${theme.textSecondary} mb-3 font-semibold shrink-0`}>
          Recent Conversations
        </div>

        {/* Clean Rounded Search Bar */}
        <div className="mb-3 shrink-0 relative">
          <input
            type="text"
            placeholder="Search chat titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full text-[13px] rounded-lg pl-8 pr-7 h-9 bg-transparent outline-none focus:ring-1 transition-all ${
              lightMode 
                ? 'bg-zinc-100 border border-zinc-200 text-[#09090b] focus:ring-zinc-300 focus:border-zinc-350 placeholder-zinc-400' 
                : 'bg-[#1c1c1f] border border-[#2d2d30] text-[#e4e4e7] focus:ring-[#3f3f46] focus:border-[#3f3f46] placeholder-zinc-500'
            }`}
          />
          <Search size={13} className="absolute left-2.5 top-2.5 text-[#a1a1aa]" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 p-0.5 rounded hover:bg-zinc-500/10 text-[#a1a1aa] hover:text-white transition-colors"
              title="Clear Search"
            >
              <X size={12} />
            </button>
          )}
        </div>
        
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
          {/* New Chat Trigger */}
          <button
            type="button"
            onClick={handleNewConversation}
            className={`w-full text-left py-2.5 px-3 rounded-lg mb-2 text-[13px] border cursor-pointer transition-all flex items-center gap-2 font-medium ${
              lightMode 
                ? 'bg-white hover:bg-zinc-100 text-[#09090b] border-zinc-200 shadow-sm'
                : 'bg-[#1c1c1f] hover:bg-[#2d2d30] text-[#e4e4e7] border border-[#2d2d30]'
            }`}
          >
            <Plus size={14} className="text-[#10b981]" />
            New Conversation
          </button>

          {filteredConversations.length === 0 ? (
            <div className={`text-[12px] text-center py-6 select-none italic ${theme.textSecondary}`}>
              {searchQuery ? 'No matching chats' : 'No active conversations'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeId;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveId(conv.id);
                    setTranscript('');
                  }}
                  className={`group py-2.5 px-3 rounded-md text-[13px] cursor-pointer transition-all flex items-center justify-between select-none ${
                    isActive
                      ? theme.bgActiveConv
                      : `${theme.textSecondary} ${theme.bgHoverConv}`
                  }`}
                  title={conv.title}
                >
                  <span className="truncate pr-2 flex-1">{conv.title}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-400 text-[#a1a1aa] transition-all focus:outline-none"
                    title="Delete Chat"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
        
        <div className={`mt-auto pt-6 border-t shrink-0 flex flex-col gap-1 ${theme.divider}`}>
          <div className={`text-[11px] uppercase tracking-[0.1em] ${theme.textSecondary} mb-2 font-semibold`}>
            System
          </div>
          <button 
            type="button"
            onClick={handleClearConversation}
            className={`w-full text-left py-2 px-3 rounded-md text-[12px] cursor-pointer transition-all flex items-center gap-2 font-medium ${
              lightMode ? 'text-red-600 hover:bg-red-500/10' : 'text-red-400 hover:bg-red-500/10'
            }`}
          >
            <Trash2 size={13} className="opacity-70" />
            Clear Current Chat
          </button>
          <button 
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`w-full text-left py-2 px-3 rounded-md text-[12px] cursor-pointer transition-all ${theme.textSecondary} ${theme.bgHoverConv}`}
          >
            Settings
          </button>
          
          {/* User Profile Badge */}
          <div className={`mt-3 p-2.5 rounded-lg border flex items-center justify-between text-[12px] transition-colors duration-300 ${theme.badgeBg}`}>
            <div className="truncate pr-1 flex flex-col min-w-0">
              <span className={`truncate font-medium ${theme.textPrimary}`}>{currentUser}</span>
              <span className={`text-[10px] font-mono truncate ${theme.textSecondary}`}>ID: {currentUser === 'developer@xcode.dev' ? 'EXPERT_DEMO' : 'DEV_ACCNT'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-red-500/15 hover:text-red-400 text-[#a1a1aa] transition-colors focus:outline-none"
              title="Logout from Suite"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 h-full flex flex-col relative overflow-hidden">
        {activeToast && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 p-3 px-5 rounded-xl border font-mono text-[12.5px] font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-2.5 ${
            lightMode 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]'
          }`}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
            {activeToast}
          </div>
        )}

        {/* Top Bar */}
        <div className={`h-16 border-b flex items-center justify-between px-8 shrink-0 backdrop-blur-md z-10 transition-colors duration-300 ${theme.topBarBg}`}>
          <div className={`text-[14px] font-medium flex items-center gap-4 ${theme.textPrimary}`}>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-[#3f3f46] cursor-pointer ${theme.textSecondary} ${theme.bgHoverConv}`}
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <Menu size={18} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-[13px] font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-[#10b981]/40 cursor-pointer ${
                  lightMode 
                    ? 'bg-zinc-100/90 hover:bg-zinc-200 text-zinc-900 border-zinc-200' 
                    : 'bg-[#18181b] hover:bg-[#27272a] text-[#e4e4e7] border-[#2d2d30]'
                }`}
                title="Select Agent Engine Version (Ctrl+1, Ctrl+2, Ctrl+3)"
              >
                <div className={`w-2 h-2 rounded-full animate-pulse transition-colors duration-300 ${
                  selectedModel === 'v1.0' ? 'bg-[#10b981]' : selectedModel === 'v1.1' ? 'bg-[#3b82f6]' : 'bg-[#a855f7]'
                }`}></div>
                <span>Xcode Agent {selectedModel}</span>
                <ChevronDown size={13} className="text-[#a1a1aa]" />
              </button>

              {isModelSelectOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsModelSelectOpen(false)}></div>
                  <div className={`absolute top-full mt-2 left-0 w-[270px] border rounded-xl shadow-xl overflow-hidden z-20 flex flex-col p-1.5 ${theme.bgModal} ${theme.border}`}>
                    <div className="px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-bold text-zinc-500 select-none flex justify-between items-center">
                      <span>Agent Engine Version</span>
                      <span className="text-[8.5px] opacity-60 font-mono">Shortcuts Active</span>
                    </div>
                    {[
                      { 
                        id: 'v1.0', 
                        label: 'Xcode Agent v1.0', 
                        desc: 'Gemini 2.5 Flash', 
                        dotColor: 'bg-[#10b981]', 
                        status: 'Stable', 
                        latency: '< 0.8s', 
                        shortcut: 'Ctrl+1' 
                      },
                      { 
                        id: 'v1.1', 
                        label: 'Xcode Agent v1.1', 
                        desc: 'Gemini 2.5 Pro', 
                        dotColor: 'bg-[#3b82f6]', 
                        status: 'High IQ', 
                        latency: '< 2.5s', 
                        shortcut: 'Ctrl+2' 
                      },
                      { 
                        id: 'Beta', 
                        label: 'Xcode Agent Beta', 
                        desc: 'Experimental Flash (2.5)', 
                        dotColor: 'bg-[#a855f7]', 
                        status: 'Bleeding edge', 
                        latency: '< 1.1s', 
                        shortcut: 'Ctrl+3' 
                      }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.id as any);
                          setIsModelSelectOpen(false);
                        }}
                        className={`text-left w-full px-3 py-2 rounded-lg transition-colors flex flex-col gap-0.5 mt-0.5 ${
                          selectedModel === m.id 
                            ? (lightMode ? 'bg-zinc-100 text-zinc-950 font-bold' : 'bg-[#27272a] text-[#ffffff] font-bold') 
                            : (lightMode ? 'hover:bg-zinc-50 text-zinc-700' : 'hover:bg-[#19191b] text-[#a1a1aa]')
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${m.dotColor}`}></span>
                            <span className="text-[12px] font-semibold">{m.label}</span>
                          </div>
                          <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono select-none ${
                            lightMode 
                              ? 'bg-zinc-200/60 text-zinc-500 border border-zinc-300/30' 
                              : 'bg-zinc-800 text-[#a1a1aa] border border-zinc-700/30'
                          }`}>
                            {m.shortcut}
                          </kbd>
                        </div>
                        <span className="text-[10px] pl-3.5 opacity-70 font-mono">{m.desc}</span>
                        <div className="flex items-center gap-1.5 pl-3.5 mt-1 text-[9px] font-medium opacity-80">
                          <span className={`px-1 py-0.5 rounded font-mono text-[8px] font-bold uppercase ${
                            m.id === 'v1.0' 
                              ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15' 
                              : m.id === 'v1.1' 
                                ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/15' 
                                : 'bg-purple-500/10 text-purple-500 dark:bg-purple-500/15'
                          }`}>
                            {m.status}
                          </span>
                          <span className="opacity-40">•</span>
                          <span className="font-mono text-zinc-400">{m.latency} lat</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className={`text-[12px] font-mono ${theme.textSecondary}`}>
            Calibrated: High Confidence
          </div>
        </div>

        {/* Chat Viewport */}
        <div ref={viewportRef} className={`flex-1 p-[40px_60px] flex flex-col gap-8 overflow-y-auto transition-colors duration-300 ${theme.bgViewport}`}>
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 my-auto">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300 text-[#10b981] ${theme.bgCard}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-current animate-pulse"></div>
              </div>
              <h3 className={`font-semibold text-[16px] mb-1 ${theme.textPrimary}`}>New Conversation</h3>
              <p className={`text-[13px] max-w-[320px] leading-relaxed select-none ${theme.textSecondary}`}>
                Clear and ready. Ask Xcode Agent any query, or switch modes to plan your architectural layouts.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              msg.role === 'user' ? (
                <div key={msg.id} className="flex flex-col items-end">
                  <div className={`p-[12px_20px] text-[15px] max-w-[80%] shadow-sm ${theme.chatUserBg}`}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col gap-4">
                  {msg.isSearching && !msg.content ? (
                    <div className="flex flex-col gap-1.5 p-1 rounded-xl">
                      <span className={`text-[13.5px] font-mono select-none ${theme.textSecondary} animate-pulse`}>
                        Extracting local context and starting thread...
                      </span>
                    </div>
                  ) : (
                    <MarkdownOutput content={msg.content} lightMode={lightMode} />
                  )}

                  {/* Claude/Gemini style persistent loading indicator during active streaming */}
                  {idx === messages.length - 1 && isGenerating && (
                    <div className={`flex items-center gap-2.5 p-2 px-4 rounded-full border w-fit font-mono text-[12px] shadow-sm animate-pulse select-none transition-all duration-300 ${
                      lightMode 
                        ? 'bg-zinc-100/90 border-zinc-200 text-zinc-700' 
                        : 'bg-[#18181b]/80 border-[#2d2d30] text-[#a1a1aa]'
                    }`}>
                      <div className="relative flex items-center justify-center w-4 h-4">
                        {/* Spinning dashed ring and glowing center sparkle */}
                        <span className="absolute inset-0 rounded-full border-2 border-dashed border-[#10b981] animate-[spin_3s_linear_infinite]" />
                        <span className="w-1 h-1 rounded-full bg-[#10b981] animate-ping absolute" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] absolute" />
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className={lightMode ? 'text-zinc-900 font-semibold' : 'text-zinc-200 font-semibold'}>
                          {selectedModel === 'v1.0' ? 'Gemini 2.5 Flash' : selectedModel === 'v1.1' ? 'Gemini 2.5 Pro' : 'Gemini 2.5 Flash Beta'}
                        </span>
                        <span className="opacity-40">•</span>
                        <span className="text-[#10b981] font-mono font-bold tracking-wide">
                          {generationSeconds.toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            ))
          )}
        </div>

        {/* Input Container */}
        <div className="p-[24px_60px_40px] flex flex-col gap-3 shrink-0 relative">
          {speechError && (
            <div className={`p-3 px-4 rounded-lg flex items-start gap-3 text-[12.5px] border leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              lightMode 
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : 'bg-amber-950/40 border-amber-900/50 text-amber-300'
            }`}>
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Microphone Notice</span>
                {speechError}
              </div>
              <button 
                type="button"
                onClick={() => setSpeechError(null)}
                className={`p-1 rounded transition-colors -mr-1 -mt-1 ${
                  lightMode ? 'hover:bg-amber-200 text-amber-700' : 'hover:bg-amber-950 text-amber-400'
                }`}
                title="Dismiss warning"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <form 
            onSubmit={handleSubmit}
            className={`border rounded-xl h-14 flex items-center pr-2 pl-3 text-[14px] w-full transition-all duration-300 relative ${theme.bgInput} ${theme.borderInput} ${theme.focusInput} ${theme.textPrimary}`}
          >
            <div className="relative mr-3 flex items-center">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] transition-colors focus:outline-none ${
                  lightMode ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-900 border border-zinc-300/40' : 'bg-[#2d2d30] hover:bg-[#3f3f46] text-[#e4e4e7]'
                }`}
              >
                <span className="capitalize">{mode}</span>
                <ChevronDown size={14} className="text-[#a1a1aa]" />
              </button>
              
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className={`absolute bottom-full mb-2 left-0 w-32 border rounded-lg shadow-xl overflow-hidden z-10 flex flex-col p-1 ${theme.bgModal} ${theme.border}`}>
                    {['ask', 'plan', 'code'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setIsDropdownOpen(false); }}
                        className={`text-left px-3 py-2 text-[13px] rounded-md transition-colors ${
                          mode === m 
                            ? (lightMode ? 'bg-zinc-200 text-black font-semibold' : 'bg-[#3f3f46] text-[#e4e4e7]') 
                            : (lightMode ? 'text-zinc-600 hover:bg-zinc-100 hover:text-black' : 'text-[#a1a1aa] hover:bg-[#2d2d30] hover:text-[#e4e4e7]')
                        }`}
                      >
                        <span className="capitalize">{m}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <input 
              type="text" 
              className={`flex-1 bg-transparent outline-none ${theme.textPlaceholder}`} 
              placeholder="Message Xcode..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isRecording && !isGenerating) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            
            <div className="flex items-center gap-1">
              {isGenerating ? (
                <button 
                  type="button"
                  onClick={handleStop}
                  className={`p-2 rounded-lg flex items-center justify-center transition-colors ${theme.textSecondary} hover:${theme.textPrimary}`}
                  title="Stop generating"
                >
                  <div className="w-[18px] h-[18px] border-[1.5px] border-current rounded-full flex flex-col items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-current rounded-[1px]"></div>
                  </div>
                </button>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={toggleRecording}
                    className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                      isRecording 
                        ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                        : `${theme.textSecondary} ${theme.bgHoverConv}`
                    }`}
                    title={isRecording ? "Stop recording" : "Start recording"}
                  >
                    {isRecording ? <Square size={18} className="fill-current" /> : <Mic size={18} />}
                  </button>
                  <button 
                    type="submit"
                    disabled={!transcript.trim()}
                    className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                      transcript.trim() 
                        ? theme.btnSend 
                        : (lightMode ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed opacity-50' : 'bg-[#2d2d30] text-[#52525b] opacity-60 cursor-not-allowed')
                    }`}
                    title="Send message"
                  >
                    <ArrowUp size={18} strokeWidth={2.5} />
                  </button>
                </>
              )}
            </div>
          </form>
          <div className={`text-[11px] flex gap-4 justify-center mt-1 select-none font-mono ${theme.textSecondary}`}>
            <span><span className={`font-semibold ${lightMode ? 'text-zinc-400' : 'text-[#3f3f46]'}`}>Session Usage:</span> {formatTokens(estimatedTokens)} tokens</span>
            <span><span className={`font-semibold ${lightMode ? 'text-zinc-400' : 'text-[#3f3f46]'}`}>Latency:</span> 240ms</span>
            <span><span className={`font-semibold ${lightMode ? 'text-zinc-400' : 'text-[#3f3f46]'}`}>Identity:</span> Stable</span>
          </div>
        </div>
      </div>
      
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className={`border rounded-xl w-[400px] overflow-hidden shadow-2xl transition-all duration-300 ${theme.bgModal} ${theme.border}`}>
            <div className={`flex items-center justify-between p-4 border-b ${theme.divider}`}>
              <h2 className={`font-semibold text-[15px] ${theme.textPrimary}`}>Settings</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className={`transition-colors p-1 rounded hover:bg-zinc-500/10 ${theme.textSecondary} hover:${theme.textPrimary}`}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-5">
              {/* High-Contrast Toggle */}
              <div className="flex flex-col gap-2">
                <label className={`block text-[11px] uppercase tracking-wider mb-1.5 font-bold ${theme.textSecondary}`}>
                  App Appearance
                </label>
                <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors duration-300 ${
                  lightMode ? 'bg-zinc-50 border-zinc-200' : 'bg-[#09090b] border-[#2d2d30]'
                }`}>
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-[13px] font-semibold ${theme.textPrimary}`}>
                      {lightMode ? 'High-Contrast Light Theme' : 'Calibrated Dark Theme'}
                    </span>
                    <span className="text-[11px] text-[#a1a1aa] leading-normal">
                      Toggle standard layouts or fine lines
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleLightMode}
                    className={`h-7 w-12 rounded-full p-0.5 transition-colors duration-300 relative flex items-center focus:outline-none cursor-pointer ${
                      lightMode ? 'bg-[#10b981]' : 'bg-zinc-850'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow flex items-center justify-center transition-transform duration-300 transform ${
                      lightMode ? 'translate-x-5' : 'translate-x-0'
                    }`}>
                      {lightMode ? (
                        <Sun size={11} className="text-[#10b981] fill-current" />
                      ) : (
                        <Moon size={11} className="text-zinc-650 fill-current" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* API Key management */}
              <div className="flex flex-col gap-2">
                <label className={`block text-[11px] uppercase tracking-wider mb-1 font-bold ${theme.textSecondary}`}>
                  Gemini API Key
                </label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API Key"
                  className={`w-full border rounded-lg h-10 px-3 text-[14px] focus:outline-none transition-all duration-300 ${
                    lightMode 
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-350' 
                      : 'bg-[#09090b] border-[#2d2d30] text-[#e4e4e7] focus:border-[#3f3f46] focus:ring-1 focus:ring-[#3f3f46]'
                  }`}
                />
                <p className={`text-[11px] leading-relaxed ${theme.textSecondary}`}>
                  Your API key is stored securely in your browser's local storage and is sent to the server with each request.
                </p>
              </div>
            </div>

            <div className={`p-4 border-t flex justify-end gap-3 transition-colors duration-300 ${
              lightMode ? 'bg-zinc-50/80 border-zinc-250' : 'bg-[#09090b]/50 border-[#2d2d30]'
            }`}>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${theme.textSecondary} ${theme.bgHoverConv}`}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveApiKey}
                className={`px-4 py-2 text-[13px] font-semibold rounded-lg shadow-sm transition-colors ${theme.btnSend}`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
