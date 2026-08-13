import React, { useEffect } from 'react';
import { RootNavigator } from './src/navigation/RootNavigator';
import { getSettings } from './src/lib/storage';
import { setPreferredVoice } from './src/lib/speech';

export default function App() {
  // The saved voice lives in AsyncStorage, so it can only be applied once the
  // app is running; until then speakWord falls back to auto-detection.
  useEffect(() => {
    getSettings().then((s) => setPreferredVoice(s.voiceId));
  }, []);

  return <RootNavigator />;
}
