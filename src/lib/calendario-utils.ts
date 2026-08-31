export function isDayOffEvent(title: string): boolean {
  return /day\s*off/i.test(title)
}
