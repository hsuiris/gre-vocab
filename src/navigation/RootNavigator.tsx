import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { PracticeScreen } from '../screens/PracticeScreen';
import { StatsScreen } from '../screens/StatsScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'GRE 單字' }} />
        <Stack.Screen name="Practice" component={PracticeScreen} options={{ title: '練習' }} />
        <Stack.Screen name="Stats" component={StatsScreen} options={{ title: '統計' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
