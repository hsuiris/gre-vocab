import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  // The provider is what turns iOS's status-bar and home-indicator margins into
  // numbers the navigator can read. On web those come from the page's own
  // env(safe-area-inset-*), which only has a value because the exported
  // index.html asks for viewport-fit=cover.
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
