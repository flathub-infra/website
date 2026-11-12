"""Shared size and compression limits for checker artifact archives."""

import io
import zipfile
from collections.abc import Iterator
from contextlib import contextmanager

MAX_ARCHIVE_SIZE = 64 * 1024 * 1024
MAX_REPORT_SIZE = 16 * 1024 * 1024
MAX_EXPANDED_SIZE = 256 * 1024 * 1024


@contextmanager
def open_checker_archive(content: bytes) -> Iterator[zipfile.ZipFile]:
    if len(content) > MAX_ARCHIVE_SIZE:
        raise ValueError("Checker artifact exceeds download limit")
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        entries = archive.infolist()
        if (
            len(entries) > 20000
            or sum(e.file_size for e in entries) > MAX_EXPANDED_SIZE
        ):
            raise ValueError("Checker artifact exceeds expanded limits")
        for entry in entries:
            if entry.is_dir():
                continue
            if (
                entry.flag_bits & 1
                or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                or entry.file_size > MAX_REPORT_SIZE
            ):
                raise ValueError("Unsupported checker archive entry")
        yield archive
