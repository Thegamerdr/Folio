// SignInSheet — the optional Clerk email-code sign-in flow, opened from AccountScreen's
// "Sign in" row. Only ever mounted when clerkAuth.isClerkConfigured() is true (see AccountScreen.tsx
// — with no publishable key this component is never imported into the render tree in practice, and
// every hook here is a no-op no-crash if somehow called without a ClerkProvider ancestor, because
// AccountScreen only renders this sheet behind that same isClerkConfigured() gate).
//
// Flow: email -> Clerk sends a 6-digit code -> code -> session active. No web-browser redirect;
// this is the standard clerk-expo "email code" first-factor strategy, entirely in-app.
//
// Kept in the established local-sheet shape (visible/onClose, kit `Sheet` primitive, paper styling)
// — see LogPaymentSheet.tsx for the pattern this mirrors.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';

export type SignInSheetProps = {
  visible: boolean;
  onClose: () => void;
};

type Step = 'email' | 'code';

export function SignInSheet({ visible, onClose }: SignInSheetProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const { isLoaded, signIn, setActive } = useSignIn();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep('email');
    setEmail('');
    setCode('');
    setBusy(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSendCode() {
    if (!isLoaded || busy) return;
    const trimmed = email.trim();
    if (trimmed.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: trimmed });
      const emailFactor = attempt.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
      if (!emailFactor || !('emailAddressId' in emailFactor)) {
        setError("We couldn't find a way to email you a code. Try again in a moment.");
        return;
      }
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: emailFactor.emailAddressId,
      });
      setStep('code');
    } catch {
      setError("That didn't work — check the email and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode() {
    if (!isLoaded || busy) return;
    const trimmed = code.trim();
    if (trimmed.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signIn.attemptFirstFactor({ strategy: 'email_code', code: trimmed });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        handleClose();
      } else {
        setError("That code didn't match — check it and try again.");
      }
    } catch {
      setError("That code didn't match — check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={handleClose}>
      <View style={s.body}>
        <Text style={s.eyebrow}>Sign in</Text>
        <Text style={s.headline}>
          Save across <Text style={s.accentWord}>devices.</Text>
        </Text>
        <Text style={s.subline}>
          {step === 'email'
            ? "We'll email you a one-time code — no password to remember."
            : `Enter the code we sent to ${email.trim()}.`}
        </Text>

        {step === 'email' ? (
          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={[s.input, { color: t.ink, backgroundColor: t.inset, borderColor: t.hairline }]}
              accessibilityLabel="Email address"
            />
          </View>
        ) : (
          <View style={s.field}>
            <Text style={s.label}>Code</Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
              placeholder="123456"
              placeholderTextColor={t.muted}
              keyboardType="number-pad"
              style={[s.input, { color: t.ink, backgroundColor: t.inset, borderColor: t.hairline }]}
              accessibilityLabel="Verification code"
            />
          </View>
        )}

        {error ? <Text style={s.errorLine}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={step === 'email' ? handleSendCode : handleVerifyCode}
          style={[s.primary, { backgroundColor: busy ? `${t.muted}66` : t.calm }]}
        >
          <Text style={[s.primaryLabel, { color: t.inverse }]}>
            {busy ? 'One moment…' : step === 'email' ? 'Send code' : 'Verify & sign in'}
          </Text>
        </Pressable>
        {step === 'code' ? (
          <Pressable accessibilityRole="button" onPress={() => setStep('email')} style={s.cancel}>
            <Text style={s.cancelLabel}>Use a different email</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={handleClose} style={s.cancel}>
          <Text style={s.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: {
      paddingBottom: gap.md,
    },
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 22,
      lineHeight: 26,
      marginTop: gap.xs,
    },
    accentWord: {
      color: t.calm,
      fontFamily: serif.display,
    },
    subline: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      marginTop: gap.sm,
    },
    field: {
      marginTop: gap.lg,
    },
    label: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.2,
      marginBottom: gap.xs,
      textTransform: 'uppercase',
    },
    input: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      fontSize: 15,
      paddingHorizontal: gap.md,
      paddingVertical: gap.md,
    },
    errorLine: {
      color: t.repairInk,
      fontSize: 12,
      marginTop: gap.sm,
    },
    primary: {
      alignItems: 'center',
      borderRadius: radius.lg,
      marginTop: gap.xl,
      paddingVertical: gap.md,
    },
    primaryLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    cancel: {
      alignItems: 'center',
      marginTop: gap.md,
      paddingVertical: gap.xs,
    },
    cancelLabel: {
      color: t.muted,
      fontSize: 13,
    },
  });
}
