import React, { useState } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { ChatScreen } from './components/ChatScreen';
import { SessionConfig } from './types';

export default function App() {
  const [config, setConfig] = useState<SessionConfig | null>(null);

  return (
    <div className="h-screen bg-slate-50 text-slate-900">
      {!config ? (
        <SetupScreen onStart={setConfig} />
      ) : (
        <ChatScreen config={config} onExit={() => setConfig(null)} />
      )}
    </div>
  );
}
