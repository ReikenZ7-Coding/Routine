// The on-screen keyboard's height as a shared value, for sheets that lift above it. Under edge-to-edge
// (React Native 0.88, Android 15) the window no longer resizes for the keyboard, so sheets move themselves.
// Reanimated follows the keyboard frame by frame; React Native's keyboard events are the fallback for windows
// it cannot observe (a Modal is its own window), and the larger of the two wins.
import { useEffect } from 'react';
import { Keyboard } from 'react-native';
import { type SharedValue, useAnimatedKeyboard, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE_OUT } from '../Motion';

const FOLLOW = { duration: 220, easing: EASE_OUT };

export function useKeyboardHeight(): SharedValue<number> {
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
  const events = useSharedValue(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => events.set(withTiming(e.endCoordinates.height, FOLLOW)));
    const hide = Keyboard.addListener('keyboardDidHide', () => events.set(withTiming(0, FOLLOW)));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [events]);
  return useDerivedValue(() => Math.max(keyboard.height.get(), events.get()));
}
