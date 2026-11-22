from types import SimpleNamespace

from app.moderation import permission_triage as triage
from app.moderation import source_workspace as workspace


def test_citations_use_only_returned_source_lines(monkeypatch):
    url = "https://example.org/file.txt"
    source = {"type": "file", "url": url, "dest": "project"}
    manifest = {"modules": [{"name": "app", "sources": [source]}]}
    end = workspace.MAX_READ_LINES + 10
    data = "\n".join(["x" * 1000, *(str(i) for i in range(2, end + 1))])
    monkeypatch.setattr(workspace, "_remote", lambda source: (data.encode(), url))
    with workspace.SourceWorkspace(manifest) as sources:
        deps = triage.Deps([], manifest, None, sources)
        ctx = SimpleNamespace(deps=deps)

        def read(start, stop):
            return triage.read_source_file(ctx, "app", "file.txt", start, stop)

        def citations(start, stop, path="file.txt"):
            ref = triage.SourceRef(
                module="app", path=path, start_line=start, end_line=stop
            )
            change = triage.ChangeAssessment(
                difference=0,
                need="unclear",
                removal_effect=None,
                reasoning="",
                alternative=None,
                manifest_refs=[],
                source_refs=[ref],
            )
            output = triage.resolve_output(
                triage.Triage(summary="", changes=[change]), deps
            )
            return [r["text"] for r in output["changes"][0]["source_refs"]]

        read(end + 1, end + 5)
        assert citations(1, 1) == []
        shown = read(1, end)
        assert citations(1, 1) == [shown.splitlines()[1].removeprefix("1: ")]
        limit = workspace.MAX_READ_LINES
        assert "path: project/file.txt" in shown.splitlines()[0]
        assert citations(limit, limit, "project/file.txt") == [str(limit)]
        assert citations(limit, limit + 1, "project/file.txt") == []
        assert citations(limit, limit) == [str(limit)]
        assert citations(limit, limit + 1) == []
        read(limit + 2, end + 10)
        assert citations(limit, limit + 2) == []
        assert citations(end, end) == [str(end)]
        assert citations(end, end + 1) == []
        deps.source_calls = triage.MAX_SOURCE_CALLS
        read(limit + 1, limit + 1)
        assert citations(limit + 1, limit + 1) == []
