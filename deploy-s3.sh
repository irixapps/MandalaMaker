#!/bin/bash
# Deploy mandala-maker/ to the live mandalize.net site (S3 + CloudFront).
#
# Usage: ./deploy-s3.sh
#
# What it does:
#   1. Syncs this directory to s3://mandalize/, deleting any remote files
#      that no longer exist locally (so renamed/removed files, like the
#      examples/*.json -> *.js migration, actually take effect live).
#   2. Invalidates the whole CloudFront distribution so the change is
#      visible immediately instead of waiting out the CDN cache TTL.
#
# Requires the "mandalize-deploy" AWS CLI profile to already be configured
# (aws configure --profile mandalize-deploy) with access scoped to the
# mandalize S3 bucket and CloudFront invalidations.

set -euo pipefail

PROFILE="mandalize-deploy"
BUCKET="s3://mandalize"
DISTRIBUTION_ID="E17RY2OP3IUK0X"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Syncing $SCRIPT_DIR to $BUCKET ..."
aws s3 sync "$SCRIPT_DIR" "$BUCKET" \
  --profile "$PROFILE" \
  --delete \
  --exclude ".git/*" \
  --exclude ".gitignore" \
  --exclude ".DS_Store" \
  --exclude "*/.DS_Store" \
  --exclude ".claude/*" \
  --exclude "deploy-s3.sh" \
  --exclude "README.md"

echo "==> Invalidating CloudFront distribution $DISTRIBUTION_ID ..."
aws cloudfront create-invalidation \
  --profile "$PROFILE" \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*"

echo "==> Done. Changes should be live within a minute or two."
