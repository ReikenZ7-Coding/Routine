// Each routed page inside the desktop shell. The navigator crossfades pages over 180 ms but leaves the page it
// faded out in place, transparent and still in the Tab order; so once that fade has ended, the page left behind is
// hidden (visibility, which keeps its scroll position) and takes no pointer input on the way out. Pages with a
// desktop layout of their own fill the content area; the rest show their phone layout in a centred 720 dp column
// for now.
import { useIsFocused } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/** The navigator's crossfade (TAB_FADE in the root layout), and a frame to spare. */
const FADE_OUT_MS = 180 + 40;

export function DesktopScreen({ wide, children }: { wide: boolean; children: ReactNode }) {
  const focused = useIsFocused();
  const [faded, setFaded] = useState(!focused);
  useEffect(() => {
    if (focused) {
      setFaded(false);
      return;
    }
    const t = setTimeout(() => setFaded(true), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [focused]);
  const hidden = faded && !focused;
  return (
    <View style={[styles.fill, hidden && styles.hidden]} pointerEvents={focused ? 'auto' : 'none'} aria-hidden={!focused}>
      {wide ? (
        children
      ) : (
        <View style={styles.column}>
          <View style={styles.columnInner}>{children}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { visibility: 'hidden' } as never,
  column: { flex: 1, alignItems: 'center' },
  columnInner: { flex: 1, width: '100%', maxWidth: 720 },
});
