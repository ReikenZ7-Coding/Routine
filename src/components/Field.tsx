// Form fields for sheets: a visible label above every input (never a placeholder standing in for one), the
// input on the look's inset glass, and an inline error under the field that a screen reader announces.
import { Ionicons } from '@expo/vector-icons';
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { type Theme, useStyles, useTheme } from '../theme';
import { EASE_OUT, FOCUS_RING, SelectFade } from './Motion';
import { useSheet } from './Sheet';

const SHOW = FadeIn.duration(180).easing(EASE_OUT);
const HIDE = FadeOut.duration(140).easing(EASE_OUT);

/** A label, the control under it, and its error (14px, in the look's danger ink, announced politely). */
export function Field({ label, error, children, style }: { label: string; error?: string; children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      <FieldError message={error} />
    </View>
  );
}

/** An inline error or notice under a field (empty renders nothing). In a sheet, a new error scrolls into view
 *  with its field above it. */
export function FieldError({ message }: { message?: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const sheet = useSheet();
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (message) sheet?.reveal(ref.current);
  }, [message, sheet]);
  return (
    <View ref={ref}>
      {message ? (
        <Animated.View entering={SHOW} exiting={HIDE} style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} style={styles.errorIcon} />
          <Text style={styles.errorText}>{message}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A text input on inset glass, at least 48 tall. On Android a 1.5px ring fades in while it has focus (the web
 *  keeps its :focus-visible ring); an invalid input takes a danger rim. */
export function Input({ invalid, style, onFocus, onBlur, ...props }: TextInputProps & { invalid?: boolean }) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.box, invalid && styles.invalid]}>
      {FOCUS_RING && <SelectFade on={focused} radius={radii.inset} bleed={1} style={styles.ring} />}
      <TextInput
        placeholderTextColor={colors.faint}
        selectionColor={colors.link}
        cursorColor={colors.text}
        {...props}
        style={[styles.input, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
    </View>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) =>
  StyleSheet.create({
    field: { marginTop: 16 },
    label: { ...type.label, marginBottom: 8 },
    box: {
      minHeight: 48,
      justifyContent: 'center',
      borderRadius: radii.inset,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      backgroundColor: colors.material.inset.fill,
    },
    invalid: { borderColor: colors.danger, borderTopColor: colors.danger },
    ring: { borderWidth: 1.5, borderColor: colors.text },
    input: {
      minHeight: 46,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.text,
    },
    error: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
    errorIcon: { marginTop: 2 },
    errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
  });
