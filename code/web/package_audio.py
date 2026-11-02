#!/usr/bin/env python3
"""Package loose game sounds missing from the shipped PK3 archives."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import tempfile
import zipfile


MAIN_THEME = "sound/music/mus_maintheme.mp3"


def archive_paths(game_dir: Path) -> set[str]:
    paths: set[str] = set()
    for pack in sorted(game_dir.glob("*.pk3")):
        with zipfile.ZipFile(pack) as archive:
            for name in archive.namelist():
                paths.add(name.replace("\\", "/").lstrip("/").casefold())
    return paths


def package(game_dir: Path, output: Path) -> int:
    packed_paths = archive_paths(game_dir)
    sound_root = game_dir / "sound"
    loose_files = sorted(
        path
        for path in sound_root.rglob("*")
        if path.is_file()
        and path.relative_to(game_dir).as_posix().casefold() not in packed_paths
        and path.relative_to(game_dir).as_posix().casefold() != MAIN_THEME
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix="sound-", suffix=".pk3", dir=output.parent)
    os.close(fd)
    temporary = Path(temporary_name)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for path in loose_files:
                archive.write(path, path.relative_to(game_dir).as_posix())
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)

    size = sum(path.stat().st_size for path in loose_files)
    print(f"Packaged {len(loose_files)} loose sounds ({size:,} source bytes) into {output}")
    return len(loose_files)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--game-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    package(arguments.game_dir.resolve(), arguments.output.resolve())


if __name__ == "__main__":
    main()
