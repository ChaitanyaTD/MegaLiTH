#!/bin/bash

# Twitter username is the first argument
USERNAME=$1

# Check if username is provided
if [ -z "$USERNAME" ]; then
  echo "Usage: $0 <twitter-username>"
  exit 1
fi

# Your Twitter API Bearer Token
BEARER_TOKEN="AAAAAAAAAAAAAAAAAAAAADd24QEAAAAA%2FsGqfniGcGlEtdcBTKYINQIQSso%3DDeDBC7uqyD9wIDOeKgakoaKmqOGvp54BkQ9mA5NHSYpsaIhnlA"

# Call Twitter API to get user info
RESPONSE=$(curl -s "https://api.x.com/2/users/by/username/$USERNAME" \
  -H "Authorization: Bearer $BEARER_TOKEN")

# Extract user ID using jq (make sure jq is installed)
USER_ID=$(echo "$RESPONSE" | jq -r '.data.id')

# Check if user ID exists
if [ "$USER_ID" = "null" ] || [ -z "$USER_ID" ]; then
  echo "Failed to fetch user ID. Response:"
  echo "$RESPONSE"
  exit 1
fi

echo "Twitter ID for @$USERNAME: $USER_ID"
