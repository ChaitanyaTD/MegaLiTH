#!/usr/bin/env bash
set -e

PORT=3000
ENV_FILE=".env.local"

# start ngrok in background
ngrok http $PORT --log=stdout > /tmp/ngrok.log 2>&1 & 
NGROK_PID=$!
sleep 1

# wait until the local API is up
sleep 1

# fetch tunnels info
for i in {1..10}; do
  JSON=$(curl -s http://127.0.0.1:4040/api/tunnels || true)
  URL=$(echo "$JSON" | jq -r '.tunnels[0].public_url' 2>/dev/null)
  if [[ "$URL" != "null" && -n "$URL" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -z "$URL" || "$URL" == "null" ]]; then
  echo "Failed to get ngrok URL"
  kill $NGROK_PID || true
  exit 1
fi

echo "ngrok URL: $URL"

# update .env.local (make a backup)
cp $ENV_FILE ${ENV_FILE}.bak || true
sed -E -i '' "s~^BASE_URL=.*~BASE_URL=${URL}~" $ENV_FILE 2>/dev/null || \
  echo "BASE_URL=${URL}" >> $ENV_FILE

# set redirect URI example
REDIRECT="${URL}/api/twitter/callback"
sed -E -i '' "s~^X_REDIRECT_URI=.*~X_REDIRECT_URI=${REDIRECT}~" $ENV_FILE 2>/dev/null || \
  echo "X_REDIRECT_URI=${REDIRECT}" >> $ENV_FILE

echo ".env updated with ngrok URL."

# start Next dev server
npm run dev
# when you stop dev server, kill ngrok
kill $NGROK_PID

# Note this is for updating .env.local file when using ngrok for local testing