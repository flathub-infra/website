import json

import gi
import httpx

gi.require_version("Gio", "2.0")
gi.require_version("OSTree", "1.0")
from gi.repository import Gio, OSTree  # type: ignore

from app import config, http_client

APP = "org.example.App"
REF = f"app/{APP}/x86_64/stable"
ARM = f"app/{APP}/aarch64/stable"
DECISION_RISKS = ("promo", "hype", "brand", "harmful", "junk")


class SourceRepo:
    def __init__(self, path):
        self.path = path
        self.repo = OSTree.Repo.new(Gio.File.new_for_path(str(path)))
        self.repo.create(OSTree.RepoMode.ARCHIVE, None)
        self.repo.regenerate_summary(None, None)
        self.index = 0

    @property
    def url(self):
        return self.path.as_uri()

    def commit(self, ref, declarations, name=APP):
        tree = self.path.parent / f"tree-{self.path.name}-{self.index}"
        self.index += 1
        tree.mkdir()
        if declarations is not None:
            (tree / "metadata").write_text(
                f"[Application]\nname={name}\n{declarations}"
            )
        mtree = OSTree.MutableTree.new()
        self.repo.write_directory_to_mtree(
            Gio.File.new_for_path(str(tree)), mtree, None, None
        )
        _, root = self.repo.write_mtree(mtree, None)
        _, checksum = self.repo.write_commit(None, None, None, None, root, None)
        self.repo.set_ref_immediate(None, ref, checksum, None)
        self.repo.regenerate_summary(None, None)
        return checksum


def decision_reply(choice="benign_rewrite", benign=0.95, **scores):
    nouls = {"same_app": 0.95, **dict.fromkeys(DECISION_RISKS, 0.05), **scores}
    return {
        "model": "jev-1.13.0",
        "answers": {
            "disposition": {
                "type": "choice",
                "choice": choice,
                "probabilities": {"benign_rewrite": benign, "needs_review": 1 - benign},
                "confidence": 0.9,
            },
            **{name: {"type": "noul", "noul": value} for name, value in nouls.items()},
        },
        "usage": {"input_tokens": 300, "output_tokens": 40},
    }


def decision_post(payload=None, status_code=200, content=None):
    if content is None:
        content = json.dumps(decision_reply() if payload is None else payload).encode()

    def post(url, **kwargs):
        return httpx.Response(
            status_code, content=content, request=httpx.Request("POST", url)
        )

    return post


def enable_decisions(monkeypatch, post):
    monkeypatch.setattr(
        config.settings, "decisions_api", "https://decisions.example/v1/systemone"
    )
    monkeypatch.setattr(config.settings, "decisions_api_key", "test-decisions-key")
    monkeypatch.setattr(config.settings, "decisions_model", "jev-1.13.0")
    monkeypatch.setattr(http_client, "post", post)
