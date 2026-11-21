"""Print the release SHA only after finding a successful main deployment to staging."""

from itertools import count
import json
import os
import re
import subprocess
import sys


def pages(endpoint):
    separator = "&" if "?" in endpoint else "?"
    for page in count(1):
        records = json.loads(subprocess.check_output(
            ["gh", "api", f"{endpoint}{separator}per_page=100&page={page}"]
        ))
        yield from records
        if len(records) < 100:
            return


def select_release():
    requested = os.environ.get("REQUESTED_SHA", "").strip().lower()
    if requested and not re.fullmatch(r"[0-9a-f]{40}", requested):
        sys.exit("Enter the full 40-character commit SHA.")
    deployments = f"repos/{os.environ['GITHUB_REPOSITORY']}/deployments"
    query = f"{deployments}?environment=staging&ref=main"
    if requested:
        query += f"&sha={requested}"

    # GitHub lists newest deployments first. An older success can now be inactive.
    for release in pages(query):
        sha = release["sha"]
        if not re.fullmatch(r"[0-9a-f]{40}", sha) or (requested and sha != requested):
            continue
        statuses = pages(f"{deployments}/{release['id']}/statuses")
        if any(status["state"] == "success" for status in statuses):
            return sha
    sys.exit("No matching successful deployment to staging. Production was not changed.")


if __name__ == "__main__":
    print(f"RELEASE_SHA={select_release()}")
