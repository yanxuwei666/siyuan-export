#!/usr/bin/env python3
"""Write an API-provided SiYuan Markdown export to a local directory.

The plugin reads workspace data through SiYuan's HTTP API. This program never
opens the workspace, its database, or its assets; it only writes the payload it
receives on standard input to the explicit output directory.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath
from typing import Any

INVALID_FS_CHARS = re.compile(r'[\\/:*?"<>|]')
ASSET_LINK_RE = re.compile(r"(\]\()(?P<path>assets/[^)]+)(\))")
WINDOWS_RESERVED_NAMES = {
    "aux", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
    "con", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9", "nul", "prn",
}


def safe_name(name: str) -> str:
    name = INVALID_FS_CHARS.sub("_", name).strip().strip(".")
    if not name:
        return "untitled"
    stem, dot, suffix = name.partition(".")
    if stem.casefold() in WINDOWS_RESERVED_NAMES:
        return f"{stem}_{dot}{suffix}"
    return name


def output_file_path(out_dir: Path, notebook_name: str, hpath: str, doc_id: str) -> Path:
    parts = [safe_name(part) for part in hpath.split("/") if part] or [safe_name(doc_id)]
    return out_dir.joinpath(safe_name(notebook_name), *parts[:-1], f"{parts[-1]}.md")


def within_output_dir(out_dir: Path, path: Path) -> Path:
    path = path.resolve()
    try:
        path.relative_to(out_dir)
    except ValueError as error:
        raise ValueError(f"Output path escapes the export directory: {path}") from error
    return path


def output_path_key(path: Path) -> str:
    return str(path).casefold()


def unique_path(path: Path, token: str, used_paths: set[str]) -> Path:
    candidate = path
    suffix = 1
    while output_path_key(candidate) in used_paths:
        discriminator = hashlib.sha256(f"{token}:{suffix}".encode("utf-8")).hexdigest()[:10]
        candidate = path.with_name(f"{path.stem}__{discriminator}{path.suffix}")
        suffix += 1
    used_paths.add(output_path_key(candidate))
    return candidate


def asset_output_path(out_dir: Path, asset_path: str) -> Path:
    source = PurePosixPath(asset_path)
    parts = source.parts
    if (
        source.is_absolute()
        or len(parts) < 2
        or parts[0] != "assets"
        or any(part in {"", ".", ".."} or "\\" in part for part in parts)
    ):
        raise ValueError(f"Invalid asset path: {asset_path}")
    return within_output_dir(out_dir, out_dir.joinpath(*(safe_name(part) for part in parts)))


def rewrite_assets(markdown: str, md_file: Path, asset_paths: dict[str, Path]) -> str:
    def replace(match: re.Match[str]) -> str:
        target = asset_paths.get(match.group("path"))
        if target is None:
            return match.group(0)
        return f"{match.group(1)}{Path(__import__('os').path.relpath(target, md_file.parent)).as_posix()}{match.group(3)}"

    return ASSET_LINK_RE.sub(replace, markdown)


def write_export(payload: dict[str, Any]) -> None:
    out_dir = Path(str(payload["outDir"])).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    used_paths: set[str] = set()
    asset_paths: dict[str, Path] = {}
    for asset in payload.get("assets", []):
        source = str(asset["path"])
        if source in asset_paths:
            continue
        asset_paths[source] = unique_path(asset_output_path(out_dir, source), source, used_paths)
    exported = 0
    conflicts = 0
    for doc in payload.get("documents", []):
        path = within_output_dir(
            out_dir,
            output_file_path(out_dir, str(doc["notebookName"]), str(doc["hpath"]), str(doc["id"])),
        )
        if output_path_key(path) in used_paths:
            conflicts += 1
        path = unique_path(path, str(doc["id"]), used_paths)
        path.parent.mkdir(parents=True, exist_ok=True)
        markdown = rewrite_assets(str(doc["markdown"]), path, asset_paths)
        path.write_text(markdown.rstrip() + "\n", encoding="utf-8")
        exported += 1
    assets = 0
    for asset in payload.get("assets", []):
        target = asset_paths[str(asset["path"])]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(base64.b64decode(asset["base64"]))
        assets += 1
    print(f"[DONE] docs exported: {exported}")
    print(f"[DONE] assets exported: {assets}")
    print(f"[INFO] path conflicts resolved: {conflicts}")
    print(f"[INFO] output dir: {out_dir}")


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="backslashreplace")
    parser = argparse.ArgumentParser(description="Write an API-provided SiYuan Markdown export.")
    parser.add_argument("--api-input", action="store_true", help="Read documents and assets as JSON from stdin")
    args = parser.parse_args()
    if not args.api_input:
        parser.error("--api-input is required; workspace files are read through the SiYuan API")
    write_export(json.loads(sys.stdin.buffer.read().decode("utf-8")))


if __name__ == "__main__":
    main()
