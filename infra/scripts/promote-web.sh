#!/usr/bin/env bash
set -euo pipefail

# No build, infrastructure writes, object deletion or asset overwrites happen here.
candidate=release/candidate
manifest=release/manifest.json
metadata=release/verification
mkdir -p "$metadata"
previous=unknown
invalidation=not-created
promotion=preflight
record_provenance() {
  result=$?
  printf 'result=%s\npromotion=%s\nsource_sha=%s\ncandidate_manifest_sha256=%s\nartifact_id=%s\nrun=%s/%s/actions/runs/%s\nweb=%s\nbucket=%s\ndistribution=%s\nprevious_index_sha256=%s\ninvalidation=%s\nrecorded_at=%s\n' \
    "$result" "$promotion" "$GITHUB_SHA" "$CANDIDATE_DIGEST" "$CANDIDATE_ARTIFACT_ID" "$GITHUB_SERVER_URL" "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID" \
    "${PREVIEW_WEB_URL:-unvalidated}" "${PREVIEW_BUCKET:-unvalidated}" "${PREVIEW_DISTRIBUTION_ID:-unvalidated}" "$previous" "$invalidation" "$(date -u +%FT%TZ)" > "$metadata/provenance.txt"
  {
    printf '## %s promotion result\n\n' "$RELEASE_ENVIRONMENT"
    cat "$metadata/provenance.txt"
    printf '\nEnrollment, intake and Founder access remain closed. Retained previous index and candidate support reviewed rollback; no automated rollback was performed.\n'
  } >> "$GITHUB_STEP_SUMMARY"
}
trap record_provenance EXIT
node infra/src/check-web-release.ts environment
node infra/src/web-candidate.ts verify "$candidate" "$manifest" "$CANDIDATE_DIGEST" "$GITHUB_SHA"
test "$AWS_ACCOUNT_ID" = "425061472162"
test "$RELEASE_ENVIRONMENT" = development || test "$RELEASE_ENVIRONMENT" = production
aws cloudformation describe-stacks --stack-name "rct-dotcom-$RELEASE_ENVIRONMENT-foundation" > "$metadata/stack.json"
node infra/src/check-web-release.ts stack "$metadata/stack.json"
# Load only helper-validated outputs, not arbitrary stack strings.
export PREVIEW_BUCKET PREVIEW_DISTRIBUTION_ID PREVIEW_WEB_URL PREVIEW_API_URL
PREVIEW_BUCKET=$(grep '^PREVIEW_BUCKET=' "$GITHUB_ENV" | tail -1 | cut -d= -f2-)
PREVIEW_DISTRIBUTION_ID=$(grep '^PREVIEW_DISTRIBUTION_ID=' "$GITHUB_ENV" | tail -1 | cut -d= -f2-)
PREVIEW_WEB_URL=$(grep '^PREVIEW_WEB_URL=' "$GITHUB_ENV" | tail -1 | cut -d= -f2-)
PREVIEW_API_URL=$(grep '^PREVIEW_API_URL=' "$GITHUB_ENV" | tail -1 | cut -d= -f2-)
aws s3api get-bucket-location --bucket "$PREVIEW_BUCKET" --expected-bucket-owner "$AWS_ACCOUNT_ID" > /dev/null
aws s3api get-public-access-block --bucket "$PREVIEW_BUCKET" --expected-bucket-owner "$AWS_ACCOUNT_ID" > "$metadata/access-block.json"
aws s3api get-bucket-policy-status --bucket "$PREVIEW_BUCKET" --expected-bucket-owner "$AWS_ACCOUNT_ID" > "$metadata/policy-status.json"
node infra/src/check-web-release.ts bucket "$metadata/access-block.json" "$metadata/policy-status.json"
aws cloudfront get-distribution --id "$PREVIEW_DISTRIBUTION_ID" > "$metadata/distribution.json"
node infra/src/check-web-release.ts distribution "$metadata/distribution.json"
curl --retry 3 --retry-all-errors --max-time 30 --silent --show-error --head \
  --dump-header "$metadata/root-headers" --output /dev/null "$PREVIEW_WEB_URL/"
if test "$RELEASE_ENVIRONMENT" = development; then
  grep -Eiq '^x-robots-tag:.*noindex' "$metadata/root-headers"
elif grep -Eiq '^x-robots-tag:.*noindex' "$metadata/root-headers"; then
  echo 'Public production headers must not suppress indexing' >&2
  exit 1
fi
curl --fail --retry 3 --retry-all-errors --max-time 30 --silent --show-error "$PREVIEW_API_URL/health" > "$metadata/health.json"
node infra/src/check-web-release.ts health "$metadata/health.json"
status=$(curl --max-time 30 --silent --show-error --output /dev/null --write-out "%{http_code}" "$PREVIEW_API_URL/me")
test "$status" = "401"

previous=absent
if aws s3api get-object --bucket "$PREVIEW_BUCKET" --key index.html --expected-bucket-owner "$AWS_ACCOUNT_ID" "$metadata/previous-index.html" > /dev/null 2> "$metadata/previous-error"; then
  previous=$(sha256sum "$metadata/previous-index.html" | cut -d' ' -f1)
elif ! grep -Eq 'NoSuchKey|Not Found|\(404\)' "$metadata/previous-error"; then
  cat "$metadata/previous-error" >&2
  exit 1
fi

for asset in "$candidate"/assets/*; do
  name=$(basename "$asset")
  case "$name" in
    *.js) content_type=text/javascript ;;
    *.css) content_type=text/css ;;
    *) echo "Unsupported release asset type: $name" >&2; exit 1 ;;
  esac
  if ! aws s3api put-object --bucket "$PREVIEW_BUCKET" --key "assets/$name" --body "$asset" \
    --expected-bucket-owner "$AWS_ACCOUNT_ID" --if-none-match '*' --content-type "$content_type" \
    --cache-control 'public,max-age=31536000,immutable' > /dev/null 2> "$metadata/asset-error"; then
    aws s3api get-object --bucket "$PREVIEW_BUCKET" --key "assets/$name" --expected-bucket-owner "$AWS_ACCOUNT_ID" "$metadata/existing-asset" > /dev/null
    cmp "$asset" "$metadata/existing-asset"
  fi
done
aws s3api put-object --bucket "$PREVIEW_BUCKET" --key index.html --body "$candidate/index.html" \
  --expected-bucket-owner "$AWS_ACCOUNT_ID" --content-type text/html --cache-control no-cache > /dev/null
promotion=entrypoint-written
invalidation=$(aws cloudfront create-invalidation --distribution-id "$PREVIEW_DISTRIBUTION_ID" --paths '/*' --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --distribution-id "$PREVIEW_DISTRIBUTION_ID" --id "$invalidation"
node infra/src/verify-web.ts "$candidate" "$manifest" "$CANDIDATE_DIGEST" "$GITHUB_SHA"
promotion=verified
