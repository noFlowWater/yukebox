export function createSessionCache<T>(maxSize: number) {
  const map = new Map<string, T>()
  return {
    get: (key: string): T | undefined => map.get(key),
    set: (key: string, value: T): void => {
      if (map.size >= maxSize) {
        const oldest = map.keys().next().value
        if (oldest !== undefined) map.delete(oldest)
      }
      map.set(key, value)
    },
  }
}
