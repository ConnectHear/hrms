/**
 * ConnectHear's DIY Web Push library for the HRMS PWA.
 *
 * Replaces the Frappe-Cloud-relay-specific lib (this file was a 0-byte
 * placeholder in upstream). Uses the native Web Push API + VAPID keys
 * stored in our site_config.json — no Frappe Cloud, no FCM.
 *
 * Public API (matches what main.js + AppSettings.vue already expect):
 *   - new FrappePushNotification()
 *   - init(swRegistration, vapidPublicKeyBase64Url)  — async, sets state
 *   - isNotificationEnabled()                        — bool (sync)
 *   - enableNotification()                           — async → { permission_granted, subscribed }
 *   - disableNotification()                          — async → { unsubscribed }
 *   - sendTestPush()                                 — async → { sent }
 *
 * Wire path:
 *   PWA → PushManager.subscribe(VAPID) → POST /api/method/
 *     hr_automations.web_push.subscribe.subscribe
 *   Server stores Push Subscription row.
 *   On Notification Log.after_insert (filtered), backend enqueues
 *     hr_automations.web_push.sender.send_notification_log_push
 *   pywebpush signs + POSTs to the browser's push endpoint.
 *   Service worker receives 'push' event → showNotification().
 */

const API_SUBSCRIBE = "/api/method/hr_automations.web_push.subscribe.subscribe"
const API_UNSUBSCRIBE = "/api/method/hr_automations.web_push.subscribe.unsubscribe"
const API_SEND_TEST = "/api/method/hr_automations.web_push.subscribe.send_test"

function urlBase64ToUint8Array(base64String) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
	const raw = window.atob(base64)
	const arr = new Uint8Array(raw.length)
	for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
	return arr
}

function csrfToken() {
	// HRMS exposes the token as `window.csrf_token` (rendered into the
	// hrms.html template), NOT under window.frappe.boot.
	return window.csrf_token
		|| (window.frappe && window.frappe.boot && window.frappe.boot.csrf_token)
		|| ""
}

async function postJSON(url, body) {
	const res = await fetch(url, {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			"X-Frappe-CSRF-Token": csrfToken(),
		},
		body: JSON.stringify(body || {}),
	})
	const text = await res.text()
	let data
	try { data = JSON.parse(text) } catch (e) { data = { _raw: text } }
	if (!res.ok) {
		const msg = data?._server_messages
			? (() => { try { return JSON.parse(JSON.parse(data._server_messages)[0]).message } catch { return text } })()
			: data?.exception || data?.message || `HTTP ${res.status}`
		throw new Error(String(msg).replace(/<[^>]+>/g, "").slice(0, 300))
	}
	return data.message ?? data
}

export default class FrappePushNotification {
	constructor() {
		this.registration = null
		this.vapidPublicKey = ""
		this.ready = false
		this._lastKnownSubscribed = false
	}

	async init(registration, vapidPublicKeyBase64Url) {
		this.registration = registration
		this.vapidPublicKey = vapidPublicKeyBase64Url || ""
		this.ready = Boolean(this.registration && this.vapidPublicKey)
		// Best-effort: query current subscription so isNotificationEnabled()
		// returns a sensible value on the first synchronous read.
		await this.refreshSubscriptionState()
	}

	isNotificationEnabled() {
		if (typeof Notification === "undefined") return false
		if (Notification.permission !== "granted") return false
		return this._lastKnownSubscribed === true
	}

	async refreshSubscriptionState() {
		if (!this.registration) {
			this._lastKnownSubscribed = false
			return false
		}
		const sub = await this.registration.pushManager.getSubscription()
		this._lastKnownSubscribed = Boolean(sub)
		return this._lastKnownSubscribed
	}

	async enableNotification() {
		if (!this.ready) {
			throw new Error("Push notifications are not configured on this site")
		}
		if (typeof Notification === "undefined") {
			throw new Error("This browser does not support notifications")
		}
		if (Notification.permission === "denied") {
			throw new Error(
				"Notifications are blocked in browser settings. Open site settings and allow notifications, then try again."
			)
		}

		const permission =
			Notification.permission === "granted"
				? "granted"
				: await Notification.requestPermission()
		if (permission !== "granted") {
			return { permission_granted: false, subscribed: false }
		}

		let pushSub = await this.registration.pushManager.getSubscription()
		if (!pushSub) {
			pushSub = await this.registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(this.vapidPublicKey),
			})
		}

		await postJSON(API_SUBSCRIBE, {
			subscription: JSON.stringify(pushSub.toJSON()),
			user_agent: navigator.userAgent || "",
		})

		this._lastKnownSubscribed = true
		return { permission_granted: true, subscribed: true }
	}

	async disableNotification() {
		if (!this.registration) return { unsubscribed: false }
		const pushSub = await this.registration.pushManager.getSubscription()
		if (!pushSub) {
			this._lastKnownSubscribed = false
			return { unsubscribed: true }
		}
		const endpoint = pushSub.endpoint
		// Local unsubscribe first; backend cleanup second. Even if the
		// backend call fails, the user's browser stops receiving pushes
		// for this device.
		await pushSub.unsubscribe()
		try {
			await postJSON(API_UNSUBSCRIBE, { endpoint })
		} catch (e) {
			console.warn("Backend unsubscribe failed (browser already removed):", e)
		}
		this._lastKnownSubscribed = false
		return { unsubscribed: true }
	}

	async sendTestPush() {
		return await postJSON(API_SEND_TEST, {})
	}
}
