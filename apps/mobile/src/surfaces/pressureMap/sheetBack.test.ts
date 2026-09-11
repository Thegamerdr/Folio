import { expect, it, vi } from 'vitest';
import { dismissTopSheet, registerSheetBack } from './sheetBack';

it('consumes Back in the top sheet before allowing navigation underneath', () => {
  const outer = vi.fn();
  const inner = vi.fn();
  const removeOuter = registerSheetBack('outer', outer);
  const removeInner = registerSheetBack('inner', inner);
  expect(dismissTopSheet()).toBe(true);
  expect(inner).toHaveBeenCalledOnce();
  expect(outer).not.toHaveBeenCalled();
  removeInner();
  expect(dismissTopSheet()).toBe(true);
  expect(outer).toHaveBeenCalledOnce();
  removeOuter();
  expect(dismissTopSheet()).toBe(false);
});

it('keeps a non-dismissible sheet in front of navigation', () => {
  const remove = registerSheetBack('busy', () => {});
  expect(dismissTopSheet()).toBe(true);
  expect(dismissTopSheet()).toBe(true);
  remove();
  expect(dismissTopSheet()).toBe(false);
});
