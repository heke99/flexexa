#!/usr/bin/env bash
# Run only in the protected-main apply job, from environments/dev.
# Persist one independently verified, no-resource-operation saved plan.
set -euo pipefail
umask 077
json_file=$(mktemp)
trap 'rm -f "$json_file"' EXIT
set +e
tofu plan -input=false -lock-timeout=5m -detailed-exitcode -no-color -out=readback.tfplan > readback-plan.txt
code=$?
set -e
if [ "$code" -ne 0 ]; then
  echo 'Readback reconciliation rejected: plan failed or requires changes.' >&2
  exit "$code"
fi
tofu show -json readback.tfplan > "$json_file"
node ../../scripts/verify-dev-plan.mjs "$json_file" readback-safety.json --require-noop
node ../../scripts/verify-dev-apply-context.mjs
tofu apply -input=false -lock-timeout=5m -auto-approve readback.tfplan
