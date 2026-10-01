#!/bin/bash
set -e

if [ -z "$APP_URL" ]; then
  echo "Set APP_URL first, for example:"
  echo "export APP_URL='https://diy-timeclock.vercel.app'"
  exit 1
fi

if [ -z "$CRON_SECRET" ]; then
  echo "Set CRON_SECRET first."
  exit 1
fi

curl -i \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/reports/weekly-help-time"
