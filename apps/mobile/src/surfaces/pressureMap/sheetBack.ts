// Android portal sheets have no native Modal window to consume Back. Keep the
// visible stack explicit so screen navigation cannot run underneath a sheet.
const sheets = new Map<string, () => void>();

export function registerSheetBack(id: string, close: () => void) {
  sheets.set(id, close);
  return () => {
    sheets.delete(id);
  };
}

export function dismissTopSheet(): boolean {
  const top = [...sheets.values()].at(-1);
  if (!top) return false;
  top();
  return true;
}
