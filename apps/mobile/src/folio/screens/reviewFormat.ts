export function formatGBPExact(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}£${Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEditableAmount(value: number): string {
  return Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
