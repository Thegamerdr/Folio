export interface KeyEnvelope {
  readonly algorithm: string;
  readonly wrappedKey: Uint8Array;
  readonly createdAtIso: string;
}

export interface KeyWrappingAdapter {
  wrapVaultKey(vaultKey: Uint8Array): Promise<KeyEnvelope>;
  unwrapVaultKey(envelope: KeyEnvelope): Promise<Uint8Array>;
}
