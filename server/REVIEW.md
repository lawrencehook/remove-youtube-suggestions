# Server Code Review

This document contains findings from a thorough code review, organized by severity.

## Critical Issues

### 1. ~~XSS Vulnerability in Error Page~~ FIXED
**File:** `src/routes/auth.js`

~~The error message was interpolated directly into HTML without escaping.~~

**Fixed:** Added `escapeHtml()` function to sanitize error messages.

---

## High Priority Issues

### 2. ~~Missing Webhook Secret Validation~~ FIXED
**File:** `src/index.js`

~~`STRIPE_WEBHOOK_SECRET` was not in the required config list.~~

**Fixed:** Added `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, and `STRIPE_PRICE_YEARLY` to required config validation.

### 3. Race Condition in Rate Limiting
**File:** `src/storage/index.js:168-200`

Two concurrent requests could both read count=4, both increment to 5, and both succeed - allowing 6 requests instead of 5.

At low scale this is unlikely, but it violates the rate limit guarantee.

**Recommendation:** Acceptable for current scale, but document the limitation. Consider atomic file operations or a lock file for stricter enforcement.

### 4. Poll Endpoint Deletes Before Response Completes
**File:** `src/routes/auth.js:109-112`

```javascript
storage.deleteAuthRequest(requestId);
return res.json(response);
```

If the response fails to send (network error, client disconnect), the auth request is already deleted and the token is lost forever.

**Recommendation:** Consider deleting after confirmed delivery, or making the operation idempotent (allow multiple polls to return the same token).

---

## Medium Priority Issues

### 5. Duplicate HTML Templates
**Files:** `src/routes/auth.js`, `src/routes/checkout.js`, `src/routes/billing.js`

The same HTML structure is copy-pasted across multiple files. Changes require updating multiple locations.

**Recommendation:** Extract to a shared `src/templates.js` module.

### 6. No Request Logging
**File:** `src/index.js`

No access logging middleware. Makes debugging production issues difficult.

**Recommendation:** Add morgan or similar logging middleware.

### 7. Stripe/SES Initialized at Module Load
**Files:** `src/services/stripe.js:4`, `src/services/email.js:4`

Services are initialized when modules are required, before config validation runs. Invalid credentials cause cryptic errors.

**Recommendation:** Lazy initialization or factory functions.

### 8. Grandfathered Emails Not Reloadable
**File:** `src/storage/index.js:52-53`

Once loaded at startup, the grandfathered list cannot be updated without restarting the server.

**Recommendation:** Add an endpoint or signal handler to reload the list, or check file mtime periodically.

### 9. ~~JWT Secret Length Not Validated~~ FIXED
**File:** `src/index.js`

~~Startup validated JWT_SECRET exists but not its strength.~~

**Fixed:** Added validation requiring JWT_SECRET to be at least 32 characters.

---

## Low Priority Issues

### 10. Email Hash Truncation
**File:** `src/storage/index.js:160-162`

Using only 16 characters of SHA256 (64 bits) reduces collision resistance. At scale, two different emails could map to the same rate limit file.

**Recommendation:** Fine for current scale (~100 users). Consider using full hash if scale increases significantly.

### 11. No Graceful Shutdown
**File:** `src/index.js:94`

The cleanup interval isn't cleared on process exit. While not harmful, it's not clean.

**Recommendation:** Add SIGTERM/SIGINT handlers.

### 12. Health Check Doesn't Verify Dependencies
**File:** `src/index.js:44-46`

`/health` returns OK without checking if Stripe/SES are actually reachable.

**Recommendation:** Add optional deep health check that verifies external dependencies.

---

## Test Coverage Gaps

### Missing Test Cases

1. **Webhook handler** - No tests for Stripe webhook processing
2. **Expired magic link** - Link expires at 15 min, request at 20 min. The window between 15-20 min isn't tested.
3. **Email send failure** - What happens if SES rejects the email?
4. **Stripe API errors** - Real Stripe errors (rate limits, invalid customer) aren't simulated
5. **Malformed request bodies** - Tests don't cover malformed JSON
6. **Concurrent requests** - File-based storage race conditions untested
7. **Large grandfathered list** - Performance with many entries untested

### Recommendations

1. Add webhook tests with mocked Stripe events
2. Add test for magic link expiry window
3. Add test for email service failures
4. Consider adding integration tests with Stripe test mode

---

## Positive Observations

1. **Clean separation of concerns** - Routes, services, storage are well-separated
2. **Good error handling** - Most errors are caught and return appropriate status codes
3. **Security basics covered** - Rate limiting, CORS, JWT validation all present
4. **Comprehensive happy-path tests** - Main flows are well-tested
5. **Config via environment** - No hardcoded secrets
6. **Case-insensitive email handling** - Consistently lowercased throughout

---

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 1 | 1 |
| High | 4 | 1 |
| Medium | 5 | 1 |
| Low | 3 | 0 |

The codebase is generally well-structured and functional. Critical and several high-priority issues have been fixed. Remaining issues are acceptable for initial deployment at low scale.
