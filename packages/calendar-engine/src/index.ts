import {
  createLocalDateTime,
  createTimeZoneId,
  type LocalDateTime,
  type TimeZoneId,
} from '@folio/domain';

export const calendarEngineBoundary = {
  packageName: '@folio/calendar-engine',
  deterministic: true,
  importsNativeOrUiRuntime: false,
} as const;

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type ParsedRRule = Readonly<{
  frequency: RecurrenceFrequency;
  count?: number;
  interval: number;
  until?: string;
}>;

export type BoundedRecurrenceInput = Readonly<{
  dtstart: string | LocalDateTime;
  timeZone: string | TimeZoneId;
  rrule: string;
  rdate?: readonly (string | LocalDateTime)[];
  exdate?: readonly (string | LocalDateTime)[];
  windowStart?: string;
  windowEnd?: string;
  maxOccurrences?: number;
}>;

export type RecurrenceOccurrence = Readonly<{
  local: LocalDateTime;
  utc: string;
  timeZone: TimeZoneId;
  source: 'rrule' | 'rdate';
}>;

type LocalParts = Readonly<{
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}>;

const supportedRRuleKeys = new Set(['FREQ', 'COUNT', 'INTERVAL', 'UNTIL']);
const boundedDefaultLimit = 366;
const boundedAbsoluteLimit = 3660;

export function parseRRule(rrule: string): ParsedRRule {
  const pairs = new Map<string, string>();
  for (const part of rrule.split(';')) {
    const [rawKey, rawValue] = part.split('=');
    if (rawKey === undefined || rawValue === undefined || rawValue.trim().length === 0) {
      throw new Error(`Invalid RRULE part: ${part}`);
    }

    const key = rawKey.trim().toUpperCase();
    if (!supportedRRuleKeys.has(key)) {
      throw new Error(`Unsupported RRULE key: ${key}`);
    }
    pairs.set(key, rawValue.trim().toUpperCase());
  }

  const rawFrequency = pairs.get('FREQ');
  if (rawFrequency !== 'DAILY' && rawFrequency !== 'WEEKLY' && rawFrequency !== 'MONTHLY') {
    throw new Error('RRULE requires FREQ=DAILY, FREQ=WEEKLY, or FREQ=MONTHLY.');
  }

  const count = pairs.has('COUNT') ? parsePositiveInteger(pairs.get('COUNT') ?? '') : undefined;
  const interval = pairs.has('INTERVAL') ? parsePositiveInteger(pairs.get('INTERVAL') ?? '') : 1;
  const until = pairs.get('UNTIL');

  const parsed: {
    frequency: RecurrenceFrequency;
    count?: number;
    interval: number;
    until?: string;
  } = {
    frequency: rawFrequency,
    interval,
  };
  if (count !== undefined) parsed.count = count;
  if (until !== undefined) parsed.until = normalizeUntil(until);
  return parsed;
}

export function expandBoundedRecurrence(
  input: BoundedRecurrenceInput,
): readonly RecurrenceOccurrence[] {
  const parsed = parseRRule(input.rrule);
  const start = createLocalDateTime(String(input.dtstart));
  const timeZone = createTimeZoneId(String(input.timeZone));
  const maxOccurrences = input.maxOccurrences ?? parsed.count ?? boundedDefaultLimit;

  if (!Number.isSafeInteger(maxOccurrences) || maxOccurrences < 1) {
    throw new Error('Recurrence maxOccurrences must be a positive safe integer.');
  }
  if (maxOccurrences > boundedAbsoluteLimit) {
    throw new Error('Recurrence expansion must stay within the bounded materialisation limit.');
  }
  if (
    parsed.count === undefined &&
    input.windowEnd === undefined &&
    input.maxOccurrences === undefined
  ) {
    throw new Error('Unbounded recurrence requires COUNT, windowEnd, or maxOccurrences.');
  }

  const generated = new Map<string, RecurrenceOccurrence>();
  const targetCount = parsed.count ?? maxOccurrences;
  let current = start;
  const anchorDay = parseLocalDateTimeParts(start).day;

  for (let index = 0; index < targetCount && generated.size < maxOccurrences; index += 1) {
    if (parsed.until !== undefined && current > parsed.until) break;
    addOccurrence(generated, current, timeZone, 'rrule');
    current = incrementLocalDateTime(current, parsed.frequency, parsed.interval, anchorDay);
    if (input.windowEnd !== undefined && current.slice(0, 10) > input.windowEnd) {
      break;
    }
  }

  for (const local of input.rdate ?? []) {
    addOccurrence(generated, createLocalDateTime(String(local)), timeZone, 'rdate');
  }

  for (const local of input.exdate ?? []) {
    generated.delete(createLocalDateTime(String(local)));
  }

  return [...generated.values()]
    .filter((occurrence) => isWithinWindow(occurrence.local, input.windowStart, input.windowEnd))
    .sort((left, right) => left.local.localeCompare(right.local))
    .slice(0, maxOccurrences);
}

export function localDateTimeToUtc(input: {
  local: string | LocalDateTime;
  timeZone: string | TimeZoneId;
}): string {
  const local = createLocalDateTime(String(input.local));
  const timeZone = createTimeZoneId(String(input.timeZone));
  return formatUtcDate(localDateTimeToUtcDate(local, timeZone));
}

function addOccurrence(
  target: Map<string, RecurrenceOccurrence>,
  local: LocalDateTime,
  timeZone: TimeZoneId,
  source: 'rrule' | 'rdate',
): void {
  target.set(local, {
    local,
    utc: formatUtcDate(localDateTimeToUtcDate(local, timeZone)),
    timeZone,
    source,
  });
}

function incrementLocalDateTime(
  local: LocalDateTime,
  frequency: RecurrenceFrequency,
  interval: number,
  anchorDay: number,
): LocalDateTime {
  const parts = parseLocalDateTimeParts(local);
  if (frequency === 'DAILY') {
    return formatLocalDateTime(addDays(parts, interval));
  }
  if (frequency === 'WEEKLY') {
    return formatLocalDateTime(addDays(parts, interval * 7));
  }
  return formatLocalDateTime(addMonths(parts, interval, anchorDay));
}

function localDateTimeToUtcDate(local: LocalDateTime, timeZone: TimeZoneId): Date {
  const parts = parseLocalDateTimeParts(local);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const firstOffset = getTimeZoneOffsetMinutes(timeZone, new Date(localAsUtc));
  const firstUtc = localAsUtc - firstOffset * 60_000;
  const correctedOffset = getTimeZoneOffsetMinutes(timeZone, new Date(firstUtc));
  return new Date(localAsUtc - correctedOffset * 60_000);
}

function getTimeZoneOffsetMinutes(timeZone: TimeZoneId, instant: Date): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((item) => item.type === type)?.value;
    if (value === undefined) throw new Error(`Unable to read ${type} for time zone ${timeZone}.`);
    return Number(value);
  };

  const localAsUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );

  return (localAsUtc - instant.getTime()) / 60_000;
}

function parseLocalDateTimeParts(local: LocalDateTime): LocalParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(local);
  if (!match) {
    throw new Error(`Invalid local date-time: ${local}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };
}

function addDays(parts: LocalParts, days: number): LocalParts {
  const timestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day + days,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const date = new Date(timestamp);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function addMonths(parts: LocalParts, months: number, anchorDay: number): LocalParts {
  const monthIndex = parts.month - 1 + months;
  const year = parts.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    year,
    month: month + 1,
    day: Math.min(anchorDay, daysInTargetMonth),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function formatLocalDateTime(parts: LocalParts): LocalDateTime {
  return createLocalDateTime(
    `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}T${pad(
      parts.hour,
      2,
    )}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}`,
  );
}

function formatUtcDate(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z');
}

function parsePositiveInteger(input: string): number {
  const value = Number(input);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Expected a positive integer, received: ${input}`);
  }
  return value;
}

function normalizeUntil(input: string): string {
  if (/^\d{8}$/.test(input)) {
    return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}T23:59:59`;
  }
  if (/^\d{8}T\d{6}Z?$/.test(input)) {
    return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}T${input.slice(
      9,
      11,
    )}:${input.slice(11, 13)}:${input.slice(13, 15)}`;
  }
  return createLocalDateTime(input.replace(/Z$/, ''));
}

function isWithinWindow(local: LocalDateTime, windowStart?: string, windowEnd?: string): boolean {
  const date = local.slice(0, 10);
  if (windowStart !== undefined && date < windowStart) return false;
  if (windowEnd !== undefined && date > windowEnd) return false;
  return true;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}
