import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { PracticeScreen } from '../screens/PracticeScreen';
import { QuizSetupScreen } from '../screens/QuizSetupScreen';
import { WrongWordsScreen } from '../screens/WrongWordsScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ExcludedScreen } from '../screens/ExcludedScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { BoxWordsScreen } from '../screens/BoxWordsScreen';
import { RelationsScreen } from '../screens/RelationsScreen';
import { ConceptScreen } from '../screens/ConceptScreen';
import { AllWordsScreen } from '../screens/AllWordsScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { Backdrop } from '../components/Glass';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';
import { PracticeOrder } from '../lib/practiceQueue';
import type { LastQuiz } from '../lib/storage';

export type QuizMode = 'choice' | 'cloze' | 'typing';

export type RootStackParamList = {
  Home: undefined;
  QuizSetup: { quiz: LastQuiz };
  WrongWords: { quiz: LastQuiz };
  Practice: {
    direction: 'en-zh' | 'zh-en';
    order?: PracticeOrder;
    letters?: string[];
    mode?: QuizMode;
    wrongOnly?: boolean;
    limit?: number;
  };
  Stats: undefined;
  Excluded: undefined;
  Settings: undefined;
  Relations: undefined;
  Concept: { id: string };
  AllWords: undefined;
  Notes: undefined;
  BoxWords: { box: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// One wash of colour for the whole app, laid down under the navigator: every
// screen is then transparent, and the glass panes on them have something real
// to blur.
const glassTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent', card: 'transparent' },
};

export function RootNavigator() {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <Backdrop />
      <NavigationContainer theme={glassTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerTintColor: theme.colors.ink,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: 'transparent' },
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
        <Stack.Screen name="QuizSetup" component={QuizSetupScreen} options={{ title: '選範圍' }} />
        <Stack.Screen name="WrongWords" component={WrongWordsScreen} options={{ title: '錯題清單' }} />
        <Stack.Screen name="Practice" component={PracticeScreen} options={{ title: '練習' }} />
        <Stack.Screen name="Stats" component={StatsScreen} options={{ title: '統計' }} />
        <Stack.Screen name="Excluded" component={ExcludedScreen} options={{ title: '已熟悉字庫' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '設定' }} />
        <Stack.Screen name="Relations" component={RelationsScreen} options={{ title: '近義詞與反義詞' }} />
        <Stack.Screen name="Concept" component={ConceptScreen} options={{ title: '概念筆記' }} />
        <Stack.Screen name="AllWords" component={AllWordsScreen} options={{ title: '單字總覽' }} />
        <Stack.Screen name="Notes" component={NotesScreen} options={{ title: '筆記庫' }} />
        <Stack.Screen
          name="BoxWords"
          component={BoxWordsScreen}
          options={({ route }) => ({ title: `盒子 ${route.params.box}` })}
        />
      </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // overflow hidden matters: the backdrop blobs hang off every edge, and on
  // web a stray negative offset would widen the page instead of being clipped.
  root: { flex: 1, backgroundColor: t.colors.page, overflow: 'hidden' },
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { width: 25, height: 25 },
});
