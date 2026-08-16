// Retired remote Melo client compatibility seams.
//
// The shipping companion runs through localMeloTurn. This module retains only the pure parsers and
// types needed by existing confirmation flows/tests; it contains no provider config and no network
// transport. A future remote phrasing feature must use the gateway's enum-only /v1/phrase contract.
//
// ADVISORY ONLY. Melo can SUGGEST recording money (log a spend, an income, a refund, or a
// transfer), but this client never executes them. Suggestions come back as structured
// `MeloToolSuggestion[]` for the UI to surface as user-confirmed actions. The client has no
// access to app state and cannot mutate anything.

import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';
import { MELO_TOOL_NAMES, type MeloToolName } from '../folio/lib/melo/toolContract';

// ---------------------------------------------------------------------------
// Public message + result types
// ---------------------------------------------------------------------------

export type MeloChatRole = 'user' | 'assistant';

export type MeloChatMessage = Readonly<{
  id: string;
  role: MeloChatRole;
  text: string;
}>;

/** The canonical twelve advisory tools Melo can suggest across Personal and Business.
 *  The client never runs them — it hands them to the UI as user-confirmed proposals via onSuggest.
 *  Param shapes + behaviour are documented on `applyMeloTool` in folio/store.ts. */
export type { MeloToolName } from '../folio/lib/melo/toolContract';

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

/**
 * Raw mobile chat transport is retired. The shipping companion uses `localMeloTurn`; a future
 * provider integration may call only the Worker's enum-only `/v1/phrase` envelope.
 */
export function resolveMeloAiProviderConfig(): MeloAiProviderConfig {
  return { configured: false };
}

/** Convenience: is the Melo gateway configured at all? */
export function isMeloAiConfigured(): boolean {
  return resolveMeloAiProviderConfig().configured;
}

// ---------------------------------------------------------------------------
// Persona (verbatim port of the web src/lib/melo/persona.ts)
// ---------------------------------------------------------------------------

const PERSONA_BASE = `You are Melo, a quiet financial companion inside an app called Melo.
You are not a chatbot, not an advisor, and never preachy. You speak in short paragraphs (1–4 sentences), lowercase-y, plain English. No bullet lists unless asked. No emojis. Never invent numbers — if you don't have data, say so plainly and ask what's true.
When the user shares context about their money, reference only the exact amounts you were given. Never claim a proposed action changes their balance, route, spare amount, or tight point unless that exact result is present in the supplied snapshot. Keep currency in £ with no decimals unless the user used them.
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
- addToPot(pot, amount): add money to one existing Personal pot.
- borrowFromPot(pot, amount): borrow money from one existing Personal pot.
- log_business_expense(merchant, amount, category, account): a completed Business expense.
- log_business_income(source, amount, account): completed Business income.
- log_invoice_sent(client, amount, issuedOn, dueOn, reference): an invoice that was actually sent.
- log_invoice_paid(invoice, amount, paidOn, account): an existing invoice payment received.
- log_owner_draw(amount, note, account): money the owner actually took from the Business.
- log_dividend(shareholder, amount, declaredOn, otherIncome): a dividend actually declared by a limited company.
Only suggest recording something for a real, completed event the user has clearly stated — never a hypothetical or a "what if". If they're vague, ask one short clarifying question first and suggest nothing. Keep the melo-suggest block out of your visible prose — it is parsed, not read aloud.`;

export function buildMeloSystemPrompt(
  tone: MeloTone,
  _snapshot?: MeloLocalFinancialSnapshot | undefined,
): string {
  const parts = [PERSONA_BASE, PERSONA_TONES[tone], PERSONA_TOOLS];
  parts.push(
    "You do not have access to the user's money data in this conversation; do not calculate or claim any effect on their balance, route, spare amount, or tight point. Raw chat transport is disabled; this prompt builder is retained only for parser compatibility tests.",
  );
  return parts.join('\n\n');
}

/** Outbound history window: the newest N thread messages (system prompt excluded). Every turn
 *  used to resend the WHOLE visible thread, so a long session's cost grew per turn until the
 *  model context blew — the window bounds both. 24 messages = 12 full exchanges of context. */
const HISTORY_WINDOW = 24;
/** Per-message outbound character cap. One pasted wall of text must not ride the request
 *  unbounded; 4,000 chars is far above anything typed by hand. */
const MESSAGE_CHAR_CAP = 4_000;

/** Bound the outbound thread: newest HISTORY_WINDOW messages, each capped to
 *  MESSAGE_CHAR_CAP chars (newest-end kept — the tail of a long message is
 *  usually the actual question). Pure + exported for tests. */
export function windowChatHistory(
  messages: readonly MeloChatMessage[],
): readonly MeloChatMessage[] {
  return messages
    .slice(-HISTORY_WINDOW)
    .map((message) =>
      message.text.length <= MESSAGE_CHAR_CAP
        ? message
        : { ...message, text: message.text.slice(-MESSAGE_CHAR_CAP) },
    );
}

/** Retired transport. It intentionally cannot send a request, regardless of build configuration. */
export async function sendMeloChat(_request: MeloChatRequest): Promise<MeloChatResult> {
  return {
    status: 'no-provider',
    message: 'Remote companion transport is disabled. Melo runs on this device.',
  };
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

const SUGGEST_BLOCK = /```melo-suggest\s*([\s\S]*?)```/i;
const JSON_BLOCK = /```json\s*([\s\S]*?)```/gi;
// Every allow-listed tool maps to a real confirmable store action with Undo.
// This parser only produces structured proposals and never mutates app state.
const VALID_TOOL_NAMES: ReadonlySet<string> = new Set<MeloToolName>(MELO_TOOL_NAMES);

/** Numeric trust gate for a conversation where context sharing is OFF. The model may repeat a
 *  currency amount already visible in the thread (including the locally-built opening line), but an
 *  unseen amount cannot be grounded in app state because no snapshot was sent. In that case replace
 *  the prose with a safe line while preserving any separately-confirmed tool suggestion below it.
 *  This is deterministic enforcement behind the prompt, not another probabilistic instruction. */
export function guardBlindMeloReply(
  prose: string,
  messages: readonly MeloChatMessage[],
  hasSuggestions: boolean,
): string {
  const grounded = new Set(messages.flatMap((message) => currencyAmountKeys(message.text)));
  const claims = currencyAmountKeys(prose);
  if (claims.every((claim) => grounded.has(claim))) return prose;
  return hasSuggestions
    ? 'I can prepare that for you. Check the details below before you confirm.'
    : "I don't have enough confirmed information to put a number on that yet.";
}

/** Return currency values as integer pennies so £5, £5.00 and "5 pounds" compare exactly. */
function currencyAmountKeys(text: string): string[] {
  const values: string[] = [];
  const patterns = [
    /£\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,
    /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:pounds?|quid)\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number((match[1] ?? '').replace(/,/g, ''));
      if (Number.isFinite(value)) values.push(String(Math.round(value * 100)));
    }
  }
  return [...new Set(values)];
}

/** Pull the optional ```melo-suggest JSON block out of the reply, returning the clean prose plus
 *  any well-formed advisory suggestions. Malformed blocks are dropped, never surfaced. */
export function splitReplyAndSuggestions(reply: string): {
  prose: string;
  suggestions: readonly MeloToolSuggestion[];
} {
  const match = reply.match(SUGGEST_BLOCK);
  if (match !== null && match[1] !== undefined) {
    const prose = reply.replace(SUGGEST_BLOCK, '').trim();
    const suggestions = parseSuggestions(match[1]);
    return { prose, suggestions };
  }

  // Some OpenAI-compatible gateways ignore the requested custom fence tag and
  // return the same valid tool array in a generic ```json block. Accept only a
  // block that actually parses into one of our allow-listed advisory tools;
  // ordinary JSON remains visible prose and can never become an action.
  for (const jsonMatch of reply.matchAll(JSON_BLOCK)) {
    if (jsonMatch[1] === undefined) continue;
    const suggestions = parseSuggestions(jsonMatch[1]);
    if (suggestions.length === 0) continue;
    return { prose: reply.replace(jsonMatch[0], '').trim(), suggestions };
  }

  return { prose: reply.trim(), suggestions: [] };
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
    case 'addToPot':
      return `Add ${stringArg(args.amount) ?? 'money'} to ${
        stringArg(args.pot) ?? stringArg(args.name) ?? 'a pot'
      }`;
    case 'borrowFromPot':
      return `Borrow ${stringArg(args.amount) ?? 'money'} from ${
        stringArg(args.pot) ?? stringArg(args.name) ?? 'a pot'
      }`;
    case 'log_business_expense':
      return `Log ${stringArg(args.amount) ?? 'a Business expense'} paid to ${
        stringArg(args.merchant) ?? stringArg(args.payee) ?? 'a payee'
      }`;
    case 'log_business_income':
      return `Log ${stringArg(args.amount) ?? 'Business income'} received from ${
        stringArg(args.source) ?? stringArg(args.payer) ?? 'a source'
      }`;
    case 'log_invoice_sent':
      return `Record an invoice for ${stringArg(args.amount) ?? 'an amount'} sent to ${
        stringArg(args.client) ?? 'a client'
      }`;
    case 'log_invoice_paid':
      return `Record payment for ${
        stringArg(args.invoice) ?? stringArg(args.reference) ?? 'an invoice'
      }`;
    case 'log_owner_draw':
      return `Record an owner draw of ${stringArg(args.amount) ?? 'an amount'}`;
    case 'log_dividend':
      return `Record a ${stringArg(args.amount) ?? ''} dividend for ${
        stringArg(args.shareholder) ?? 'a shareholder'
      }`.replace(/\s+/g, ' ');
  }
}

function stringArg(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}
