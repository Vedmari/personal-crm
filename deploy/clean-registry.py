"""Keep the ten newest SHA-tagged builds of this repository's GHCR package."""

import json
import os
import re
import subprocess

owner, package = os.environ["GITHUB_REPOSITORY"].lower().split("/")
# This repository belongs to a personal account.
endpoint = f"users/{owner}/packages/container/{package}/versions"
pages = json.loads(subprocess.check_output(
    ["gh", "api", "--paginate", "--slurp", f"{endpoint}?per_page=100"]
))
builds = []
for page in pages:
    for version in page:
        tags = version["metadata"]["container"]["tags"]
        if tags and all(re.fullmatch(r"[0-9a-f]{40}", tag) for tag in tags):
            builds.append(version)

# Snapshot all pages before deleting. Untagged versions can be OCI child manifests
# of retained images. Versions with non-release tags belong to another policy.
builds.sort(key=lambda version: (version["created_at"], version["id"]), reverse=True)
for version in builds[10:]:
    print("Removing", *version["metadata"]["container"]["tags"], flush=True)
    subprocess.run(["gh", "api", "--method", "DELETE", f"{endpoint}/{version['id']}"], check=True)
