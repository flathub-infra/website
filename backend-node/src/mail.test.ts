import assert from "node:assert/strict"
import { test } from "node:test"
import { createTransport } from "nodemailer"
import { normalizeMessageId } from "./mail"

test("existing IDs retain their identity for threading", () => {
  assert.equal(
    normalizeMessageId("org.example.App/123/held"),
    "<org.example.App/123/held@flathub.org>",
  )
  assert.equal(
    normalizeMessageId(" <event@example.org> "),
    "<event@example.org>",
  )
})

test("unsafe IDs become deterministic valid IDs", () => {
  for (const id of [
    "1/login/2026-11-02T12:34:56",
    "a\r\nBcc: victim@example.org",
    "a..b",
    "a b",
  ]) {
    const normalized = normalizeMessageId(id)
    assert.match(normalized, /^<sha256-[a-f0-9]{64}@flathub\.org>$/)
    assert.equal(normalizeMessageId(id), normalized)
    assert.equal(normalizeMessageId(normalized), normalized)
  }
  assert.notEqual(normalizeMessageId("a b"), normalizeMessageId("a:b"))
})

test("MIME preserves root and follow-up message identities", async () => {
  const transport = createTransport({ streamTransport: true, buffer: true })
  const root = normalizeMessageId("org.example.App/123/held")
  const reply = normalizeMessageId("org.example.App/123/approved")
  const result = await transport.sendMail({
    from: "noreply@flathub.org",
    to: "test@example.org",
    text: "Approved",
    messageId: reply,
    references: root,
    inReplyTo: root,
  })
  const mime = result.message.toString()
  assert.ok(mime.includes(`Message-ID: ${reply}`))
  assert.ok(mime.includes(`References: ${root}`))
  assert.ok(mime.includes(`In-Reply-To: ${root}`))
})
