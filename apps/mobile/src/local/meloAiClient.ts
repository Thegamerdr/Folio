// AI client for Melo (RN port of the web /api/melo-chat route).
//
// KEYLESS BY DESIGN. This client holds NO provider key. It talks to Folio's own standalone
// gateway (a Cloudflare Worker at `services/ai-gateway`) which holds the OpenRouter key as a
// server-side secret and forwards to the model. The app only knows the gateway's URL
// (EXPO_PUBLIC_MELO_GATEWAY_URL) and a weak shared token (EXPO_PUBLIC_MELO_GATEWAY_TOKEN) sent
// in the `x-folio-gateway-token` header. The real secret never ships in the APK, and the app
// depends on no Lovable / web-app infrastructure. When no gateway URL is configured the client
// returns a clear, non-fatal `no-provider` state so the sheet can show "Melo isn't configured
// yet" instead of crashing.
//
// It speaks the OpenAI-compatible Chat Completions shape (`POST {gatewayUrl}/chat/completions`).
// The gateway accepts that exact shape, so swapping the upstream model/provider is a gateway
// config change, not an app change.
//
// ADVISORY ONLY. Melo can SUGGEST recording money (log a spend, an income, a refund, or a
// transfer), but this client never executes them. Suggestions come back as structured
// `MeloToolSuggestion[]` for the UI to surface as user-confirmed actions. The client has no
// access to app state and cannot mutate anything.

import Constants from 'expo-constants';
import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';

// ---------------------------------------------------------------------------
// Public message + result types
// ---------------------------------------------------------------------------

export type MeloChatRole = 'user' | 'assistant';

export type MeloChatMessage = Readonly<{
  id: string;
  role: MeloChatRole;
  text: string;
}>;

/** The four advisory tools Melo can SUGGEST — the log_* family (record money as a transaction).
 *  The client never runs them — it hands them to the UI as user-confirmed proposals via onSuggest.
 *  Param shapes + behaviour are documented on `applyMeloTool` in folio/store.ts. */
export type MeloToolName = 'log_spend' | 'log_income' | 'log_refund' | 'log_transfer';

export type MeloToolSuggestion = Readonly<{
  id: string;
  name: MeloToolName;
  /** Raw arguments the model proposed. The UI validates + confirms before anything happens. */
  args: Readonly<Record<string, unknown>>;
  /** A one-line, human-readable description of the proposed move for the confirm chip. */
  summary: string;
}>;

/** A thing a suggestion can target by name (a subscription or a pot). */
export type NamedTarget = Readonly<{ id: string; name: string }>;

/** Normalise a name for tolerant comparison: lowercased, trimmed, internal runs of whitespace and
 *  punctuation collapsed away. So "Net flix", "netflix" and " Netflix! " all compare equal. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Resolve a model-proposed name against the user's real targets, tolerantly. The model can be
 *  slightly off ("Net flix" vs the stored "Netflix"), so this matches in ranked order:
 *  exact (normalised) → one side contains the other → returns undefined if nothing is close enough.
 *  Returning undefined (rather than silently doing nothing) is what lets the UI tell the user the
 *  target couldn't be found instead of a chip no-op. */
export function resolveNamedTarget(
  query: string,
  candidates: readonly NamedTarget[],
): NamedTarget | undefined {
  const wanted = normalizeName(query);
  if (wanted.length === 0) return undefined;

  // 1. Exact (normalised) match wins outright.
  const exact = candidates.find((candidate) => normalizeName(candidate.name) === wanted);
  if (exact !== undefined) return exact;

  // 2. Containment either way — "spotify premium" matches a stored "Spotify", and vice versa. Pick
  //    the shortest matching candidate name so the most specific stored name wins.
  const contained = candidates
    .filter((candidate) => {
      const candidateName = normalizeName(candidate.name);
      if (candidateName.length === 0) return false;
      return candidateName.includes(wanted) || wanted.includes(candidateName);
    })
    .sort((left, right) => normalizeName(left.name).length - normalizeName(right.name).length);

  return contained[0];
}

/** Melo's voice tone — the web persona's four modes. */
export type MeloTone = 'calm' | 'honest' | 'dry' | 'coachy';

/** The gateway config resolved from app config. `configured: false` means the gateway URL is unset. */
export type MeloAiProviderConfig =
  | Readonly<{ configured: false }>
  | Readonly<{ configured: true; gatewayUrl: string; token: string | undefined }>;

/** The result of a chat turn. A discriminated union so the sheet renders the right state. */
export type MeloChatResult =
  | Readonly<{ status: 'ok'; reply: string; suggestions: readonly MeloToolSuggestion[] }>
  | Readonly<{ status: 'no-provider'; message: string }>
  | Readonly<{ status: 'error'; message: string }>;

export type MeloChatRequest = Readonly<{
  /** The full visible thread (user + assistant turns). Most recent last. */
  messages: readonly MeloChatMessage[];
  tone: MeloTone;
  /** Pass the snapshot ONLY when the user has turned on "let Melo see my money". Undefined = blind. */
  snapshot?: MeloLocalFinancialSnapshot | undefined;
  /** Optional abort signal so the sheet can cancel an in-flight turn. */
  signal?: AbortSignal | undefined;
}>;

// ---------------------------------------------------------------------------
// Config resolution (public Expo config only — no secrets)
// ---------------------------------------------------------------------------

function readPublicExtra(key: string): string | undefined {
  // EXPO_PUBLIC_* env vars are inlined into process.env at build time and also surface on
  // expoConfig.extra in some setups. Read both, prefer the explicit env var, and treat empty
  // strings as unset.
  const fromEnv = (process.env as Record<string, string | undefined>)[key];
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const fromExtra = typeof extra[key] === 'string' ? (extra[key] as string) : undefined;
  const value = (fromEnv ?? fromExtra ?? '').trim();
  return value.length > 0 ? value : undefined;
}

/** The deployed gateway this build ships against by default. An env var (EXPO_PUBLIC_*) or
 *  app.config `extra` overrides it — but those are unreliable in the gradle RELEASE bundle (it
 *  inlines neither process.env nor expoConfig.extra dependably), so these source literals are the
 *  always-present fallback (a string literal is always in the JS bundle). URL + a WEAK shared token
 *  only; the real OpenRouter key is a Cloudflare Worker secret and never reaches the app. */
const DEFAULT_GATEWAY_URL = 'https://folio-ai-gateway.tgdroppin.workers.dev/v1';
const DEFAULT_GATEWAY_TOKEN = 'folio-local-38cf0d6da78a33a51382b91cafe0a7f2';

/** Resolve the gateway config. Pure read — no network, no key. Prefers an explicit env/extra
 *  override, else the deployed default above, so a shipped build is always configured. The token is
 *  optional: a gateway with no GATEWAY_TOKEN set accepts requests without the header. */
export function resolveMeloAiProviderConfig(): MeloAiProviderConfig {
  const gatewayUrl = readPublicExtra('EXPO_PUBLIC_MELO_GATEWAY_URL') ?? DEFAULT_GATEWAY_URL;
  return {
    configured: true,
    gatewayUrl: stripTrailingSlash(gatewayUrl),
    token: readPublicExtra('EXPO_PUBLIC_MELO_GATEWAY_TOKEN') ?? DEFAULT_GATEWAY_TOKEN,
  };
}

/** Convenience: is the Melo gateway configured at all? */
export function isMeloAiConfigured(): boolean {
  return resolveMeloAiProviderConfig().configured;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// ---------------------------------------------------------------------------
// Persona (verbatim port of the web src/lib/melo/persona.ts)
// ---------------------------------------------------------------------------

const PERSONA_BASE = `You are Melo, a quiet financial companion inside an app called Folio.
You are not a chatbot, not an advisor, and never preachy. You speak in short paragraphs (1–4 sentences), lowercase-y, plain English. No bullet lists unless asked. No emojis. Never invent numbers — if you don't have data, say so plainly and ask what's true.
When the user shares context about their money, reference it specifically (e.g. "that pulls your tight point down to around £42"). Keep currency in £ with no decimals unless the user used them.
You can be quarrelled with. If the user pushes back, listen, don't capitulate just to please.`;

const PERSONA_TONES: Readonly<Record<MeloTone, string>> = {
  calm: 'Tone: calm, supportive, unhurried. Never alarmist. Never cheerful for its own sake.',
  honest:
    'Tone: warm but honest. If the user is justifying a bad spend, gently name it. You have a spine.',
  dry: "Tone: calm with occasional understated wit. Never jokey, never sarcastic at the user's expense.",
  coachy:
    'Tone: ask one good question back instead of answering directly, unless the user clearly wants an answer.',
};

// Melo's moves stay ADVISORY: she proposes, the user confirms in the app. The model is told to
// emit a suggestion (not execute) by appending a single fenced ```melo-suggest JSON block — the
// client parses it out of the reply and hands it to the UI as a confirm chip.
const PERSONA_TOOLS = `You can SUGGEST recording money the user just told you about. You never perform it — the user confirms each one in the app, and only then is anything recorded. To suggest one, end your reply with ONE fenced code block tagged melo-suggest containing a JSON array of suggestions, each {"name": <tool>, "args": {…}, "summary": <one short line>}:
- log_spend(merchant, amount, category): a spend that just happened (money out). amount is a positive number of £; category is one of food, transport, fun, bills, shopping, other.
- log_income(merchant, amount, category): money in — a wage, a payment received, a top-up. merchant is who it came from; amount is a positive number of £; category is optional.
- log_refund(merchant, amount, original): a refund coming back (money in). merchant is who refunded; amount is a positive number of £; original is optional — the original merchant or purchase it relates to, so the two can be linked. Do not decide whether it cancels out a spend; just record the refund.
- log_transfer(from, to, amount): the user's own money moving between their accounts/places (not a spend, not income). from and to are the names they used; amount is a positive number of £.
Only suggest recording something for a real, completed event the user has clearly stated — never a hypothetical or a "what if". If they're vague, ask one short clarifying question first and suggest nothing. Keep the melo-suggest block out of your visible prose — it is parsed, not read aloud.`;

export function buildMeloSystemPrompt(
  tone: MeloTone,
  snapshot?: MeloLocalFinancialSnapshot | undefined,
): string {
  const parts = [PERSONA_BASE, PERSONA_TONES[tone], PERSONA_TOOLS];
  if (snapshot) {
    parts.push(
      `Here is the user's current money snapshot (JSON). Treat as ground truth; do not make up other numbers:\n${JSON.stringify(
        snapshot,
        null,
        2,
      )}`,
    );
    // The snapshot carries the user's own subscription + pot names. Surface them so Melo can refer
    // to the user's real money by name (e.g. naming a pot as a log_transfer endpoint) instead of
    // inventing one.
    const names = describeSnapshotNames(snapshot);
    if (names !== undefined) {
      parts.push(names);
    }
  } else {
    parts.push(
      "You do not have access to the user's money data in this conversation. If they ask numerical questions, ask them to enable sharing or to tell you the number.",
    );
  }
  return parts.join('\n\n');
}

/** Build a short instruction naming the user's subscriptions + pots so Melo refers to them by their
 *  real names. Returns undefined when the snapshot carries no names (nothing to reference). */
function describeSnapshotNames(snapshot: MeloLocalFinancialSnapshot): string | undefined {
  const subscriptions = (snapshot.subscriptionNames ?? []).filter((name) => name.trim().length > 0);
  const pots = (snapshot.potNames ?? []).filter((name) => name.trim().length > 0);
  if (subscriptions.length === 0 && pots.length === 0) {
    return undefined;
  }
  const lines = [
    'When you refer to the user’s subscriptions or pots, use the user’s exact names from these lists — copy a name verbatim, do not invent or rephrase one.',
  ];
  if (subscriptions.length > 0) {
    lines.push(`Their subscriptions: ${subscriptions.join(', ')}.`);
  }
  if (pots.length > 0) {
    lines.push(`Their pots: ${pots.join(', ')}.`);
  }
  return lines.join(' ');
}

// ---------------------------------------------------------------------------
// OpenAI-compatible chat call
// ---------------------------------------------------------------------------

type OpenAiChatMessage = Readonly<{ role: 'system' | 'user' | 'assistant'; content: string }>;

/** Send one chat turn through Folio's Melo gateway. Returns a discriminated result — never throws
 *  for the expected failure modes (no gateway configured, network/HTTP error). The gateway holds
 *  the real provider key; this client sends only the shared token (when configured). */
export async function sendMeloChat(request: MeloChatRequest): Promise<MeloChatResult> {
  const config = resolveMeloAiProviderConfig();
  if (!config.configured) {
    return {
      status: 'no-provider',
      message:
        "Melo isn't configured yet. Set EXPO_PUBLIC_MELO_GATEWAY_URL to your deployed gateway and rebuild.",
    };
  }

  const payloadMessages: OpenAiChatMessage[] = [
    { role: 'system', content: buildMeloSystemPrompt(request.tone, request.snapshot) },
    ...request.messages.map<OpenAiChatMessage>((message) => ({
      role: message.role,
      content: message.text,
    })),
  ];

  // COST SPLIT: chat pins a CHEAP text model. The expensive vision/file model (gemini-2.5-flash) is
  // reserved for PDF/photo EXTRACTION (statementReaderClient); chat is high-volume and must not ride
  // the pricey vision tier. The gateway forwards this model verbatim and only allows the approved
  // chat/vision models (services/ai-gateway), so a leaked token can't request a costlier one.
  const CHAT_MODEL = 'google/gemini-2.5-flash-lite';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.token !== undefined) {
    headers['x-folio-gateway-token'] = config.token;
  }
  // Anonymous install id for the gateway's abuse metering. Lazily imported so this module stays
  // Node-safe for its tests (deviceId pulls expo modules); any failure omits the header and the
  // gateway falls back to its coarser IP backstop.
  try {
    const { getDeviceId } = await import('./deviceId');
    const deviceId = await getDeviceId();
    if (deviceId !== null) headers['x-folio-device'] = deviceId;
  } catch {
    /* header omitted. */
  }

  try {
    const response = await fetch(`${config.gatewayUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: payloadMessages,
        temperature: 0.6,
        stream: false,
      }),
      ...(request.signal ? { signal: request.signal } : {}),
    });

    if (!response.ok) {
      const detail = await safeReadErrorBody(response);
      return {
        status: 'error',
        message: `Melo's gateway returned ${response.status}.${detail ? ` ${detail}` : ''}`,
      };
    }

    const data: unknown = await response.json();
    const rawReply = extractAssistantText(data);
    if (rawReply === null) {
      return { status: 'error', message: "Melo's gateway sent an unexpected response." };
    }

    const { prose, suggestions } = splitReplyAndSuggestions(rawReply);
    return { status: 'ok', reply: prose, suggestions };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'error', message: 'Cancelled.' };
    }
    return { status: 'error', message: `Couldn't reach Melo just now. ${errorMessage(error)}` };
  }
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function extractAssistantText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = first?.message?.content;
  return typeof content === 'string' ? content : null;
}

const SUGGEST_BLOCK = /```melo-suggest\s*([\s\S]*?)```/i;
// The four log_* tools each map to a REAL, confirmable action: the store's applyMeloTool records the
// money as a Transaction (a spend, an inflow, a refund, or a paired transfer), each with undo. The
// set is the full MeloToolName union; nothing is withheld. Pot moves are NOT a Melo tool here.
const VALID_TOOL_NAMES: ReadonlySet<string> = new Set<MeloToolName>([
  'log_spend',
  'log_income',
  'log_refund',
  'log_transfer',
]);

/** Pull the optional ```melo-suggest JSON block out of the reply, returning the clean prose plus
 *  any well-formed advisory suggestions. Malformed blocks are dropped, never surfaced. */
export function splitReplyAndSuggestions(reply: string): {
  prose: string;
  suggestions: readonly MeloToolSuggestion[];
} {
  const match = reply.match(SUGGEST_BLOCK);
  if (match === null || match[1] === undefined) {
    return { prose: reply.trim(), suggestions: [] };
  }

  const prose = reply.replace(SUGGEST_BLOCK, '').trim();
  const suggestions = parseSuggestions(match[1]);
  return { prose, suggestions };
}

function parseSuggestions(jsonText: string): readonly MeloToolSuggestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText.trim());
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const suggestions: MeloToolSuggestion[] = [];
  parsed.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null) return;
    const candidate = entry as { name?: unknown; args?: unknown; summary?: unknown };
    if (typeof candidate.name !== 'string' || !VALID_TOOL_NAMES.has(candidate.name)) return;
    const args =
      typeof candidate.args === 'object' &&
      candidate.args !== null &&
      !Array.isArray(candidate.args)
        ? (candidate.args as Record<string, unknown>)
        : {};
    const summary =
      typeof candidate.summary === 'string' && candidate.summary.trim().length > 0
        ? candidate.summary.trim()
        : describeSuggestion(candidate.name as MeloToolName, args);
    suggestions.push({
      id: `suggest-${Date.now()}-${index}`,
      name: candidate.name as MeloToolName,
      args,
      summary,
    });
  });
  return suggestions;
}

/** A safe default summary if the model omits one. */
function describeSuggestion(name: MeloToolName, args: Record<string, unknown>): string {
  switch (name) {
    case 'log_spend':
      return `Log ${stringArg(args.amount) ?? 'a spend'} at ${stringArg(args.merchant) ?? 'a merchant'}`;
    case 'log_income':
      return `Log ${stringArg(args.amount) ?? 'money'} in from ${
        stringArg(args.merchant) ?? stringArg(args.source) ?? 'a source'
      }`;
    case 'log_refund':
      return `Log a ${stringArg(args.amount) ?? ''} refund from ${
        stringArg(args.merchant) ?? 'a merchant'
      }`.replace(/\s+/g, ' ');
    case 'log_transfer':
      return `Log a ${stringArg(args.amount) ?? ''} transfer from ${
        stringArg(args.from) ?? 'one place'
      } to ${stringArg(args.to) ?? 'another'}`.replace(/\s+/g, ' ');
  }
}

function stringArg(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

async function safeReadErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return '';
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error.';
}
