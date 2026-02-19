/**
 * Форматирование адреса кошелька
 */
export function formatAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Форматирование числа с разделителями
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Проверка на валидный адрес Ethereum
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Конвертация bigint в number безопасно
 */
export function bigIntToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER
  }
  return Number(value)
}

/**
 * Получение относительного времени
 */
export function getRelativeTime(timestamp: bigint): string {
  const now = Date.now()
  const time = Number(timestamp) * 1000
  const diff = now - time

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

/**
 * Генерация случайного числа в диапазоне
 */
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}
