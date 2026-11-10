#!/usr/bin/env python3
"""Run the pinned IntelliJ IDEA Java formatter once for both Maven modules."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
VERSION = "2026.3"
BUILD = "263.7307.200"
# Official JetBrains archive checksums; upgrades must review both version and output.
ARCHIVES = {
    "x86_64": ("idea-2026.3.tar.gz", "6a53ff71f4a06add4c97edc4efe86c83119ff82e5b5e9f1db62fc95995bd6b25"),
    "aarch64": ("idea-2026.3-aarch64.tar.gz", "19c8ff6e144185ae4961080984a65b11c492f2820e975007b4276fe0deeffe52"),
}


def validate_installation(home):
    info = json.loads((home / "product-info.json").read_text(encoding="utf-8"))
    if info["version"] != VERSION or info["buildNumber"] != BUILD:
        raise ValueError(f"Java formatting requires IntelliJ IDEA {VERSION}, build {BUILD}: {home}")
    launcher = home / "bin" / "idea.sh"
    if not launcher.is_file():
        raise ValueError(f"Expected a Linux IntelliJ IDEA installation at {home}")
    return launcher


def installation():
    if os.environ.get("JAVA_FORMATTER_HOME"):
        home = Path(os.environ["JAVA_FORMATTER_HOME"]).expanduser().resolve()
        validate_installation(home)
        return home
    if platform.system() != "Linux" or platform.machine() not in ARCHIVES:
        raise ValueError("Use Linux/WSL (x86_64 or aarch64) for the Maven formatter")
    import fcntl

    cache = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "jcv-java-formatter"
    cache.mkdir(parents=True, exist_ok=True)
    home = cache / f"idea-{VERSION}-{platform.machine()}"
    with (cache / ".install.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if home.exists():
            validate_installation(home)
            return home
        archive_name, expected = ARCHIVES[platform.machine()]
        print(f"Downloading IntelliJ IDEA {VERSION} (~1.6 GB, cached at {home})", flush=True)
        with tempfile.TemporaryDirectory(prefix="install-", dir=cache) as work:
            work = Path(work)
            archive = work / archive_name
            digest = hashlib.sha256()
            with urlopen(f"https://download.jetbrains.com/idea/{archive_name}", timeout=60) as response:
                with archive.open("wb") as output:
                    while chunk := response.read(1024 * 1024):
                        digest.update(chunk)
                        output.write(chunk)
            if digest.hexdigest() != expected:
                raise ValueError("IntelliJ IDEA download checksum mismatch")
            extracted = work / "extracted"
            with tarfile.open(archive) as bundle:
                bundle.extractall(extracted, filter="data")
            candidates = list(extracted.glob("*/product-info.json"))
            if len(candidates) != 1:
                raise ValueError("Unexpected IntelliJ IDEA archive layout")
            staged = candidates[0].parent
            validate_installation(staged)
            staged.rename(home)
    return home


def java_sources():
    return sorted(path for module in ("core", "backend") for source in ("main", "test")
                  for path in (ROOT / module / "src" / source / "java").rglob("*.java"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("apply", "check"))
    args = parser.parse_args()
    files = java_sources()
    if not files:
        raise ValueError("No core/backend Java sources found")
    home = installation()
    with tempfile.TemporaryDirectory(prefix="jcv-java-format-") as work:
        work = Path(work)
        # Separate state permits CLI formatting while the developer's IDE is open.
        properties = work / "idea.properties"
        properties.write_text("\n".join(f"idea.{key}.path={work / key}"
                                       for key in ("config", "system", "plugins", "log")), encoding="utf-8")
        env = dict(os.environ, IDEA_PROPERTIES=str(properties), IDEA_JDK=str(home / "jbr"))
        command = [str(home / "bin" / "idea.sh"), "format", "-s", str(ROOT / "config/java-formatter.xml"),
                   "-charset", "UTF-8"]
        if args.mode == "check":
            command.append("-dry")
        command.extend(str(path) for path in files)
        print(f"IntelliJ IDEA {VERSION}: {args.mode} {len(files)} Java files", flush=True)
        result = subprocess.run(command, cwd=ROOT, env=env, check=False, timeout=300)
        if result.returncode and args.mode == "check":
            print("Java formatting failed. Run ./mvnw -Djava.format=apply validate and inspect the diff.", file=sys.stderr)
        return result.returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, tarfile.TarError, subprocess.TimeoutExpired) as error:
        sys.exit(f"Java formatter: {error}")
