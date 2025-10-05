#!/bin/bash

# Twitter username is the first argument
USERNAME=$1

if [ -z "$USERNAME" ]; then
  echo "Usage: $0 <twitter-username>"
  exit 1
fi

# Function to find the project root (where .env exists)
find_project_root() {
  DIR=$(pwd)
  while [ "$DIR" != "/" ]; do
    if [ -f "$DIR/.env" ]; then
      echo "$DIR"
      return
    fi
    DIR=$(dirname "$DIR")
  done
  return 1
}

PROJECT_ROOT=$(find_project_root)

if [ -z "$PROJECT_ROOT" ]; then
  echo "Error: .env file not found in any parent directory."
  exit 1
fi

# Load .env from the project root
set -a
source "$PROJECT_ROOT/.env"
set +a

# Check token
if [ -z "$TWITTER_BEARER_TOKEN" ]; then
  echo "Error: TWITTER_BEARER_TOKEN not found in .env file."
  exit 1
fi

# Call Twitter API
RESPONSE=$(curl -s "https://api.x.com/2/users/by/username/$USERNAME" \
  -H "Authorization: Bearer $TWITTER_BEARER_TOKEN")

# Extract user ID using jq
USER_ID=$(echo "$RESPONSE" | jq -r '.data.id')

if [ "$USER_ID" = "null" ] || [ -z "$USER_ID" ]; then
  echo "Failed to fetch user ID. Response:"
  echo "$RESPONSE"
  exit 1
fi

echo "Twitter ID for @$USERNAME: $USER_ID"
