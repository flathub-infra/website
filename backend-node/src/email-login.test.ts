import assert from "node:assert/strict"
import test from "node:test"
import { render } from "react-email"
import EmailLoginEmail, { createEmailLoginText } from "../emails/email-login"

test("renders the magic-link fragment, expiry, and plaintext URL", async () => {
  const signInUrl = `https://flathub.org/en/login/email/confirm#token=${"a".repeat(43)}`
  const expiresAt = "2026-09-24T14:15:00.000Z"
  const html = await render(
    EmailLoginEmail({
      category: "email_login",
      subject: "Sign in to Flathub",
      previewText: "Sign in to Flathub",
      signInUrl,
      expiresAt,
    }),
  )
  const text = createEmailLoginText(signInUrl, expiresAt)

  assert.ok(html.includes(signInUrl))
  assert.match(html, /Sep 24, 2026, 2:15 PM UTC/)
  assert.doesNotMatch(html, /expires in 15 minutes/)
  assert.ok(text.includes(signInUrl))
  assert.match(text, /expires at Sep 24, 2026, 2:15 PM UTC/)
})
