"""Check tag/manifest agreement and, optionally, Chrome and Firefox ZIPs."""

import json
from pathlib import Path
import sys
import zipfile


def check(tag, archives=()):
    root = Path(__file__).resolve().parent.parent
    targets = (("chrome", 3), ("firefox", 2))
    for index, (browser, manifest_type) in enumerate(targets):
        source = json.loads((root / "src" / f"{browser}_manifest.json").read_text())
        if tag != f"v{source['version']}":
            raise ValueError(f"{browser}: tag {tag!r} does not match version {source['version']!r}")
        if source["manifest_version"] != manifest_type:
            raise ValueError(f"{browser}: expected manifest_version {manifest_type}")
        if archives:
            with zipfile.ZipFile(archives[index]) as archive:
                corrupt = archive.testzip()
                if corrupt:
                    raise ValueError(f"{browser}: corrupt ZIP entry {corrupt}")
                packaged = json.loads(archive.read("manifest.json"))
                if packaged != source:
                    raise ValueError(f"{browser}: packaged manifest differs from source")
    print(f"Release checks passed for {tag}" + (" (including ZIPs)" if archives else ""))


if __name__ == "__main__":
    if len(sys.argv) not in (2, 4):
        sys.exit("Usage: check-release.py TAG [CHROME_ZIP FIREFOX_ZIP]")
    try:
        check(sys.argv[1], sys.argv[2:])
    except (ValueError, KeyError, OSError, zipfile.BadZipFile) as error:
        sys.exit(f"Release validation failed: {error}")
