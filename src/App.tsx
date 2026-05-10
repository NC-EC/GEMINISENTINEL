import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Terminal, 
  BookOpen, 
  FileText, 
  Send, 
  Loader2, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Globe,
  Database,
  Lock,
  Download,
  Paperclip,
  X,
  FileCode
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { streamGeminiChat, type CompanionModule } from './services/geminiService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AttachedFile {
  name: string;
  content: string;
  type: string;
  base64?: string;
}

const MODULES = [
  { id: 'analyst' as CompanionModule, title: 'Análisis de Retos', icon: ShieldAlert, description: 'Lluvia de ideas de vectores de ataque y herramientas para el lab.' },
  { id: 'automation' as CompanionModule, title: 'Automatización', icon: Terminal, description: 'Generación de scripts base (Python/Bash) para tareas repetitivas.' },
  { id: 'explainer' as CompanionModule, title: 'Lab de Teoría', icon: BookOpen, description: 'Explicación detallada de conceptos y vulnerabilidades.' },
  { id: 'documentation' as CompanionModule, title: 'Reporte de Hallazgos', icon: FileText, description: 'Estructuración profesional de tus hallazgos paso a paso.' },
];

export default function App() {
  const [activeModule, setActiveModule] = useState<CompanionModule>('analyst');
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [messages, setMessages] = useState<Record<CompanionModule, Message[]>>({
    analyst: [],
    automation: [],
    explainer: [],
    documentation: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeModule]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        
        if (file.type.startsWith('image/')) {
          // Store image as base64 without the prefix for Gemini
          const base64 = result.split(',')[1];
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            content: result, // Full URL for preview
            type: file.type,
            base64: base64
          }]);
        } else {
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            content: result,
            type: file.type
          }]);
        }
      };
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0 || isLoading) return;

    // Prepare images for Gemini
    const imagesForGemini = attachedFiles
      .filter(f => f.type.startsWith('image/') && f.base64)
      .map(f => ({ type: f.type, base64: f.base64! }));

    // Prepare text content including non-image file context
    const textFiles = attachedFiles.filter(f => !f.type.startsWith('image/'));
    let fullPrompt = input;
    if (textFiles.length > 0) {
      const fileContext = textFiles.map(f => `--- FILE: ${f.name} ---\n${f.content}`).join('\n\n');
      fullPrompt = `CONTEXTO DE ARCHIVOS ADJUNTOS:\n${fileContext}\n\nPREGUNTA/INSTRUCCIÓN DEL USUARIO:\n${input}`;
    }

    const userMsg: Message = { 
      role: 'user', 
      content: input + (attachedFiles.length > 0 ? `\n\n*Adjuntos: ${attachedFiles.map(f => f.name).join(', ')}*` : '') 
    };
    const assistantMsg: Message = { role: 'assistant', content: '' };
    
    setMessages(prev => ({
      ...prev,
      [activeModule]: [...prev[activeModule], userMsg, assistantMsg]
    }));
    
    setInput('');
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      await streamGeminiChat(activeModule, fullPrompt, (text) => {
        setMessages(prev => {
          const currentMsgs = [...prev[activeModule]];
          if (currentMsgs.length > 0) {
            currentMsgs[currentMsgs.length - 1] = { role: 'assistant', content: text };
          }
          return { ...prev, [activeModule]: currentMsgs };
        });
      }, imagesForGemini);
    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const currentMsgs = [...prev[activeModule]];
        if (currentMsgs.length > 0) {
          currentMsgs[currentMsgs.length - 1] = { 
            role: 'assistant', 
            content: "Error: No se pudo procesar la solicitud. Verifica la clave de API o el tipo de archivo." 
          };
        }
        return { ...prev, [activeModule]: currentMsgs };
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple feedback could be added here
  };

  const exportWriteup = () => {
    const content = messages.documentation
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n\n---\n\n');
    copyToClipboard(content);
    alert("Writeup copiado al portapapeles en formato Markdown");
  };

  return (
    <div className="flex h-screen bg-[#0A0A0B] overflow-hidden font-sans text-[#E0E0E0]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0D0D0E] flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-white/5 gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-black font-bold shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.5)]">G</div>
          <span className="text-lg font-semibold tracking-tight whitespace-nowrap">
            GEMINI<span className="text-cyber-green">SENTINEL</span>
          </span>
        </div>

        <div className="p-4 flex flex-col gap-1 overflow-y-auto flex-1">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 px-3">Selector de Módulos</div>
          {MODULES.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={cn(
                "flex flex-col items-start gap-1 p-3 rounded-lg transition-all text-sm group",
                activeModule === mod.id 
                  ? "bg-white/5 border border-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                  : "hover:bg-white/5 text-white/60 border border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 transition-transform group-hover:scale-110",
                  activeModule === mod.id ? "text-cyber-green" : "text-white/40"
                )}>
                  {activeModule === mod.id ? '◈' : '◇'}
                </div>
                <span className="truncate font-medium">{mod.title}</span>
              </div>
              <span className="text-[10px] text-white/30 px-7 leading-tight line-clamp-1">{mod.description}</span>
            </button>
          ))}

          <div className="mt-8 px-3">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 px-3 flex items-center gap-2">
              <Terminal className="w-3 h-3" /> toolbox rápido
            </div>
            <div className="space-y-2">
               {[
                 { name: 'Nmap Scan', cmd: 'nmap -sC -sV -oN scan.txt [IP]' },
                 { name: 'Gobuster', cmd: 'gobuster dir -u [URL] -w common.txt' },
                 { name: 'XOR Bruteforce', cmd: 'python3 xor_tool.py --file encrypted.bin' }
               ].map((tool, i) => (
                 <button 
                   key={i}
                   onClick={() => copyToClipboard(tool.cmd)}
                   className="w-full text-left p-2 rounded border border-white/5 bg-white/2 bg-cyber-panel hover:bg-white/5 transition-colors group"
                 >
                   <p className="text-[10px] text-white/40 mb-1">{tool.name}</p>
                   <p className="text-[9px] mono truncate text-cyber-green/70 group-hover:text-cyber-green">{tool.cmd}</p>
                 </button>
               ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20 text-[10px] mono flex flex-col gap-2 opacity-50">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              SISTEMA ACTIVO
            </span>
          </div>
          <span>LATENCIA API: 124ms</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-[#0A0A0B]">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0D0D0E]/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-1 px-2 text-[10px] mono bg-cyber-green/10 text-cyber-green rounded border border-cyber-green/20">
              REF: CTF-{activeModule.toUpperCase()}
            </div>
            <h2 className="text-xs uppercase tracking-wider font-semibold text-white/50">
              {MODULES.find(m => m.id === activeModule)?.description}
            </h2>
          </div>
          <div className="flex items-center gap-4">
             {activeModule === 'documentation' && messages.documentation.length > 0 && (
               <button 
                onClick={exportWriteup}
                className="flex items-center gap-2 bg-cyber-green text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:scale-105 transition-transform"
               >
                 <Download className="w-3 h-3" /> EXPORTAR MARKDOWN
               </button>
             )}
             <div className="flex items-center gap-2 text-[10px] mono bg-white/5 px-2 py-1 rounded border border-white/10">
               <span className="w-1 h-1 rounded-full bg-cyber-green"></span>
               RELEVANCIA ESTIMADA: 94.2%
             </div>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth"
        >
          {messages[activeModule].length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-12">
              <div className="max-w-3xl w-full">
                <div className="p-8 border-cyber rounded-2xl bg-cyber-surface/30 backdrop-blur-sm relative overflow-hidden mb-8">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                     <ShieldAlert className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-xs text-cyber-green mono font-bold mb-2 uppercase tracking-widest">[SISTEMA INICIALIZADO]</p>
                    <p className="text-2xl font-light text-white leading-relaxed italic mb-6">
                      "Motor Criptográfico Gemini listo para análisis multi-vector. Sube capturas de pantalla o logs para comenzar."
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {MODULES.map((mod) => (
                    <button 
                      key={mod.id}
                      onClick={() => setActiveModule(mod.id)}
                      className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left transition-all hover:bg-white/10 hover:border-cyber-green/30 group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <mod.icon className="w-5 h-5 text-cyber-green" />
                        <h3 className="font-mono text-sm font-bold uppercase text-white group-hover:text-cyber-green transition-colors">{mod.title}</h3>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed font-sans">
                        {mod.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {messages[activeModule].map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-6 max-w-4xl mx-auto",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center shrink-0 border text-[10px] font-bold mono",
                    msg.role === 'user' 
                      ? "bg-white/5 border-white/10 text-white/40" 
                      : "bg-cyber-green/10 border-cyber-green/20 text-cyber-green shadow-[0_0_10px_rgba(0,255,170,0.2)]"
                  )}>
                    {msg.role === 'user' ? 'USR' : 'GEM'}
                  </div>
                  <div className={cn(
                    "flex-1 p-6 rounded-2xl border",
                    msg.role === 'user' 
                      ? "bg-white/5 border-white/5 text-right rounded-tr-none" 
                      : "bg-[#121214] rounded-tl-none border-[#00FFAA33]"
                  )}>
                    <div className="markdown-body prose prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {isLoading && (
            <div className="flex gap-6 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded border border-cyber-green/30 flex items-center justify-center animate-pulse">
                <Loader2 className="w-4 h-4 text-cyber-green animate-spin" />
              </div>
              <div className="p-4 rounded-xl bg-cyber-surface border border-white/5 flex items-center gap-3">
                <span className="text-[10px] mono text-cyber-green animate-pulse tracking-widest uppercase">Gemini analizando hallazgos...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 border-t border-white/5 bg-black/30">
          <div className="max-w-4xl mx-auto relative group">
            {/* File Previews */}
            <AnimatePresence>
              {attachedFiles.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex flex-wrap gap-2 mb-4"
                >
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 p-2 rounded-lg pr-1">
                      {file.type.startsWith('image/') ? (
                        <div className="w-6 h-6 rounded overflow-hidden border border-white/10 shrink-0">
                           <img src={file.content} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <FileCode className="w-3 h-3 text-cyber-green" />
                      )}
                      <span className="text-[10px] mono text-white/50 truncate max-w-[150px]">{file.name}</span>
                      <button 
                        onClick={() => removeFile(i)}
                        className="p-1 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  activeModule === 'analyst' ? "Carga un log o screenshot para identificar fallos..." :
                  activeModule === 'automation' ? "Especifica la automatización (ej: script de fuerza bruta)..." :
                  activeModule === 'explainer' ? "Consulta teorías de seguridad (ej: ataques de tiempo)..." :
                  "Transmite tus notas para generar el writeup final..."
                }
                className="w-full bg-[#161618] border border-white/10 rounded-xl py-4 px-6 pr-28 focus:outline-none focus:border-cyber-green/30 focus:ring-4 focus:ring-cyber-green/5 transition-all resize-none min-h-[80px] text-sm leading-relaxed placeholder:text-white/20"
              />
              <div className="absolute right-4 bottom-4 flex items-center gap-2">
                <input 
                  type="file" 
                  multiple 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="text/*,application/json,image/*"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-white/40 hover:text-cyber-green hover:bg-cyber-green/10 transition-all"
                  title="Adjuntar imágenes o archivos (.txt, .log, .json)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    isLoading || (!input.trim() && attachedFiles.length === 0)
                      ? "text-white/10 cursor-not-allowed"
                      : "text-cyber-green hover:bg-cyber-green/10 active:scale-95"
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 opacity-20 hover:opacity-100 transition-opacity">
             <div className="h-px w-12 bg-white"></div>
             <p className="text-[9px] mono uppercase tracking-[0.2em]">Terminal de Transmisión de Inteligencia v1.5</p>
             <div className="h-px w-12 bg-white"></div>
          </div>
        </div>
      </main>
    </div>
  );
}