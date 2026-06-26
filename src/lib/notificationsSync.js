import { supabase } from './supabaseClient.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Checks if browser supports Service Workers, Notifications, and Push API.
 */
export function isNotificationSupported() {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window &&
         'serviceWorker' in navigator &&
         'PushManager' in window;
}

/**
 * Returns current Notification permission status.
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests Notification permission from user.
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Detects device platform shorthand from user agent.
 */
export function getDeviceLabel() {
  if (typeof window === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'iOS Device';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Macintosh/.test(ua)) return 'macOS Device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Desktop Web';
}

/**
 * Retrieves the current push subscription from service worker registration.
 */
export async function getPushSubscription() {
  if (!isNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[NotificationsSync] Error checking push subscription:', err);
    return null;
  }
}

/**
 * Subscribes user to push notifications and saves subscription info to Supabase.
 */
export async function subscribeToPushNotifications() {
  if (!isNotificationSupported()) {
    throw new Error('Notificações Push não são suportadas neste navegador/dispositivo.');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('A chave pública VAPID não está configurada (VITE_VAPID_PUBLIC_KEY em falta).');
  }

  // Request permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão para notificações não foi concedida pelo usuário.');
  }

  const registration = await navigator.serviceWorker.ready;

  // Convert VAPID key
  const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
  });

  await savePushSubscriptionToSupabase(subscription);
  return subscription;
}

/**
 * Saves or updates push subscription to Supabase.
 */
export async function savePushSubscriptionToSupabase(subscription) {
  if (!supabase || !subscription) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Formato da assinatura de push inválido.');
  }

  const payload = {
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    device_label: getDeviceLabel(),
    user_agent: navigator.userAgent,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'user_id,endpoint' });

  if (error) {
    console.error('[NotificationsSync] Error saving push subscription to Supabase:', error);
    throw error;
  }
}

/**
 * Unsubscribes user from browser push service and deletes record from Supabase.
 */
export async function unsubscribeFromPushNotifications() {
  if (!isNotificationSupported()) return;

  try {
    const subscription = await getPushSubscription();
    if (!subscription) return;

    // Delete remote subscription record
    if (supabase) {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);
      if (error) {
        console.warn('[NotificationsSync] Failed to delete remote subscription record:', error.message);
      }
    }

    // Unsubscribe from browser manager
    return await subscription.unsubscribe();
  } catch (err) {
    console.error('[NotificationsSync] Error during unsubscription:', err);
    throw err;
  }
}

/**
 * Helper: Converts VAPID base64 key to Uint8Array.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
