# Check Production Logs for Calendar Failures

This guide helps you investigate why the calendar API is failing.

## Quick Diagnosis

Run this command to check recent production logs:

```bash
# If you have Render CLI installed:
render logs -s automation-mail-backend --tail 100 | grep -i "calendar\|meeting\|failed"

# Or visit the Render dashboard:
# https://dashboard.render.com → automation-mail-backend → Logs
```

## Common Failure Reasons

### 1. **Google Calendar API Rate Limits**
- Google Calendar API has quota limits
- Check if you're hitting rate limits
- Look for errors like: `429 Too Many Requests` or `quotaExceeded`

**Solution**: Added retry logic with exponential backoff (now in code)

### 2. **Token Expiration**
- Refresh tokens can expire or become invalid
- Look for: `invalid_grant` or `Token has been expired or revoked`

**Solution**: Regenerate refresh token:
```bash
node get-refresh-token.js
```

### 3. **Calendar Busy/Free Query Timeout**
- Network timeouts when checking calendar availability
- Look for: `ETIMEDOUT`, `ECONNRESET`, `socket hang up`

**Solution**: Already added retry logic

### 4. **Insufficient Permissions**
- OAuth scope issues
- Look for: `insufficient permissions` or `access_denied`

**Solution**: Re-authorize with correct scopes in get-refresh-token.js

## Manual Log Check via Render Dashboard

1. Go to: https://dashboard.render.com
2. Click on `automation-mail-backend` service
3. Click "Logs" tab
4. Search for keywords:
   - "Failed to generate meeting proposals"
   - "calendar"
   - "❌"
   - "error"

## What to Look For

Good logs (success):
```
✅ Generated 3 meeting proposals
```

Bad logs (failure):
```
❌ Attempt 1/3 failed: [error message]
⚠️ ALL RETRIES EXHAUSTED - Email will be sent without meeting proposals
```

## Environment Variables Check

Make sure these are set in Render:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `MY_EMAIL`

Check in Render Dashboard → Settings → Environment Variables

## Test Calendar API Locally

```bash
# Test if calendar credentials work
node -e "
const { CalendarService } = require('./server/services/calendarService');
const cal = new CalendarService(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REFRESH_TOKEN
);
cal.generateProposals(
  new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  new Date(Date.now() + 21*24*60*60*1000).toISOString(),
  process.env.MY_EMAIL,
  []
).then(p => console.log('✅ Works!', p.length, 'proposals'))
  .catch(e => console.error('❌ Failed:', e.message));
"
```

## Next Steps After Deploying Fix

1. Deploy the updated code with retry logic
2. Monitor next few email generations
3. Check if warnings appear in UI
4. Run backfill script for existing entries:
   ```bash
   node backfill-meetings.js
   ```
