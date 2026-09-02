import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { createNavigationContainerRef, DefaultTheme, NavigationContainer } from '@react-navigation/native';
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

const navRef = createNavigationContainerRef<RootStackParamList>();

// Launched from the home screen there is no browser chrome and so no back
// button, and react-navigation ships no gesture for the web build at all. So
// the iPhone one is rebuilt here: the page follows the finger from the left
// edge, and letting go either throws it off screen or springs it back.
//
// Taking the touch has to happen in the capture phase, because a Pressable
// under the finger has already claimed it by then — hence the strict test: the
// drag must start against the left edge and already be travelling sideways
// before it is taken away from the screen below.
// ponytail: web only. On iOS the platform's own edge gesture is already there.
const EDGE = 30;
// Past a third of the screen, or thrown hard enough, the page keeps going. Both
// are needed: a slow, careful drag past the middle should complete, and so
// should a quick flick that never got that far.
const COMMIT = 0.33;
const FLICK = 0.3;

function useEdgeBack() {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;

  return useMemo(() => {
    // useNativeDriver is off on purpose: react-native-web has no native driver,
    // and transforms it drives from JS are what the DOM gets anyway.
    const springBack = () =>
      Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 0, speed: 16 }).start();

    const pan = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (e, g) =>
        navRef.isReady() &&
        navRef.canGoBack() &&
        e.nativeEvent.pageX - g.dx < EDGE &&
        g.dx > 8 &&
        Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < width * COMMIT && g.vx < FLICK) return springBack();
        Animated.timing(x, {
          toValue: width,
          // Whatever is left of the trip, at roughly the speed the rest of it
          // took — a fixed duration reads as a stall after a fast flick.
          duration: Math.max(90, Math.round((1 - g.dx / width) * 260)),
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(() => {
          if (navRef.canGoBack()) navRef.goBack();
          // Same tick as the pop, so the screen underneath is never painted
          // sitting off to the right.
          x.setValue(0);
        });
      },
      onPanResponderTerminate: springBack,
    });

    return { x, handlers: pan.panHandlers };
  }, [width, x]);
}

export function RootNavigator() {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const back = useEdgeBack();
  // Native already has this gesture, and running a second one on top of it
  // drags the screen twice as far as the finger went.
  const gesture = Platform.OS === 'web' ? back.handlers : {};
  return (
    <View style={styles.root}>
      <Backdrop />
      <Animated.View style={[styles.stage, { transform: [{ translateX: back.x }] }]} {...gesture}>
        <NavigationContainer ref={navRef} theme={glassTheme}>
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
            <Stack.Screen
              name="BoxWords"
              component={BoxWordsScreen}
              options={({ route }) => ({ title: `盒子 ${route.params.box}` })}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </Animated.View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // overflow hidden matters: the backdrop blobs hang off every edge, and on
  // web a stray negative offset would widen the page instead of being clipped.
  root: { flex: 1, backgroundColor: t.colors.page, overflow: 'hidden' },
  // Sits on top of the backdrop, so it stays transparent — its only job is the
  // back gesture. No top padding here on purpose: the header already insets
  // itself past the clock, and paying it twice leaves a band of empty page.
  // The shadow is only ever seen mid-swipe, when the page has left the left
  // edge and the backdrop shows through behind it; root clips it the rest of
  // the time.
  stage: { flex: 1, ...t.glassShadow, shadowOffset: { width: -14, height: 0 } },
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { width: 25, height: 25 },
});
