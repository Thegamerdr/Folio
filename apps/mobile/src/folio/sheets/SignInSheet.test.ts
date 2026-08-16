import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthFlow = 'sign_in' | 'sign_up';
type EmailFactor = { strategy: 'email_code'; emailAddressId: string };
type Attempt = {
  status: string;
  createdSessionId: string | null;
  supportedFirstFactors?: EmailFactor[] | null;
};

function makeSignIn() {
  return {
    create: vi.fn<(args: { identifier: string }) => Promise<Attempt>>(),
    prepareFirstFactor: vi.fn<(args: unknown) => Promise<unknown>>(),
    attemptFirstFactor: vi.fn<(args: unknown) => Promise<Attempt>>(),
  };
}

function makeSignUp() {
  const prepareEmailAddressVerification = vi.fn<(args: unknown) => Promise<unknown>>();
  return {
    create:
      vi.fn<
        (args: {
          emailAddress: string;
        }) => Promise<{ prepareEmailAddressVerification: typeof prepareEmailAddressVerification }>
      >(),
    prepareEmailAddressVerification,
    attemptEmailAddressVerification: vi.fn<(args: { code: string }) => Promise<Attempt>>(),
  };
}

async function beginEmailAuth(
  signIn: ReturnType<typeof makeSignIn>,
  signUp: ReturnType<typeof makeSignUp>,
  email: string,
  isIdentifierNotFound: (error: unknown) => boolean,
): Promise<{ step: 'email' | 'code'; flow: AuthFlow; error: string | null }> {
  const trimmed = email.trim();
  if (!trimmed) return { step: 'email', flow: 'sign_in', error: null };

  try {
    const attempt = await signIn.create({ identifier: trimmed });
    const factor = attempt.supportedFirstFactors?.find((item) => item.strategy === 'email_code');
    if (!factor) {
      return {
        step: 'email',
        flow: 'sign_in',
        error: 'We could not find a way to email you a code. Give it a moment, then retry.',
      };
    }
    await signIn.prepareFirstFactor({
      strategy: 'email_code',
      emailAddressId: factor.emailAddressId,
    });
    return { step: 'code', flow: 'sign_in', error: null };
  } catch (error) {
    if (!isIdentifierNotFound(error)) {
      return { step: 'email', flow: 'sign_in', error: 'Check the email address and retry.' };
    }

    try {
      const attempt = await signUp.create({ emailAddress: trimmed });
      await attempt.prepareEmailAddressVerification({ strategy: 'email_code' });
      return { step: 'code', flow: 'sign_up', error: null };
    } catch {
      return {
        step: 'email',
        flow: 'sign_in',
        error: 'We could not start your account. Check the email address and retry.',
      };
    }
  }
}

async function verifyEmailAuth(
  flow: AuthFlow,
  signIn: ReturnType<typeof makeSignIn>,
  signUp: ReturnType<typeof makeSignUp>,
  setActive: (args: { session: string }) => Promise<void>,
  code: string,
): Promise<{ activated: boolean; error: string | null }> {
  const trimmed = code.trim();
  if (!trimmed) return { activated: false, error: null };

  try {
    const attempt =
      flow === 'sign_up'
        ? await signUp.attemptEmailAddressVerification({ code: trimmed })
        : await signIn.attemptFirstFactor({ strategy: 'email_code', code: trimmed });
    if (attempt.status === 'complete' && attempt.createdSessionId) {
      await setActive({ session: attempt.createdSessionId });
      return { activated: true, error: null };
    }
    return {
      activated: false,
      error: 'Your account needs more information before Melo can sign you in.',
    };
  } catch {
    return { activated: false, error: 'That code did not match. Check it and retry.' };
  }
}

describe('SignInSheet email sign-in-or-up contract', () => {
  let signIn: ReturnType<typeof makeSignIn>;
  let signUp: ReturnType<typeof makeSignUp>;
  const notFound = { code: 'form_identifier_not_found' };
  const isIdentifierNotFound = (error: unknown) => error === notFound;

  beforeEach(() => {
    signIn = makeSignIn();
    signUp = makeSignUp();
  });

  it('prepares an email code for an existing user', async () => {
    signIn.create.mockResolvedValue({
      status: 'needs_first_factor',
      createdSessionId: null,
      supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });

    const result = await beginEmailAuth(signIn, signUp, ' user@example.com ', isIdentifierNotFound);

    expect(result).toEqual({ step: 'code', flow: 'sign_in', error: null });
    expect(signIn.create).toHaveBeenCalledWith({ identifier: 'user@example.com' });
    expect(signIn.prepareFirstFactor).toHaveBeenCalledWith({
      strategy: 'email_code',
      emailAddressId: 'idn_1',
    });
    expect(signUp.create).not.toHaveBeenCalled();
  });

  it('creates a new account only when Clerk reports identifier-not-found', async () => {
    signIn.create.mockRejectedValue(notFound);
    signUp.create.mockResolvedValue({
      prepareEmailAddressVerification: signUp.prepareEmailAddressVerification,
    });

    const result = await beginEmailAuth(signIn, signUp, 'new@example.com', isIdentifierNotFound);

    expect(result).toEqual({ step: 'code', flow: 'sign_up', error: null });
    expect(signUp.create).toHaveBeenCalledWith({ emailAddress: 'new@example.com' });
    expect(signUp.prepareEmailAddressVerification).toHaveBeenCalledWith({
      strategy: 'email_code',
    });
  });

  it('does not convert network or configuration failures into sign-up attempts', async () => {
    signIn.create.mockRejectedValue(new Error('network down'));

    const result = await beginEmailAuth(signIn, signUp, 'user@example.com', isIdentifierNotFound);

    expect(result.error).toBe('Check the email address and retry.');
    expect(signUp.create).not.toHaveBeenCalled();
  });

  it('keeps empty email submissions local and idle', async () => {
    const result = await beginEmailAuth(signIn, signUp, '   ', isIdentifierNotFound);
    expect(result).toEqual({ step: 'email', flow: 'sign_in', error: null });
    expect(signIn.create).not.toHaveBeenCalled();
  });
});

describe('SignInSheet verification contract', () => {
  let signIn: ReturnType<typeof makeSignIn>;
  let signUp: ReturnType<typeof makeSignUp>;
  let setActive: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signIn = makeSignIn();
    signUp = makeSignUp();
    setActive = vi.fn().mockResolvedValue(undefined);
  });

  it.each(['sign_in', 'sign_up'] as const)('activates a complete %s session', async (flow) => {
    const attempt = { status: 'complete', createdSessionId: `sess_${flow}` };
    signIn.attemptFirstFactor.mockResolvedValue(attempt);
    signUp.attemptEmailAddressVerification.mockResolvedValue(attempt);

    const result = await verifyEmailAuth(flow, signIn, signUp, setActive, '424242');

    expect(result).toEqual({ activated: true, error: null });
    expect(setActive).toHaveBeenCalledWith({ session: `sess_${flow}` });
  });

  it('does not activate incomplete account creation', async () => {
    signUp.attemptEmailAddressVerification.mockResolvedValue({
      status: 'missing_requirements',
      createdSessionId: null,
    });

    const result = await verifyEmailAuth('sign_up', signIn, signUp, setActive, '424242');

    expect(result.error).toBe('Your account needs more information before Melo can sign you in.');
    expect(setActive).not.toHaveBeenCalled();
  });

  it('surfaces invalid codes without activating a session', async () => {
    signIn.attemptFirstFactor.mockRejectedValue(new Error('incorrect_code'));

    const result = await verifyEmailAuth('sign_in', signIn, signUp, setActive, '000000');

    expect(result.error).toBe('That code did not match. Check it and retry.');
    expect(setActive).not.toHaveBeenCalled();
  });
});
