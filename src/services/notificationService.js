import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Service to handle in-app reminders and native Android local notifications via Capacitor.
 * Supports presets: On the Day (0), 45 days before, 30 days before, 7 days before, and custom days.
 */

export async function requestNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch (err) {
      console.warn('Capacitor LocalNotifications permission request error:', err);
      return false;
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (err) {
      console.warn('Web Notification permission request error:', err);
      return false;
    }
  }
  return false;
}

export async function checkNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'granted';
    } catch (err) {
      return false;
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission === 'granted';
  }
  return false;
}

let isListenerAdded = false;

/**
 * Handle user tapping on native notifications:
 * - Today (0 days before): Can launch WhatsApp greeting.
 * - Advance reminders (1d, 7d, 30d, 45d): Simply opens the app on the Important Dates page for planning.
 */
export function initNotificationListeners(onNavigate) {
  if (Capacitor.isNativePlatform() && !isListenerAdded) {
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extra = action.notification.extra || {};
      const daysBefore = extra.daysBefore ?? 1;

      if (daysBefore === 0 && extra.phone) {
        // Same day event: Open WhatsApp directly
        const typeLabel = getTypeTitle(extra.type);
        const name = extra.name || 'Friend';
        const msg = `Dear ${name}, wishing you a very Happy ${typeLabel}! 🎂🎉 May you be blessed with joy, health, and success! 🌟`;
        let cleanPhone = extra.phone.replace(/[^\d]/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
      }

      if (typeof onNavigate === 'function') {
        onNavigate({ page: 'important_dates', extra });
      }
    });
    isListenerAdded = true;
  }
}

/**
 * Schedule native Android local notifications for important dates based on configured reminders.
 */
export async function scheduleReminders(importantDates = []) {
  if (!importantDates || importantDates.length === 0) return;

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }

    // Cancel existing scheduled notifications
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    }

    const today = new Date();
    const notificationsToSchedule = [];

    importantDates.forEach((item, index) => {
      if (!item.date) return;
      const parts = item.date.split('-');
      if (parts.length < 3) return;

      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const day = parseInt(parts[2], 10);
      const itemType = (item.type || 'other').toLowerCase();
      const typeLabel = getTypeTitle(itemType);
      const name = item.name || 'Contact';

      const reminders = Array.isArray(item.reminders)
        ? item.reminders.map(Number).filter(n => !isNaN(n))
        : [0, 7, 30, 45];

      // Next occurrence date
      let targetDate = new Date(today.getFullYear(), month, day, 9, 0, 0); // 9:00 AM
      if (targetDate < today && (today.getTime() - targetDate.getTime()) > 86400000) {
        targetDate = new Date(today.getFullYear() + 1, month, day, 9, 0, 0);
      }

      reminders.forEach((daysBefore, rIdx) => {
        const scheduleAt = new Date(targetDate);
        scheduleAt.setDate(scheduleAt.getDate() - daysBefore);

        if (scheduleAt > today) {
          let title = '';
          let body = '';
          if (daysBefore === 0) {
            title = `🔔 Today: ${name}'s ${typeLabel}!`;
            body = `Today is ${name}'s ${typeLabel}. Don't forget to wish them!`;
          } else if (daysBefore === 1) {
            title = `🔔 Tomorrow: ${name}'s ${typeLabel}`;
            body = `Tomorrow is ${name}'s ${typeLabel} (${formatShortDate(targetDate)}).`;
          } else if (daysBefore === 7) {
            title = `🔔 In 7 days: ${name}'s ${typeLabel}`;
            body = `${name}'s ${typeLabel} is in 1 week on ${formatShortDate(targetDate)}.`;
          } else if (daysBefore === 30) {
            title = `🔔 In 30 days: ${name}'s ${typeLabel}`;
            body = `${name}'s ${typeLabel} is in 1 month on ${formatShortDate(targetDate)}.`;
          } else if (daysBefore === 45) {
            title = `🔔 In 45 days: ${name}'s ${typeLabel}`;
            body = `${name}'s ${typeLabel} is coming up in 45 days on ${formatShortDate(targetDate)}.`;
          } else {
            title = `🔔 In ${daysBefore} days: ${name}'s ${typeLabel}`;
            body = `${name}'s ${typeLabel} is scheduled on ${formatShortDate(targetDate)}.`;
          }

          notificationsToSchedule.push({
            id: (index * 100) + rIdx + 1,
            title,
            body,
            schedule: { at: scheduleAt },
            sound: 'beep.wav',
            smallIcon: 'ic_stat_name',
            extra: { id: item._id, type: itemType, phone: item.phone, daysBefore }
          });
        }
      });
    });

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule.slice(0, 50) // Capacitor limits
      });
      console.log(`Scheduled ${notificationsToSchedule.length} local notifications.`);
    }
  } catch (err) {
    console.warn('Error scheduling local notifications:', err);
  }
}

/**
 * Extract active in-app reminders for today, 7 days, 30 days, 45 days, or custom days.
 */
export function getActiveInAppReminders(items = []) {
  if (!items || !Array.isArray(items)) return [];

  const reminders = [];

  items.forEach(item => {
    const daysUntil = item.days_until;
    if (daysUntil === undefined || daysUntil === null) return;

    const userReminders = Array.isArray(item.reminders)
      ? item.reminders.map(Number).filter(n => !isNaN(n))
      : [0, 7, 30, 45];

    const typeLabel = getTypeTitle(item.type);
    const icon = getTypeIcon(item.type);

    const isTriggered = userReminders.includes(daysUntil);
    const isUpcomingSoon = (daysUntil >= 0 && daysUntil <= 7 && userReminders.some(r => r >= daysUntil));

    if (isTriggered || isUpcomingSoon) {
      let badge = '';
      let badgeColor = '#3b82f6';
      let urgency = 'low';

      if (daysUntil === 0) {
        badge = 'Today (9:00 AM)';
        badgeColor = '#ec4899';
        urgency = 'high';
      } else if (daysUntil === 1) {
        badge = 'Tomorrow (1 day before)';
        badgeColor = '#f59e0b';
        urgency = 'medium';
      } else if (daysUntil === 7) {
        badge = 'In 7 days (1 week before)';
        badgeColor = '#3b82f6';
      } else if (daysUntil === 30) {
        badge = 'In 30 days';
        badgeColor = '#6366f1';
      } else if (daysUntil === 45) {
        badge = 'In 45 days';
        badgeColor = '#8b5cf6';
      } else {
        badge = `In ${daysUntil} days`;
        badgeColor = '#2563eb';
      }

      reminders.push({
        ...item,
        badge,
        badgeColor,
        urgency,
        message: `${badge}: ${item.name}'s ${typeLabel}`,
        typeLabel,
        icon
      });
    }
  });

  return reminders.sort((a, b) => (a.days_until ?? 999) - (b.days_until ?? 999));
}

function getTypeTitle(type) {
  switch ((type || '').toLowerCase()) {
    case 'birthday': return 'Birthday';
    case 'wedding': return 'Wedding Anniversary';
    case 'death': return 'Death Anniversary';
    case 'shop_opening': return 'Shop Opening';
    case 'business_anniversary': return 'Business Anniversary';
    default: return 'Special Date';
  }
}

function getTypeIcon(type) {
  switch ((type || '').toLowerCase()) {
    case 'birthday': return '🎂';
    case 'wedding': return '💍';
    case 'death': return '🕯️';
    case 'shop_opening': return '🏪';
    default: return '📅';
  }
}

function formatShortDate(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
