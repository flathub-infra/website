/**
 * Two-phase email deduplication to prevent duplicates from Dramatiq retries
 * while avoiding email loss from template/SMTP failures.
 *
 * Flow:
 * 1. checkDuplicate() before rendering - returns true if already successfully sent
 * 2. Render email template and send via SMTP
 * 3. markAsSent() only after successful SMTP - records the sent email
 *
 * If rendering or SMTP fails, the email is not marked as sent, allowing retries to succeed.
 */

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

interface CacheEntry {
  timestamp: number
}

const sentEmails = new Map<string, CacheEntry>()

/**
 * Check if an email with this messageId was already successfully sent to this recipient.
 * Read-only operation - does not modify state.
 */
export function checkDuplicate(messageId: string, to: string): boolean {
  const key = `${messageId}:${to}`
  const now = Date.now()

  const existing = sentEmails.get(key)
  if (existing && now - existing.timestamp < CACHE_TTL_MS) {
    return true // Already sent
  }

  return false
}

/**
 * Mark an email as successfully sent. Call this only after SMTP succeeds.
 * This ensures failed emails (due to template/SMTP errors) can be retried.
 */
export function markAsSent(messageId: string, to: string): void {
  const key = `${messageId}:${to}`
  sentEmails.set(key, { timestamp: Date.now() })
}

function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of sentEmails.entries()) {
    if (now - entry.timestamp >= CACHE_TTL_MS) {
      sentEmails.delete(key)
    }
  }
}

// Start deterministic cleanup every 10 minutes
setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS)
