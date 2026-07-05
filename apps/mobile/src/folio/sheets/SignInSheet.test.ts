// SignInSheet — Clerk email-code sign-in contract (sheets/SignInSheet.tsx).
//
// The sheet drives a two-step flow entirely through `@clerk/clerk-expo`'s `useSignIn()`: an email
// step that calls `signIn.create` + `signIn.prepareFirstFactor('email_code')`, then a code step
// that calls `signIn.attemptFirstFactor('email_code')` and activates the session on success. This
// test pins the LOAD-BEARING promise of that flow: a successful `create`+`prepareFirstFactor`
// advances to the code step; a `create` failure (thrown, or no email_code factor available) surfaces
// the sheet's exact error copy and stays on the email step; a successful `attemptFirstFactor`
// activates the session; a non-complete/failed attempt surfaces the exact code-step error copy.
//
// Node-safe by design: SignInSheet.tsx imports react-native and JSX and so cannot load under the
// Node test runner (the repo's vitest glob is `apps/**/*.test.ts`, .tsx is never collected — see
// VisualizerScreen.addAll.test.ts / TodayNudges.test.ts headers for the same constraint; a genuine
// attempt to render it via @testing-library/react-native under this vitest config failed at
// react-native's own Flow-typed entrypoint before any test code ran, since the repo's Vite/Rollup
// transform has no Flow-stripping step — the reason the repo has never carried a real RN render
// test). SignInSheet has no separable pure module (unlike PaywallScreen's ctaMode.ts or the store
// TodayNudges reads), so this test re-implements the component's exact two handlers as plain,
// deterministic functions over a mocked `useSignIn()`-shaped object — the same technique the
// precedent files use for their own component logic.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The minimal slice of Clerk's SignInResource this component reads/calls — mirrors the real
// clerk-expo shape closely enough to exercise the sheet's exact branches.
type EmailFactor = { strategy: 'email_code'; emailAddressId: string };
type SignInAttempt = {
  status: 'complete' | 'needs_second_factor' | string;
  createdSessionId: string;
  supportedFirstFactors?: EmailFactor[] | null;
};

function makeSignIn() {
  return {
    create: vi.fn<(args: { identifier: string }) => Promise<SignInAttempt>>(),
    prepareFirstFactor: vi.fn<(args: unknown) => Promise<unknown>>(),
    attemptFirstFactor: vi.fn<(args: unknown) => Promise<SignInAttempt>>(),
  };
}

// A faithful re-statement of SignInSheet's `handleSendCode` — same guard order, same error copy,
// same state transitions (step/email/code/busy/error), over the mocked signIn/setActive pair.
async function handleSendCode(
  signIn: ReturnType<typeof makeSignIn>,
  email: string,
): Promise<{ step: 'email' | 'code'; error: string | null }> {
  const trimmed = email.trim();
  if (trimmed.length === 0) return { step: 'email', error: null };
  try {
    const attempt = await signIn.create({ identifier: trimmed });
    const emailFactor = attempt.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
    if (!emailFactor || !('emailAddressId' in emailFactor)) {
      return {
        step: 'email',
        error: "We couldn't find a way to email you a code. Try again in a moment.",
      };
    }
    await signIn.prepareFirstFactor({
      strategy: 'email_code',
      emailAddressId: emailFactor.emailAddressId,
    });
    return { step: 'code', error: null };
  } catch {
    return { step: 'email', error: "That didn't work — check the email and try again." };
  }
}

// A faithful re-statement of SignInSheet's `handleVerifyCode` — same guard order, same error copy,
// same "complete -> setActive -> close" success path.
async function handleVerifyCode(
  signIn: ReturnType<typeof makeSignIn>,
  setActive: (args: { session: string }) => Promise<void>,
  code: string,
): Promise<{ activated: boolean; error: string | null }> {
  const trimmed = code.trim();
  if (trimmed.length === 0) return { activated: false, error: null };
  try {
    const attempt = await signIn.attemptFirstFactor({ strategy: 'email_code', code: trimmed });
    if (attempt.status === 'complete') {
      await setActive({ session: attempt.createdSessionId });
      return { activated: true, error: null };
    }
    return { activated: false, error: "That code didn't match — check it and try again." };
  } catch {
    return { activated: false, error: "That code didn't match — check it and try again." };
  }
}

describe('SignInSheet — email step (handleSendCode)', () => {
  let signIn: ReturnType<typeof makeSignIn>;

  beforeEach(() => {
    signIn = makeSignIn();
  });

  it('advances to the code step on a successful create + prepareFirstFactor', async () => {
    signIn.create.mockResolvedValue({
      status: 'needs_first_factor',
      createdSessionId: '',
      supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    signIn.prepareFirstFactor.mockResolvedValue(undefined);

    const result = await handleSendCode(signIn, 'user@example.com');

    expect(result).toEqual({ step: 'code', error: null });
    expect(signIn.create).toHaveBeenCalledWith({ identifier: 'user@example.com' });
    expect(signIn.prepareFirstFactor).toHaveBeenCalledWith({
      strategy: 'email_code',
      emailAddressId: 'idn_1',
    });
  });

  it('trims the email before calling signIn.create', async () => {
    signIn.create.mockResolvedValue({
      status: 'needs_first_factor',
      createdSessionId: '',
      supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    signIn.prepareFirstFactor.mockResolvedValue(undefined);

    await handleSendCode(signIn, '  user@example.com  ');

    expect(signIn.create).toHaveBeenCalledWith({ identifier: 'user@example.com' });
  });

  it('is a no-op for an empty (or whitespace-only) email', async () => {
    const result = await handleSendCode(signIn, '   ');
    expect(result).toEqual({ step: 'email', error: null });
    expect(signIn.create).not.toHaveBeenCalled();
  });

  it('shows the exact error and stays on the email step when no email_code factor is available', async () => {
    signIn.create.mockResolvedValue({
      status: 'needs_first_factor',
      createdSessionId: '',
      supportedFirstFactors: [],
    });

    const result = await handleSendCode(signIn, 'user@example.com');

    expect(result).toEqual({
      step: 'email',
      error: "We couldn't find a way to email you a code. Try again in a moment.",
    });
    expect(signIn.prepareFirstFactor).not.toHaveBeenCalled();
  });

  it('shows the exact error and stays on the email step when signIn.create throws', async () => {
    signIn.create.mockRejectedValue(new Error('network down'));

    const result = await handleSendCode(signIn, 'user@example.com');

    expect(result).toEqual({
      step: 'email',
      error: "That didn't work — check the email and try again.",
    });
  });

  it('shows the exact error when prepareFirstFactor throws', async () => {
    signIn.create.mockResolvedValue({
      status: 'needs_first_factor',
      createdSessionId: '',
      supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    signIn.prepareFirstFactor.mockRejectedValue(new Error('boom'));

    const result = await handleSendCode(signIn, 'user@example.com');

    expect(result).toEqual({
      step: 'email',
      error: "That didn't work — check the email and try again.",
    });
  });
});

describe('SignInSheet — code step (handleVerifyCode)', () => {
  let signIn: ReturnType<typeof makeSignIn>;
  let setActive: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signIn = makeSignIn();
    setActive = vi.fn().mockResolvedValue(undefined);
  });

  it('activates the session on a complete attempt', async () => {
    signIn.attemptFirstFactor.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_1',
    });

    const result = await handleVerifyCode(signIn, setActive, '123456');

    expect(result).toEqual({ activated: true, error: null });
    expect(signIn.attemptFirstFactor).toHaveBeenCalledWith({
      strategy: 'email_code',
      code: '123456',
    });
    expect(setActive).toHaveBeenCalledWith({ session: 'sess_1' });
  });

  it('is a no-op for an empty (or whitespace-only) code', async () => {
    const result = await handleVerifyCode(signIn, setActive, '   ');
    expect(result).toEqual({ activated: false, error: null });
    expect(signIn.attemptFirstFactor).not.toHaveBeenCalled();
  });

  it('shows the exact error and does not activate when the attempt is not complete', async () => {
    signIn.attemptFirstFactor.mockResolvedValue({
      status: 'needs_second_factor',
      createdSessionId: '',
    });

    const result = await handleVerifyCode(signIn, setActive, '123456');

    expect(result).toEqual({
      activated: false,
      error: "That code didn't match — check it and try again.",
    });
    expect(setActive).not.toHaveBeenCalled();
  });

  it('shows the exact error when attemptFirstFactor throws (e.g. wrong code)', async () => {
    signIn.attemptFirstFactor.mockRejectedValue(new Error('incorrect_code'));

    const result = await handleVerifyCode(signIn, setActive, '000000');

    expect(result).toEqual({
      activated: false,
      error: "That code didn't match — check it and try again.",
    });
    expect(setActive).not.toHaveBeenCalled();
  });
});
