import type { Source } from "src/codegen/model"

export function checkerSource(overrides: Partial<Source> = {}): Source {
  return {
    manifest: "app.yml",
    source_pointer: "/modules/0/sources/0",
    module: null,
    type: "archive",
    checker_type: "json",
    checkers_run: ["JSONChecker"],
    status: "checked",
    reason: null,
    state: null,
    current: {
      url: "https://example.org/source.tar.gz",
      checksum: { md5: null, sha1: null, sha256: null, sha512: null },
      size: null,
      version: null,
      timestamp: null,
    },
    candidate: null,
    selected_version: null,
    update_group: null,
    errors: [],
    ...overrides,
  }
}
