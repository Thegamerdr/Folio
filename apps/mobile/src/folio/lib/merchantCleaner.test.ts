import { describe, it, expect } from 'vitest';

import { cleanMerchantName } from './merchantCleaner';

describe('cleanMerchantName', () => {
  it('strips a leading transaction-type code (real on-device string)', () => {
    expect(cleanMerchantName('Mb Andrea Nsiah')).toBe('Andrea Nsiah');
    expect(cleanMerchantName('FPS Andrea Nsiah')).toBe('Andrea Nsiah');
    expect(cleanMerchantName('FPS, Andrea Nsiah')).toBe('Andrea Nsiah');
  });

  it('collapses a bank-duplicated payee name', () => {
    expect(cleanMerchantName('FPS, Andrea Nsiah, Andrea Nsiah')).toBe('Andrea Nsiah');
  });

  it('strips trailing reference + account junk (real on-device string)', () => {
    // "Fintern Ltd Abound Vwr5Ojsd 60000149034405" -> drop the 14-digit account number and the
    // random "Vwr5Ojsd" reference token, keep the real name.
    expect(cleanMerchantName('Fintern Ltd Abound Vwr5Ojsd 60000149034405')).toBe(
      'Fintern Ltd Abound',
    );
  });

  it('strips a trailing store/location code and title-cases ALL-CAPS bank text', () => {
    expect(cleanMerchantName('TESCO STORES 3829')).toBe('Tesco Stores');
    expect(cleanMerchantName('STANDING ORDER LANDLORD')).toBe('Landlord');
    expect(cleanMerchantName('DIRECT DEBIT UTILITY CO')).toBe('Utility Co');
  });

  it('preserves an already-clean, mixed-case merchant name', () => {
    expect(cleanMerchantName('Tesco Metro Soho')).toBe('Tesco Metro Soho');
    expect(cleanMerchantName('iCloud')).toBe('iCloud');
    expect(cleanMerchantName('Andrea Nsiah')).toBe('Andrea Nsiah');
  });

  it('never strips a leading code out of a real word (word-boundary safe)', () => {
    // "Sofa" starts with "so" but is not the standalone "SO" standing-order code.
    expect(cleanMerchantName('Sofa Club')).toBe('Sofa Club');
    // "Doddle" starts with "dd" but is not the "DD" direct-debit code.
    expect(cleanMerchantName('Doddle Parcels')).toBe('Doddle Parcels');
  });

  it('preserves real short-brand names that collide with weak codes (space-separated)', () => {
    // BP (fuel), So Energy, DD — the code is the actual merchant, and only a space follows, so it
    // must survive verbatim (regression for the reviewer-found brand-collision defect).
    expect(cleanMerchantName('BP Garage London')).toBe('BP Garage London');
    expect(cleanMerchantName('So Energy')).toBe('So Energy');
    expect(cleanMerchantName('DD Handmade')).toBe('DD Handmade');
  });

  it('still strips a weak code when a bank delimiter proves it is a prefix', () => {
    expect(cleanMerchantName('BP, Andrea Nsiah')).toBe('Andrea Nsiah');
    expect(cleanMerchantName('SO/Landlord')).toBe('Landlord');
  });

  it('never returns empty for a non-empty input (falls back to the original)', () => {
    expect(cleanMerchantName('FPS')).toBe('Fps'); // a bare code is the whole string → kept (title-cased)
    expect(cleanMerchantName('   ')).toBe('');
    expect(cleanMerchantName('X')).toBe('X');
  });

  it('does not touch a real name that happens to contain digits mid-string', () => {
    expect(cleanMerchantName('O2')).toBe('O2');
    expect(cleanMerchantName('Web2 Cafe')).toBe('Web2 Cafe');
  });
});
