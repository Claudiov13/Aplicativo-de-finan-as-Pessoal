import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Loader2, User, Sparkles } from 'lucide-react';
import { startAssistantChat } from '../services/geminiService';
import { cn } from '../lib/utils';
import { Transaction } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GeminiAssistantProps {
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  transactions: Transaction[];
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ onAddTransaction, transactions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou seu assistente financeiro. Como posso ajudar hoje? Pode me contar um gasto ou pedir uma análise das suas contas.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !chat) {
      const newChat = startAssistantChat(() => {});
      setChat(newChat);
    }
  }, [isOpen, chat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chat) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Add context about transactions if user asks for analysis
      let prompt = userMessage;
      if (userMessage.toLowerCase().includes('analis') || userMessage.toLowerCase().includes('resumo')) {
        const summary = transactions.slice(0, 50).map(t => 
          `${t.date.toLocaleDateString()}: ${t.description} - ${t.type === 'income' ? '+' : '-'}${t.amount} (Cat: ${t.category || 'N/A'})`
        ).join('\n');
        prompt = `${userMessage}\n\nContexto das últimas transações:\n${summary}`;
      }

      const response = await chat.sendMessage({ message: prompt });
      
      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'create_transaction') {
            const args = call.args as any;
            await onAddTransaction({
              description: args.description,
              amount: args.amount,
              type: args.type as 'expense' | 'income',
              category: args.category || '',
              isSubscription: args.isSubscription || false,
              date: args.date ? new Date(args.date) : new Date()
            });
            // Inform model the call succeeded
            const followUp = await chat.sendMessage({ 
              message: `SUCESSO: O lançamento "${args.description}" de ${args.amount} foi cadastrado.` 
            });
            setMessages(prev => [...prev, { role: 'assistant', content: followUp.text }]);
          } else if (call.name === 'analyze_finances') {
             // Already provided context in prompt, but we could do more here
             setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
          }
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ops, tive um probleminha para processar isso agora. Tente novamente em instantes.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* App Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110 active:scale-95",
          isOpen ? "bg-natural-text text-white rotate-90" : "bg-natural-accent text-white"
        )}
      >
        {isOpen ? <X size={24} /> : <Bot size={28} />}
        {!isOpen && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[90vw] max-w-[400px] h-[500px] bg-white rounded-3xl shadow-2xl border border-natural-border flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="bg-natural-accent p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm">IA Assistente</h3>
                <span className="text-[10px] opacity-80">Online • Pronto para ajudar</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-natural-bg/20">
            {messages.map((m, i) => (
              <div key={i} className={cn(
                "flex items-start gap-2",
                m.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
                  m.role === 'assistant' ? "bg-natural-accent text-white" : "bg-natural-muted text-white"
                )}>
                  {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                </div>
                <div className={cn(
                  "p-3 rounded-2xl text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed shadow-sm",
                  m.role === 'assistant' 
                    ? "bg-white text-natural-text border border-natural-border rounded-tl-none" 
                    : "bg-natural-accent text-white rounded-tr-none"
                )}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-natural-muted">
                <Loader2 className="animate-spin" size={16} />
                <span className="text-xs font-medium italic">Gemini está pensando...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-natural-border bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ex: Gastei 40 reais em almoço hoje..."
                className="flex-1 bg-natural-bg border border-natural-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent transition-all"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 bg-natural-accent text-white rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-all"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-[10px] text-center text-natural-muted mt-3">
              Alimentado por Gemini 3.0 Flash
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
