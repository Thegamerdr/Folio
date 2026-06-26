import type { WorkspaceId } from '@folio/domain';

import {
  writeAuditLogEntry,
  type AuditActorKind,
  type AuditLogEntryInput,
  type CompactAuditDelta,
  type EntityRef,
} from './audit.js';
import type { DatabaseDriver } from './driver.js';
import type { JsonRecord } from './json.js';

export type CommandActor = Readonly<{
  kind: AuditActorKind;
  ref?: string;
}>;

export type StorageCommand<TInput extends JsonRecord = JsonRecord> = Readonly<{
  type: string;
  input: TInput;
  actor: CommandActor;
  workspaceId?: WorkspaceId;
  deviceId?: string;
}>;

export type CommandAuditInput = Readonly<{
  entityRefs: readonly EntityRef[];
  delta: CompactAuditDelta | JsonRecord;
  provenance?: JsonRecord;
}>;

export type CommandHandlerResult<TResult> = Readonly<{
  result: TResult;
  changedEntityIds?: readonly string[];
  invalidatedProjectionKinds?: readonly string[];
  audit?: CommandAuditInput;
  outboxSequence?: number;
}>;

export type CommandOutcome<TResult> = Readonly<{
  result: TResult;
  changedEntityIds: readonly string[];
  invalidatedProjectionKinds: readonly string[];
  auditEntryId?: string;
  outboxSequence?: number;
}>;

export type CommandContext<TInput extends JsonRecord = JsonRecord> = Readonly<{
  driver: DatabaseDriver;
  command: StorageCommand<TInput>;
}>;

export type CommandHandler<TInput extends JsonRecord = JsonRecord, TResult = unknown> = (
  context: CommandContext<TInput>,
) => Promise<CommandHandlerResult<TResult>>;

export type AtomicCommandOptions = Readonly<{
  idFactory?: () => string;
  now?: () => Date;
}>;

export async function runAtomicCommand<TInput extends JsonRecord, TResult>(
  driver: DatabaseDriver,
  command: StorageCommand<TInput>,
  handler: CommandHandler<TInput, TResult>,
  options: AtomicCommandOptions = {},
): Promise<CommandOutcome<TResult>> {
  if (command.type.trim().length === 0) {
    throw new Error('Commands require a non-empty type.');
  }

  return driver.transaction(async (transactionDriver) => {
    const handled = await handler({ driver: transactionDriver, command });
    let auditEntryId: string | undefined;

    if (handled.audit !== undefined) {
      const auditInput = createCommandAuditInput(command, handled.audit);
      const auditEntry = await writeAuditLogEntry(transactionDriver, auditInput, options);
      auditEntryId = auditEntry.id;
    }

    return {
      result: handled.result,
      changedEntityIds: handled.changedEntityIds ?? [],
      invalidatedProjectionKinds: handled.invalidatedProjectionKinds ?? [],
      ...(auditEntryId === undefined ? {} : { auditEntryId }),
      ...(handled.outboxSequence === undefined ? {} : { outboxSequence: handled.outboxSequence }),
    };
  });
}

export class CommandBus {
  private readonly handlers = new Map<string, CommandHandler<JsonRecord, unknown>>();

  constructor(
    private readonly driver: DatabaseDriver,
    private readonly options: AtomicCommandOptions = {},
  ) {}

  register<TInput extends JsonRecord, TResult>(
    type: string,
    handler: CommandHandler<TInput, TResult>,
  ): void {
    if (type.trim().length === 0) {
      throw new Error('Command handler type must be non-empty.');
    }
    if (this.handlers.has(type)) {
      throw new Error(`Command handler already registered for ${type}.`);
    }
    this.handlers.set(type, handler as CommandHandler<JsonRecord, unknown>);
  }

  async execute<TInput extends JsonRecord, TResult = unknown>(
    command: StorageCommand<TInput>,
  ): Promise<CommandOutcome<TResult>> {
    const handler = this.handlers.get(command.type);
    if (handler === undefined) {
      throw new Error(`No command handler registered for ${command.type}.`);
    }

    return runAtomicCommand(
      this.driver,
      command,
      handler as CommandHandler<TInput, TResult>,
      this.options,
    );
  }
}

function createCommandAuditInput(
  command: StorageCommand,
  audit: CommandAuditInput,
): AuditLogEntryInput {
  return {
    commandType: command.type,
    actorKind: command.actor.kind,
    entityRefs: audit.entityRefs,
    delta: audit.delta,
    ...(command.workspaceId === undefined ? {} : { workspaceId: command.workspaceId }),
    ...(command.actor.ref === undefined ? {} : { actorRef: command.actor.ref }),
    ...(audit.provenance === undefined ? {} : { provenance: audit.provenance }),
    ...(command.deviceId === undefined ? {} : { deviceId: command.deviceId }),
  };
}
