#!/usr/bin/env bash
# Near Wheels — deploy to Google Cloud Run.
# Prereqs: gcloud CLI, `gcloud auth login`, a Google Cloud project, Artifact Registry repo.
#
#   ./cloud/deploy.sh <PROJECT_ID> [REGION]
#
# Reads secrets from .env (which stays local — only listed vars are passed to Cloud Build).

set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <PROJECT_ID> [REGION]}"
REGION="${2:-us-central1}"

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found" >&2
  exit 1
fi

# Load .env values (quoted-safe)
set -a
source .env
set +a

echo "==> Ensuring Artifact Registry repo exists (europe-wide repo 'near-wheels'"
gcloud artifacts repositories create near-wheels --repository-format=docker \
  --location="${REGION}" --project="${PROJECT_ID}" --no-user-output-enabled 2>/dev/null || true

echo "==> Submitting Cloud Build for ${PROJECT_ID} (region ${REGION})"
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project="${PROJECT_ID}" \
  --substitutions=^#^\
PROJECT_ID="${PROJECT_ID}",\
_REGION="${REGION}",\
_NEXT_PUBLIC_RAZORPAY_KEY_ID="${NEXT_PUBLIC_RAZORPAY_KEY_ID:-}",\
_NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://nearwheels.example.com}",\
_DATABASE_URL="${DATABASE_URL}",\
_SESSION_SECRET="${SESSION_SECRET}",\
_ADMIN_PHONE="${ADMIN_PHONE}",\
_ADMIN_PASSWORD="${ADMIN_PASSWORD}",\
_DEMO_CUSTOMER_PHONE="${DEMO_CUSTOMER_PHONE:-}",\
_GEMINI_API_KEY="${GEMINI_API_KEY:-}",\
_GEMINI_MODEL="${GEMINI_MODEL:-gemini-1.5-flash}",\
_PAYMENT_MODE="${PAYMENT_MODE:-simulated}",\
_SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-}" \
  .

echo ""
echo "==> Done. Your app is live at:"
echo "  https://near-wheels-${PROJECT_ID}.${REGION}.run.app"
echo ""
echo "Remaining manual steps:"
echo "  1. Create the RAZORPAY_* secret versions in Secret Manager, filled in cloudbuild.yaml substitutions."
echo "  2. Point your custom domain (App Engine/Cloud Run custom domains) at the *.run.app URL."
echo "  3. For persistent uploads, mount a Cloud Storage bucket at /app/data/uploads (see README)."