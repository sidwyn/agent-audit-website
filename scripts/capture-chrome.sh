#!/bin/bash
URL="$1"
FILENAME="$2"
WAIT_TIME="$3"

# 1. Bring Chrome to front
osascript -e 'tell application "Google Chrome" to activate'
sleep 1

# 2. Navigate if URL is provided
if [ -n "$URL" ]; then
  osascript -e "tell application \"Google Chrome\" to set URL of active tab of window 1 to \"$URL\""
  sleep "$WAIT_TIME"
fi

# 3. Try to dismiss common Shopify popups/modals with Escape
osascript -e 'tell application "System Events" to key code 53'
sleep 1

# 4. Get window bounds
# Note: items are {x1, y1, x2, y2}
X=$(osascript -e 'tell application "Google Chrome" to get item 1 of (get bounds of window 1)')
Y=$(osascript -e 'tell application "Google Chrome" to get item 2 of (get bounds of window 1)')
X2=$(osascript -e 'tell application "Google Chrome" to get item 3 of (get bounds of window 1)')
Y2=$(osascript -e 'tell application "Google Chrome" to get item 4 of (get bounds of window 1)')

WIDTH=$((X2 - X))
HEIGHT=$((Y2 - Y))

# 5. Capture cropped to window
echo "Action: Capturing $FILENAME (Window bounds: $X,$Y to $X2,$Y2)"
screencapture -x -R"$X,$Y,$WIDTH,$HEIGHT" "inbox/ridge.com/$FILENAME"
