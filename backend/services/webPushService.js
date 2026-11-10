// 📣 PRIME DREEMS — WEB PUSH SERVICE (FCM-STYLE)
// Manages VAPID keys (persisted in system_settings) and sends Web Push
// notifications to stored browser subscriptions. Falls back gracefully when
// web-push is unavailable or the subscription is stale.

const webpush = require('web-push');
const { SystemSetting } = require('../db/models');

const VAPID_SUBJECT = 'mailto:no-reply@primedreems.com';

let vapidKeysCache = null;

async function getVapidKeys() {
  if (vapidKeysCache) return vapidKeysCache;
  try {
    const [setting] = await SystemSetting.findOrCreate({
      where: { key: 'vapid_keys' },
      defaults: {
        key: 'vapid_keys',
        value: JSON.stringify(webpush.generateVAPIDKeys()),
        description: 'Web Push VAPID public/private keys',
      },
    });
    vapidKeysCache = JSON.parse(setting.value);
  } catch (err) {
    // Fallback: generate in-memory keys (not persisted) so local dev works.
    vapidKeysCache = webpush.generateVAPIDKeys();
    console.warn('⚠️ [WebPush] Could not persist VAPID keys, using in-memory:', err.message);
  }
  return vapidKeysCache;
}

async function ensureConfigured() {
  const keys = await getVapidKeys();
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  return keys;
}

/**
 * Send a Web Push notification to a subscription. Resolves true on success.
 */
async function sendToSubscription(subscription, payload) {
  try {
    await ensureConfigured();
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message, statusCode: err.statusCode };
  }
}

/**
 * Validate an incoming subscription object from the browser.
 */
function isValidSubscription(sub) {
  return !!(
    sub &&
    typeof sub.endpoint === 'string' &&
    sub.endpoint.startsWith('http') &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  );
}

module.exports = { getVapidKeys, ensureConfigured, sendToSubscription, isValidSubscription };
