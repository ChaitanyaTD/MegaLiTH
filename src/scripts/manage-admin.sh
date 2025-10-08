#!/bin/bash
# manage-admin.sh
# Simple wrapper script that calls the Node.js admin manager

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the TypeScript script using tsx
npx tsx "$SCRIPT_DIR/manage-admin.ts" "$@"