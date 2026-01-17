import React, { useState } from 'react';
import { GRADES, MODES } from '../constants';
import { SessionConfig } from '../types';
import { Button } from './Button';
import { Input } from './Input';

interface SetupScreenProps {
  onStart: (config: SessionConfig) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStart }) => {
  const [grade, setGrade] = useState(GRADES[4]); // Default Grade 10
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [mode, setMode] = useState(MODES[0].id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim() && chapter.trim()) {
      onStart({ grade, subject, chapter, mode });
    }
  };

  return (
    // Changed: h-full overflow-y-auto to allow scrolling on small screens
    <div className="h-full w-full bg-slate-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-blue-600 p-6 text-white text-center">
            <h1 className="text-2xl font-bold tracking-tight">NCERT AI Tutor</h1>
            <p className="text-blue-100 mt-2 text-sm">Your rigorous, exam-focused home teacher.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Class</label>
                <select 
                  value={grade} 
                  onChange={(e) => setGrade(e.target.value)}
                  className="px-4 py-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none bg-white w-full"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <Input 
                label="Subject" 
                placeholder="e.g. Science, History, Mathematics" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />

              <Input 
                label="Chapter Name" 
                placeholder="e.g. Carbon and its Compounds" 
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Learning Mode</label>
                <div className="grid grid-cols-1 gap-3">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        mode === m.id 
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`font-semibold ${mode === m.id ? 'text-blue-700' : 'text-slate-700'}`}>
                        {m.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{m.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button type="submit" fullWidth disabled={!subject || !chapter}>
              Start Session
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};