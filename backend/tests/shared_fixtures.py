import gi

gi.require_version("Gio", "2.0")
gi.require_version("OSTree", "1.0")
from gi.repository import Gio, OSTree  # type: ignore

APP = "org.example.App"
REF = f"app/{APP}/x86_64/stable"
ARM = f"app/{APP}/aarch64/stable"


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
