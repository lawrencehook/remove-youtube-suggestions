# Premium Subscription Implementation Decisions

This document captures open questions about implementing the premium subscription system, with recommendations and space for decisions.

---

## 1. Which features will be premium?

**Question**: The spec describes infrastructure but not what users pay for. Are you gating existing features or adding new ones?

**Recommendation**: Don't gate existing features - this will anger your current user base. Instead, add new premium-only features. Good candidates based on the codebase:
- Cross-device settings sync
- Multiple schedule profiles (e.g., "work mode" vs "weekend mode")
- Per-channel customization rules
- Usage statistics/time tracking
- Advanced redirect rules (custom URLs, time-based redirects)

**User response**:
I don't think I mind angering my current user base by gating existing features. Perhaps I can add a grace period of 1-2 months where I can grandfather in users who have been using the extension for a while... does that make sense? It'd require some thought about how to notify users of the upcoming change.

---

## 2. Server technology stack?

**Question**: The spec is language-agnostic. What framework/language?

**Recommendation**: **Node.js with Express or Hono**, deployed on **Railway** or **Render**. Reasons:
- You're already writing JavaScript for the extension
- Simple deployment with automatic HTTPS
- Easy Stripe SDK integration
- Cheap at low scale (~$5-7/month)
- Hono is particularly good if you want the option to move to Cloudflare Workers later

**User response**:
I already have a personal server that I can deploy a node app to. But yes, node.js with express sounds like a good choice to me.

---

## 3. Email provider?

**Question**: Which service for magic link emails?

**Recommendation**: **Resend**. Reasons:
- Modern API, excellent DX
- Good deliverability out of the box
- Generous free tier (3,000 emails/month)
- Simple integration
- If you outgrow it, easy to swap to SendGrid/Postmark later

**User response**:
I have an SES account I can use for this.

---

## 4. Pricing?

**Question**: What should monthly/yearly cost?

**Recommendation**: **$3/month or $24/year** (33% yearly discount). Reasons:
- Low enough for impulse purchase
- $3 is the "cup of coffee" threshold
- Yearly discount encourages commitment without being too aggressive
- Similar extensions (Unhook, DF Tube) are free, so you need to be modest
- You can always raise prices for new subscribers later

**User response**:
$3 a month with $24 a year sounds good to me.

---

## 5. AuthRequest storage?

**Question**: In-memory vs Redis for pending auth requests?

**Recommendation**: **Upstash Redis**. Reasons:
- Serverless Redis, pay-per-request
- Free tier covers low volume easily
- Survives server restarts/deploys
- If you use Railway/Render, in-memory dies on every deploy
- Simple key-value operations, no complex setup

**User response**:
In-memory is fine. I don't expect many server restarts. Hmm... well now that I think about it, perhaps we can simply keep a file on-disk... the scale won't be huge.

---

## 6. Customer portal?

**Question**: Spec marks this as "out of scope" but users need to manage subscriptions.

**Recommendation**: **Include it in v1** - it's trivial. Add one endpoint:

```javascript
// POST /billing/portal
const session = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${BASE_URL}/portal-return`
});
return { url: session.url };
```

Then link to it from the extension's account page. Without this, users will email you to cancel, or worse, do chargebacks.

**User response**:
Sounds good to me.

---

## 7. Offline grace period?

**Question**: Cache TTL is 1 hour. What happens if a premium user is offline longer?

**Recommendation**: **7-day grace period**. Store `lastKnownPremium: true` and `lastSuccessfulCheck: timestamp`. If cache is expired but last successful check was within 7 days and user was premium, continue granting access. Only hard-block after 7 days of failed checks. Users with spotty internet shouldn't be punished.

**User response**:
Sounds good to me.

---

## 8. Poll timeout vs magic link expiry mismatch?

**Question**: Poll timeout (10 min) < magic link expiry (15 min). User could click link after extension gives up.

**Recommendation**: **Set poll timeout to 16 minutes** (slightly longer than link expiry). If the link is still valid, the extension should still be listening. Show a "still waiting..." message after 5 minutes with option to resend.

**User response**:
Sounds good to me.

---

## 9. CORS handling?

**Question**: Not mentioned in spec. Extension needs to call server APIs.

**Recommendation**: Add explicit CORS middleware allowing your extension's origin. For the server:

```javascript
app.use(cors({
  origin: [
    'chrome-extension://YOUR_EXTENSION_ID',
    'moz-extension://*'  // Firefox IDs vary per install
  ],
  credentials: true
}));
```

Note: Firefox extension IDs are per-installation, so you'll need a wildcard or to use `host_permissions` in manifest instead of relying on CORS origin checks.

**User response**:
Sounds good to me.

---

## 10. Rate limiting storage?

**Question**: How to persist rate limit counters across restarts?

**Recommendation**: **Use Upstash Redis** (same as AuthRequest storage). Simple pattern:

```javascript
const key = `ratelimit:magic-link:${email}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 3600); // 1 hour window
if (count > 5) throw new RateLimitError();
```

This gives you 5 magic link requests per email per hour, persisted.

**User response**:
Sounds good to me.

---

## 11. Premium UI in extension?

**Question**: How should premium features appear in the existing options UI?

**Recommendation**: **Add a "Premium" section in the sidebar** (after "Other"), containing all premium toggles. Each toggle should work normally if premium, or show a lock icon + "Upgrade" tooltip if not. Don't scatter premium features throughout existing sections - keep them grouped so users see the value proposition at a glance. Add a small "⭐ Premium" badge in the header showing status.

**User response**:
I'm not a fan. I think I'll gate existing features. Perhaps next to each feature I can render some indication that it is premium. and in the JSON structure, I can put a isPremium boolean.

---

## 12. Migration path for existing users?

**Question**: How do current users transition? Any grandfathering?

**Recommendation**: **No grandfathering needed** if you follow recommendation #1 (don't gate existing features). Existing users keep everything they have. Premium is purely additive. Announce it as "we added premium features to support development - all your current features remain free forever."

**User response**:
All users who have made a donation in the past will be grandfathered. I can populated a short txt/json file with all emails of people who have donated.

---

## 13. Premium status in Mixpanel?

**Question**: Should you track premium status in analytics?

**Recommendation**: **Yes**, add a user property `premium: true/false` and track events like `upgrade_started`, `upgrade_completed`, `upgrade_prompt_shown`. This lets you analyze:
- Conversion rate from prompt to purchase
- Which features drive upgrades
- Churn correlation with usage patterns

Just respect the existing `log_enabled` opt-out setting.

**User response**:
Sounds good to me.

---

## Summary of Decisions

| Question | Decision |
|----------|----------|
| 1. Premium features | **Deferred** - will gate existing features, specific list TBD |
| 2. Server stack | Node.js + Express on personal server |
| 3. Email provider | AWS SES |
| 4. Pricing | $3/month, $24/year |
| 5. AuthRequest storage | File-based, directory-per-record (see storage section below) |
| 6. Customer portal | Include in v1 via Stripe billing portal |
| 7. Offline grace period | 7 days |
| 8. Poll timeout | 16 minutes (> 15 min link expiry) |
| 9. CORS handling | Standard CORS middleware for extension origins |
| 10. Rate limiting | File-based, same directory approach |
| 11. Premium UI | Gate existing features with `isPremium` flag in settings JSON, show lock indicator |
| 12. Migration path | 1-2 month notification period before paywall; past donors grandfathered via email list |
| 13. Mixpanel tracking | Yes, track premium status and upgrade events |

---

## Storage Design

File-based storage with directory-per-record pattern:

```
server/
  data/
    auth-requests/
      {timestamp}-{request_id}.json   # e.g., 1705678800000-abc123.json
    rate-limits/
      {email-hash}.json
    grandfathered.json                # read-only, ~100 donor emails, cached in memory
```

**AuthRequest files**: Include timestamp in filename for easy pruning (e.g., cron job deletes files older than 1 hour).

**Grandfathered list**: Read-only JSON array, loaded into memory on server start. Server checks this list in `/license/check` before querying Stripe.

---

## Notification Strategy

In-extension banner/notification announcing upcoming paywall, displayed for 1-2 months before premium features are gated. Details TBD.

---

## Open Items

- [ ] Which specific features will be premium vs free
- [ ] Banner/notification UI design
- [ ] Exact timeline for paywall rollout
