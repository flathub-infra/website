import assert from "node:assert/strict"
import test from "node:test"
import { render } from "react-email"
import SecurityLoginEmail from "../emails/security-login"

test("renders a security login email", async () => {
  const html = await render(
    SecurityLoginEmail({
      category: "security_login",
      subject: "New login to Flathub account",
      previewText: "Flathub Login",
      provider: "github",
      login: "razze",
      time: "2026-07-22T21:29:50.106441",
      ipAddress: "2a00:6020:a125:ff00:54e4:dce2:6a21:90d3",
    }),
  )

  assert.match(html, /New login to Flathub account/)
  assert.match(html, /razze/)
  assert.match(html, /2a00:6020:a125:ff00:54e4:dce2:6a21:90d3/)
})
