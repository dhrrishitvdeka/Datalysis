import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, ArrowRight, CornerDownLeft } from 'lucide-react';
import { sendChatMessage } from '../services/api';

interface Message {
  id: string;
  sender: 'user' | 'expert';
  text: string;
  timestamp: string;
  suggested_followups?: string[];
}

interface ExpertChatProps {
  initialSuggestedColumn?: string;
}

export const ExpertChat: React.FC<ExpertChatProps> = ({ initialSuggestedColumn }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'expert',
      text: `Datalysis Expert Inference Console ready.\n\nStatistical facts extracted and production rules evaluated. Ask questions regarding specific column imputations, outlier thresholds, collinearity, or feature pruning rationale.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggested_followups: [
        'What are the critical issues?',
        initialSuggestedColumn ? `Why impute ${initialSuggestedColumn}?` : 'Show missing data',
        'Which columns should be dropped?',
        'Explain health score',
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const res = await sendChatMessage(textToSend);
      const expertMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'expert',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggested_followups: res.suggested_followups,
      };
      setMessages((prev) => [...prev, expertMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'expert',
        text: `Query error: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return <h4 key={idx} className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 pt-1">{line.replace('### ', '')}</h4>;
          }
          if (line.startsWith('## ')) {
            return <h3 key={idx} className="text-sm font-semibold text-white pt-1">{line.replace('## ', '')}</h3>;
          }
          if (line.startsWith('- ')) {
            return (
              <li key={idx} className="ml-4 list-disc text-zinc-300 text-xs">
                {parseInlineFormatting(line.replace('- ', ''))}
              </li>
            );
          }
          if (/^\d+\.\s/.test(line)) {
            return (
              <li key={idx} className="ml-4 list-decimal text-zinc-300 text-xs">
                {parseInlineFormatting(line.replace(/^\d+\.\s/, ''))}
              </li>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-0.5" />;
          }
          return (
            <p key={idx} className="text-xs text-zinc-300">
              {parseInlineFormatting(line)}
            </p>
          );
        })}
      </div>
    );
  };

  const parseInlineFormatting = (str: string) => {
    const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-200 font-mono text-[11px] border border-white/[0.08]">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="max-w-4xl mx-auto h-[650px] flex flex-col rounded-xl glass-card overflow-hidden">
      {/* Console Header */}
      <div className="px-5 py-3 border-b border-white/[0.06] bg-black/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-semibold text-zinc-200 font-mono">Expert Inference Console</h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-500 border border-white/[0.06]">
              Local Rule Engine
            </span>
          </div>
        </div>

        <span className="text-[10px] font-mono text-zinc-600">Deterministic • No Cloud LLM</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col space-y-1.5 ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-600 px-1">
              <span>{m.sender === 'user' ? 'YOU' : 'EXPERT'}</span>
              <span>•</span>
              <span>{m.timestamp}</span>
            </div>

            <div
              className={`max-w-[85%] p-3.5 rounded-lg text-xs ${
                m.sender === 'user'
                  ? 'bg-zinc-800 text-white border border-zinc-700/80 font-mono text-[11px]'
                  : 'bg-zinc-950/80 border border-white/[0.06] text-zinc-200'
              }`}
            >
              {renderFormattedText(m.text)}
            </div>

            {m.suggested_followups && m.suggested_followups.length > 0 && (
              <div className="pt-1 flex flex-wrap gap-1">
                {m.suggested_followups.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(chip)}
                    className="px-2 py-0.5 rounded bg-zinc-950 hover:bg-zinc-900 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 border border-white/[0.06] transition flex items-center space-x-1"
                  >
                    <span>{chip}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-zinc-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-zinc-950/60 border border-white/[0.04] text-xs font-mono text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
            <span>Evaluating rule chains & facts...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06] bg-black/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask question (e.g., 'Why median for Age?', 'Which features to drop?', 'Explain score')..."
            className="flex-1 bg-zinc-950 border border-white/[0.08] rounded-lg px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-zinc-950 text-xs font-semibold flex items-center space-x-1 transition"
          >
            <span>Ask</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
};
