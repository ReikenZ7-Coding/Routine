// On the web the browser moves the page for the on-screen keyboard itself, so sheets never lift.
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

export function useKeyboardHeight(): SharedValue<number> {
  return useSharedValue(0);
}
