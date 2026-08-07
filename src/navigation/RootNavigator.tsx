import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { PracticeScreen } from '../screens/PracticeScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ExcludedScreen } from '../screens/ExcludedScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { BoxWordsScreen } from '../screens/BoxWordsScreen';
import { RelationsScreen } from '../screens/RelationsScreen';
import { AllWordsScreen } from '../screens/AllWordsScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { colors } from '../theme';
import { PracticeOrder } from '../lib/practiceQueue';

export type QuizMode = 'choice' | 'cloze' | 'typing';

export type RootStackParamList = {
  Home: undefined;
  Practice: { direction: 'en-zh' | 'zh-en'; order?: PracticeOrder; letters?: string[]; mode?: QuizMode; wrongOnly?: boolean };
  Stats: undefined;
  Excluded: undefined;
  Settings: undefined;
  Relations: undefined;
  AllWords: undefined;
  Notes: undefined;
  BoxWords: { box: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.page },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: colors.page },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: 'GRE 單字',
            headerRight: () => (
              <Pressable style={styles.headerIconButton} onPress={() => navigation.navigate('Settings')} hitSlop={10}>
                <Image source={require('../../assets/settings-icon.png')} style={styles.headerIcon} />
              </Pressable>
            ),
          })}
        />
        <Stack.Screen name="Practice" component={PracticeScreen} options={{ title: '練習' }} />
        <Stack.Screen name="Stats" component={StatsScreen} options={{ title: '統計' }} />
        <Stack.Screen name="Excluded" component={ExcludedScreen} options={{ title: '回收桶' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '設定' }} />
        <Stack.Screen name="Relations" component={RelationsScreen} options={{ title: '近義／反義詞' }} />
        <Stack.Screen name="AllWords" component={AllWordsScreen} options={{ title: '單字總覽' }} />
        <Stack.Screen name="Notes" component={NotesScreen} options={{ title: '筆記庫' }} />
        <Stack.Screen
          name="BoxWords"
          component={BoxWordsScreen}
          options={({ route }) => ({ title: `盒子 ${route.params.box}` })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { width: 25, height: 25 },
});
