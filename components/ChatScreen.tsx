import React, { useState, useEffect, useRef } from 'react';
import { Message, Sender, SessionConfig } from '../types';
import { initializeChat, streamMessageToAI, streamInitialConversation } from '../services/geminiService';
import { MarkdownText } from './MarkdownText';
import { Button } from './Button';
import { CONCEPT_MAP_PROMPT } from '../constants';

interface ChatScreenProps {
  config: SessionConfig;
  onExit: () => void;
}

type AIModelMode = 'standard' | 'fast' | 'thinking';

export const ChatScreen: React.FC<ChatScreenProps> = ({ config, onExit }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New State for features
  const [mode, setMode] = useState<AIModelMode>('standard');
  const [attachedImage, setAttachedImage] = useState<string | null>(null); // Base64
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to check if user is near bottom
  const isNearBottom = () => {
    if (!scrollContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  const handleScroll = () => {
    if (!isNearBottom()) {
      userScrolledUpRef.current = true;
    } else {
      userScrolledUpRef.current = false;
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].sender === Sender.User) {
        userScrolledUpRef.current = false; 
        scrollToBottom('smooth');
    }
  }, [messages.length]);

  useEffect(() => {
    if (isLoading && !userScrolledUpRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await initializeChat(config);
        
        if (!isMounted) return;

        setIsLoading(true);
        const aiMsgId = 'init';
        
        setMessages([
          {
            id: aiMsgId,
            sender: Sender.AI,
            text: '', 
            timestamp: new Date()
          }
        ]);

        const stream = streamInitialConversation(config);
        let fullText = "";
        
        for await (const chunk of stream) {
            if (!isMounted) break;
            fullText += chunk;
            setMessages(prev => {
                return prev.map(msg => 
                    msg.id === aiMsgId ? { ...msg, text: fullText } : msg
                );
            });
        }
      } catch (err) {
        if (isMounted) {
            console.error(err);
            setError("Failed to start session. Please check your connection or API Key.");
        }
      } finally {
        if (isMounted) {
            setIsLoading(false);
            if (!userScrolledUpRef.current) {
                scrollToBottom('smooth');
            }
        }
      }
    };
    init();

    return () => { isMounted = false; };
  }, [config]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (text: string, displayText?: string, systemPayload?: string) => {
    if (isLoading) return;

    const currentImage = attachedImage;
    const currentMode = mode;
    
    // If displayText is provided, we show that to user, but send 'text' (or systemPayload) to AI
    const messageToShow = displayText || text;
    const messageToSend = text;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.User,
      text: messageToShow,
      timestamp: new Date(),
      image: currentImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedImage(null); // Clear image after sending
    setIsLoading(true);
    setError(null);
    userScrolledUpRef.current = false;

    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
        id: aiMsgId,
        sender: Sender.AI,
        text: '',
        timestamp: new Date()
    }]);

    try {
      const stream = streamMessageToAI(messageToSend, { 
        image: currentImage || undefined,
        mode: currentMode
      });
      let fullText = "";
      
      for await (const chunk of stream) {
        fullText += chunk;
        setMessages(prev => prev.map(msg => 
            msg.id === aiMsgId 
            ? { ...msg, text: fullText }
            : msg
        ));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
      if (!userScrolledUpRef.current) {
        scrollToBottom('smooth');
      }
    }
  };

  const handleSend = () => {
      if (!input.trim() && !attachedImage) return;
      handleSendMessage(input);
  };

  const handleGenerateConceptMap = () => {
      // We send the strict prompt but show a friendly message
      handleSendMessage(CONCEPT_MAP_PROMPT, "Generate Concept Map");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            {config.chapter}
          </h2>
          <span className="text-xs text-slate-500 font-medium">{config.grade} • {config.subject} • {config.mode === 'learn' ? 'Learning' : 'Revision'}</span>
        </div>
        <Button variant="outline" onClick={onExit} className="py-1.5 px-3 text-sm">
          End Session
        </Button>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex w-full ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] rounded-2xl px-5 py-4 shadow-sm ${
                msg.sender === Sender.User 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
              }`}
            >
              {msg.image && (
                <div className="mb-3 rounded-lg overflow-hidden border border-white/20">
                    <img src={msg.image} alt="User upload" className="max-w-full h-auto max-h-64 object-cover" />
                </div>
              )}
              {msg.sender === Sender.User ? (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              ) : (
                <MarkdownText content={msg.text} />
              )}
              <div className={`text-[10px] mt-2 opacity-70 ${msg.sender === Sender.User ? 'text-blue-100' : 'text-slate-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && messages.length > 0 && messages[messages.length - 1].sender === Sender.User && (
          <div className="flex justify-start w-full">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              <span className="text-xs text-slate-400 ml-2">
                {mode === 'thinking' ? 'Thinking deeply...' : 'Thinking...'}
              </span>
            </div>
          </div>
        )}
        
        {isLoading && messages.length === 0 && (
            <div className="flex justify-center pt-10">
                 <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                    Preparing your lesson...
                 </div>
            </div>
        )}

        {error && (
            <div className="flex justify-center w-full">
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm font-medium">
                    {error}
                </div>
            </div>
        )}
        
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
            
            {/* Attachment Preview */}
            {attachedImage && (
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg w-fit border border-slate-200">
                    <img src={attachedImage} alt="Preview" className="h-12 w-12 object-cover rounded-md" />
                    <button onClick={() => setAttachedImage(null)} className="text-slate-400 hover:text-red-500 p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Tools Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                    </svg>
                    Image
                </button>
                
                <button 
                    onClick={handleGenerateConceptMap}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path fillRule="evenodd" d="M.664 10.59a1.5 1.5 0 010-1.18c.575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0zM12.664 14.59a1.5 1.5 0 010-1.18c.575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0 .575.31 1.04.31 1.616 0 .575-.31 1.04-.31 1.616 0zM2.5 3a.5.5 0 01.5.5V5h.5a.5.5 0 010 1H3v3.5a.5.5 0 01-1 0V6h-.5a.5.5 0 010-1H2V3.5a.5.5 0 01.5-.5zM14.5 3a.5.5 0 01.5.5V5h.5a.5.5 0 010 1H15v3.5a.5.5 0 01-1 0V6h-.5a.5.5 0 010-1H14V3.5a.5.5 0 01.5-.5z" clipRule="evenodd" />
                    </svg>
                    Concept Map
                </button>

                <div className="h-4 w-px bg-slate-200 mx-1"></div>

                <button 
                    onClick={() => setMode('standard')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                        mode === 'standard' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    Default
                </button>
                <button 
                    onClick={() => setMode('fast')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                        mode === 'fast' 
                        ? 'border-amber-500 bg-amber-50 text-amber-700' 
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.283 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
                    </svg>
                    Fast AI
                </button>
                <button 
                    onClick={() => setMode('thinking')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                        mode === 'thinking' 
                        ? 'border-purple-500 bg-purple-50 text-purple-700' 
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z" clipRule="evenodd" />
                    </svg>
                    Think More
                </button>
            </div>

            <div className="flex gap-3 items-end">
                <div className="flex-1 relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={attachedImage ? "Ask something about this image..." : "Type your answer or ask a question..."}
                        className="w-full pl-4 pr-12 py-3 bg-slate-100 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none max-h-32 min-h-[52px]"
                        rows={1}
                        style={{ height: 'auto', minHeight: '52px' }}
                    />
                </div>
                <Button 
                    onClick={handleSend} 
                    disabled={isLoading || (!input.trim() && !attachedImage)}
                    className="h-[52px] w-[52px] flex items-center justify-center p-0 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    )}
                </Button>
            </div>
        </div>
        <div className="text-center mt-2 text-xs text-slate-400">
            {mode === 'thinking' ? 'Deep thinking mode active (Gemini 3 Pro).' : mode === 'fast' ? 'Fast mode active (Gemini 2.5 Flash Lite).' : 'Standard AI mode.'}
        </div>
      </div>
    </div>
  );
};