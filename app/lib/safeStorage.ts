'use client'

/**
 * Safe localStorage wrapper — handles incognito mode, iframe restrictions,
 * and quota exceeded errors gracefully without crashing the app.
 */

function safeGet(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function safeSet(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value)
        return true
    } catch {
        return false
    }
}

function safeRemove(key: string): boolean {
    try {
        localStorage.removeItem(key)
        return true
    } catch {
        return false
    }
}

function safeGetNumber(key: string, fallback = 0): number {
    const val = safeGet(key)
    if (val === null) return fallback
    const num = parseInt(val, 10)
    return isNaN(num) ? fallback : num
}

function safeSetNumber(key: string, value: number): boolean {
    return safeSet(key, String(value))
}

function safeGetJSON<T>(key: string, fallback: T): T {
    const val = safeGet(key)
    if (val === null) return fallback
    try {
        return JSON.parse(val) as T
    } catch {
        return fallback
    }
}

function safeSetJSON(key: string, value: unknown): boolean {
    try {
        return safeSet(key, JSON.stringify(value))
    } catch {
        return false
    }
}

export const safeStorage = {
    get: safeGet,
    set: safeSet,
    remove: safeRemove,
    getNumber: safeGetNumber,
    setNumber: safeSetNumber,
    getJSON: safeGetJSON,
    setJSON: safeSetJSON,
} as const
