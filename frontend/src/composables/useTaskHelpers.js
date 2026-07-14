/**
 * Shared utilities for the Task / Project surfaces.
 *
 * Pulled out of TaskDetail.vue / NewTask.vue / Tasks.vue / TaskSection.vue
 * where these helpers were duplicated. Importing rather than re-defining
 * keeps PRs from drifting (e.g. one component formats dates differently
 * from another) and trims the bundle.
 */

import dayjs from "@/utils/dayjs"
import { systemUsers } from "@/data/tasks"

/** Display a User's full name from the cached systemUsers list. Falls back to the ID. */
export function userName(userId) {
	if (!userId) return ""
	const u = (systemUsers.data || []).find((x) => x.name === userId)
	return u?.full_name || userId
}

/** "D MMM YYYY" e.g. "5 Jun 2026" */
export function formatDate(d) {
	if (!d) return ""
	return dayjs(d).format("D MMM YYYY")
}

/** Strip the trailing " - CHPL" legal-entity suffix from a department name. */
export function cleanDept(d) {
	if (!d) return ""
	return d.replace(/ - CHPL$/, "")
}

/** Relative time ("3 hours ago"). */
export function relativeTime(t) {
	if (!t) return ""
	return dayjs(t).fromNow()
}

/** Parse Frappe-shaped errors and return a clean user-facing message. */
export function parseError(e, fallback) {
	let msg = fallback
	if (e?._server_messages) {
		try {
			const sm = JSON.parse(e._server_messages)
			const first = JSON.parse(sm[0] || "{}")
			msg = first.message || msg
		} catch {}
	} else if (e?.exception) {
		msg = e.exception
	} else if (e?.message) {
		msg = e.message
	}
	return String(msg).replace(/<[^>]+>/g, "").trim()
}

/** Convert stored Frappe HTML description to plain text for editing. */
export function htmlToText(html) {
	if (!html) return ""
	const div = document.createElement("div")
	div.innerHTML = html
	return (div.textContent || "").trim()
}

/** Wrap user-typed plain text as Frappe-storable HTML (preserves line breaks). */
export function textToHtml(text) {
	if (!text) return ""
	const escaped = String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
	return "<p>" + escaped.replace(/\n/g, "<br>") + "</p>"
}

/**
 * Convert plain-text @user@email patterns to Frappe's mention HTML spans
 * so add_comment fires the standard notification chain for each mention.
 */
export function mentionsToHtml(text) {
	if (!text) return ""
	const escape = (s) => String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
	return escape(text).replace(/@([\w.+-]+@[\w.-]+)/g, (match, userId) => {
		const u = (systemUsers.data || []).find((x) => x.name === userId)
		const fullName = u?.full_name || userId
		return `<span class="mention" data-denotation-char="@" data-id="${escape(userId)}" data-value="${escape(fullName)}">@${escape(fullName)}</span>`
	})
}

/**
 * Per-user chip color. Deterministic hash of the user-id into a fixed
 * 12-color palette so the same person is always the same color across
 * the app. Helps the team recognize names visually over time.
 */
const USER_COLOR_PALETTE = [
	{ bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe" }, // indigo
	{ bg: "#fce7f3", text: "#be185d", border: "#fbcfe8" }, // rose
	{ bg: "#d1fae5", text: "#047857", border: "#a7f3d0" }, // emerald
	{ bg: "#fef3c7", text: "#92400e", border: "#fde68a" }, // amber
	{ bg: "#e0f2fe", text: "#075985", border: "#bae6fd" }, // sky
	{ bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" }, // violet
	{ bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" }, // teal
	{ bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" }, // orange
	{ bg: "#ecfccb", text: "#4d7c0f", border: "#d9f99d" }, // lime
	{ bg: "#fae8ff", text: "#86198f", border: "#f5d0fe" }, // fuchsia
	{ bg: "#cffafe", text: "#155e75", border: "#a5f3fc" }, // cyan
	{ bg: "#f1f5f9", text: "#334155", border: "#cbd5e1" }, // slate
]

export function userColor(userId) {
	if (!userId) return USER_COLOR_PALETTE[0]
	let h = 0
	for (let i = 0; i < userId.length; i++) {
		h = (h * 31 + userId.charCodeAt(i)) | 0
	}
	return USER_COLOR_PALETTE[Math.abs(h) % USER_COLOR_PALETTE.length]
}

export function userChipStyle(userId) {
	const c = userColor(userId)
	return {
		background: c.bg,
		color: c.text,
		borderColor: c.border,
	}
}

/** Format a byte count as "12.4 KB" / "3 MB". */
export function humanFileSize(bytes) {
	if (!bytes) return ""
	const units = ["B", "KB", "MB", "GB"]
	let i = 0, b = bytes
	while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
	return b.toFixed(b < 10 && i > 0 ? 1 : 0) + " " + units[i]
}
