const express = require('express');
const { authenticate, isAdmin } = require('../middleware/auth');
const { Notification, PushSubscription } = require('../db/models');
const { getVapidKeys, sendToSubscription, isValidSubscription } = require('../services/webPushService');

const router = express.Router();

// Fetch notifications for the user (only within last 30 days, auto-purging older entries)
router.get('/', authenticate, async (req, res) => {
  try {
    const actualUserId = req.userId;
    const { Op } = require('sequelize');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Auto-purge notifications older than 30 days
    await Notification.destroy({
      where: {
        createdAt: { [Op.lt]: thirtyDaysAgo }
      }
    }).catch(() => {});

    const notifications = await Notification.findAll({
      where: {
        [Op.or]: [{ user_id: actualUserId }, { user_id: null }],
        createdAt: { [Op.gte]: thirtyDaysAgo }
      },
      order: [['createdAt', 'DESC']],
      limit: 200
    });

    // We need to parse read_by to see if it's read by this user
    const processed = notifications.map(n => {
      const nObj = n.toJSON();
      let readByArray = [];
      try {
        readByArray = JSON.parse(nObj.read_by || '[]');
      } catch (e) {}
      
      const isRead = readByArray.includes(actualUserId);
      nObj.isRead = isRead;
      nObj.is_read = isRead;
      delete nObj.read_by; // don't send large arrays to frontend
      return nObj;
    });

    res.json(processed);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const actualUserId = req.userId;

    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Not found' });

    let readByArray = [];
    try {
      readByArray = JSON.parse(notification.read_by || '[]');
    } catch (e) {}

    if (!readByArray.includes(actualUserId)) {
      readByArray.push(actualUserId);
      notification.read_by = JSON.stringify(readByArray);
      await notification.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const actualUserId = req.userId;

    const notifications = await Notification.findAll();
    for (const notification of notifications) {
      let readByArray = [];
      try {
        readByArray = JSON.parse(notification.read_by || '[]');
      } catch (e) {}
      
      if (!readByArray.includes(actualUserId)) {
        readByArray.push(actualUserId);
        notification.read_by = JSON.stringify(readByArray);
        await notification.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ─── Web Push (FCM-style) subscription & broadcast ───

// Expose the VAPID public key so the browser can subscribe.
router.get('/push/public-key', async (req, res) => {
  try {
    const keys = await getVapidKeys();
    res.json({ success: true, publicKey: keys.publicKey });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get push key' });
  }
});

// Save the browser's push subscription for the authenticated user.
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const body = req.body || {};
    const sub = body.subscription || body;
    if (!isValidSubscription(sub)) {
      return res.status(400).json({ error: 'Invalid push subscription' });
    }
    const userAgent = (req.get('user-agent') || '').slice(0, 300);
    await PushSubscription.upsert({
      user_id: req.userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent,
    });
    res.json({ success: true, message: 'Push subscription saved' });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove the browser's push subscription (used by logout / toggle-off).
router.delete('/unsubscribe', authenticate, async (req, res) => {
  try {
    const endpoint = req.query?.endpoint || req.body?.subscription?.endpoint || req.body?.endpoint;
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint is required' });
    }
    await PushSubscription.destroy({ where: { user_id: req.userId, endpoint } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List the current user's push subscriptions count (for UI state).
router.get('/subscriptions', authenticate, async (req, res) => {
  try {
    const count = await PushSubscription.count({ where: { user_id: req.userId } });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Broadcast a push notification to ALL users (admin only).
router.post('/broadcast', authenticate, isAdmin, async (req, res) => {
  try {
    const { title = 'Prime Dreems', message = '', type = 'system' } = req.body || {};
    const subscriptions = await PushSubscription.findAll();
    const payload = { title, message, type };

    // Persist an in-app notification as well.
    await Notification.create({ user_id: null, title, message, type });

    let sent = 0;
    let failed = 0;
    for (const sub of subscriptions) {
      const result = await sendToSubscription(sub, payload);
      if (result.ok) sent += 1;
      else failed += 1;
    }

    res.json({ success: true, sent, failed, total: subscriptions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
