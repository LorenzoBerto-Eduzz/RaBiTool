#!/bin/sh
set -eu

REPO_ROOT="$(git rev-parse --show-toplevel)"
IDENTITY_FILE="$REPO_ROOT/.git-identity"

if [ ! -f "$IDENTITY_FILE" ]; then
  echo "Git identity guard: missing .git-identity"
  echo "Copy .git-identity.example to .git-identity and set GIT_ALLOWED_EMAIL."
  exit 1
fi

# shellcheck disable=SC1090
. "$IDENTITY_FILE"

if [ "${GIT_ALLOWED_EMAIL:-}" = "" ] || [ "${GIT_ALLOWED_EMAIL:-}" = "your@email.com" ]; then
  echo "Git identity guard: GIT_ALLOWED_EMAIL is empty or still a placeholder."
  exit 1
fi

CURRENT_EMAIL="$(git config user.email || true)"

if [ "$CURRENT_EMAIL" != "$GIT_ALLOWED_EMAIL" ]; then
  echo "Git identity guard blocked this action."
  echo "Allowed email: $GIT_ALLOWED_EMAIL"
  echo "Current email: $CURRENT_EMAIL"
  echo "Fix with: git config user.email \"$GIT_ALLOWED_EMAIL\""
  echo "Also ensure: git config core.hooksPath .githooks"
  exit 1
fi

exit 0
