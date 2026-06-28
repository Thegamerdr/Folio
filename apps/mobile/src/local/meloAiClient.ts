// Provider-agnostic AI client for Melo (RN port of the web /api/melo-chat route).
//
// THE SEAM, NOT THE KEY. This module reads its provider config from the app's public
// Expo config (EXPO_PUBLIC_AI_BASE_URL / EXPO_PUBLIC_AI_MODEL) and takes the secret key
// at RUNTIME from the caller — the owner supplies it later. Nothing here hard-codes a key
// or a vendor. When no provider is configured the client returns a clear, non-fatal
// `no-provider` state so the sheet can show "No AI provider configured" instead of crashing.
//
// It speaks the OpenAI-compatible Chat Completions shape (`POST {baseUrl}/chat/completions`),
// which most providers (OpenAI, Together, Groq, OpenRouter, a local llama.cpp/Ollama proxy,
// an Azure/OpenAI-compatible gateway, …) expose. Swapping providers is a config change, not
// a code change.
//
// ADVISORY ONLY. Melo can SUGGEST tool moves (pause a sub, move between pots, set a tight-point
// goal, log a spend), but this client never executes them. Suggestions come back as structured
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

/** The four advisory tools Melo can SUGGEST (verbatim from the web persona). The client never
 *  runs them — it hands them to the UI as user-confirmed proposals via onSuggest. */
export type MeloToolName =
  | 'pause_subscription'
  | 'move_between_pots'
  | 'set_tight_point_goal'
  | 'log_spend';

export type MeloToolSuggestion = Readonly<{
  id: string;
  name: MeloToolName;
  /** Raw arguments the model proposed. The UI validates + confirms before anything happens. */
  args: Readonly<Record<string, unknown>>;
  /** A one-line, human-readable description of the proposed move for the confirm chip. */
  summary: string;
}>;

/** Melo's voice tone — the web persona's four modes. */
export type MeloTone = 'calm' | 'honest' | 'dry' | 'coachy';

/** The provider config resolved from app config. `configured: false` means no AI provider is set. */
export type MeloAiProviderConfig =
  | Readonly<{ configured: false }>
  | Readonly<{ configured: true; baseUrl: string; model: string }>;

/** The result of a chat turn. A discriminated union so the sheet renders the right state. */
export type MeloChatResult =
  | Readonly<{ status: 'ok'; reply: string; suggestions: readonly MeloToolSuggestion[] }>
  | Readonly<{ status: 'no-provider'; message: string }>
  | Readonly<{ status: 'no-key'; message: string }>
  | Readonly<{ status: 'error'; message: string }>;

export type MeloChatRequest = Readonly<{
  /** The full visible thread (user + assistant turns). Most recent last. */
  messages: readonly MeloChatMessage[];
  tone: MeloTone;
  /** Pass the snapshot ONLY when the user has turned on "let Melo see my money". Undefined = blind. */
  snapshot?: MeloLocalFinancialSnapshot | undefined;
  /** The secret API key, supplied at runtime by the owner/host — never read from a bundled constant. */
  apiKey?: string | undefined;
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

/** Resolve the provider config from app config. Pure read — no network, no key. */
export function resolveMeloAiProviderConfig(): MeloAiProviderConfig {
  const baseUrl = readPublicExtra('EXPO_PUBLIC_AI_BASE_URL');
  const model = readPublicExtra('EXPO_PUBLIC_AI_MODEL');
  if (baseUrl === undefined || model === undefined) {
    return { configured: false };
  }
  return { configured: true, baseUrl: stripTrailingSlash(baseUrl), model };
}

/** Convenience: is an AI provider configured at all? (Key may still be missing at runtime.) */
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
const PERSONA_TOOLS = `You can SUGGEST four moves. You never perform them — the user confirms each one in the app, and only then does anything change. To suggest a move, end your reply with ONE fenced code block tagged melo-suggest containing a JSON array of suggestions, each {"name": <tool>, "args": {…}, "summary": <one short line>}:
- pause_subscription(name, cycles=1): suggest pausing a recurring sub. Use the exact name from the snapshot.
- move_between_pots(from, to, amount): suggest shifting money between pots. Never suggest more than the source pot's saved balance.
- set_tight_point_goal(amount): suggest a floor £ to hold at the tightest point of the month.
- log_spend(merchant, amount, category): suggest recording a spend the user just told you about. Only for a real, completed spend — never a hypothetical.
Only suggest a move after the user has clearly agreed to the specific change. If they're vague, ask one short clarifying question first and suggest nothing. Keep the melo-suggest block out of your visible prose — it is parsed, not read aloud.`;

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
  } else {
    parts.push(
      "You do not have access to the user's money data in this conversation. If they ask numerical questions, ask them to enable sharing or to tell you the number.",
    );
  }
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// OpenAI-compatible chat call
// ---------------------------------------------------------------------------

type OpenAiChatMessage = Readonly<{ role: 'system' | 'user' | 'assistant'; content: string }>;

/** Send one chat turn to the configured provider. Returns a discriminated result — never throws
 *  for the expected failure modes (no provider, no key, network/HTTP error). */
export async function sendMeloChat(request: MeloChatRequest): Promise<MeloChatResult> {
  const config = resolveMeloAiProviderConfig();
  if (!config.configured) {
    return {
      status: 'no-provider',
      message:
        'No AI provider configured. Set EXPO_PUBLIC_AI_BASE_URL and EXPO_PUBLIC_AI_MODEL, then supply a key.',
    };
  }

  const apiKey = request.apiKey?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    return {
      status: 'no-key',
      message: 'AI provider is configured, but no API key was supplied for this session.',
    };
  }

  const payloadMessages: OpenAiChatMessage[] = [
    { role: 'system', content: buildMeloSystemPrompt(request.tone, request.snapshot) },
    ...request.messages.map<OpenAiChatMessage>((message) => ({
      role: message.role,
      content: message.text,
    })),
  ];

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
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
        message: `Melo's provider returned ${response.status}.${detail ? ` ${detail}` : ''}`,
      };
    }

    const data: unknown = await response.json();
    const rawReply = extractAssistantText(data);
    if (rawReply === null) {
      return { status: 'error', message: "Melo's provider sent an unexpected response." };
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
const VALID_TOOL_NAMES: ReadonlySet<string> = new Set<MeloToolName>([
  'pause_subscription',
  'move_between_pots',
  'set_tight_point_goal',
  'log_spend',
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
    case 'pause_subscription':
      return `Pause ${stringArg(args.name) ?? 'a subscription'}`;
    case 'move_between_pots':
      return `Move ${stringArg(args.amount) ?? 'money'} from ${
        stringArg(args.from) ?? 'one pot'
      } to ${stringArg(args.to) ?? 'another'}`;
    case 'set_tight_point_goal':
      return `Set a tight-point goal of ${stringArg(args.amount) ?? 'an amount'}`;
    case 'log_spend':
      return `Log ${stringArg(args.amount) ?? 'a spend'} at ${stringArg(args.merchant) ?? 'a merchant'}`;
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
