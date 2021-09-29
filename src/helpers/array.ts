export function lastOf<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

export function max(arr: number[]): number {
  return arr.reduce((a, c) => Math.max(a, c), -Infinity);
}
