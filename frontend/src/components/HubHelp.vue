<!--
  Hub Help — self-serve assistant for the CH Hub PWA (mobile).
  Mirrors the desktop widget: a floating launcher that opens a chat panel calling
  ONLY connecthear_ai.help_assistant.ask (server-gated, tier-scoped, cost-capped).
  Self-gates on connecthear_ai.help_assistant.is_enabled_for_me (flag + pilot).
-->
<template>
	<div v-if="enabled">
		<button v-if="!open" class="hubhelp-fab" @click="openPanel" aria-label="Open Hub Help">
			<span aria-hidden="true">💬</span>
		</button>

		<div v-if="open" class="hubhelp-panel" role="dialog" aria-label="Hub Help">
			<div class="hubhelp-head">
				<div>
					<div class="ttl">Hub Help</div>
					<div class="sub">Ask how to do things on the Hub</div>
				</div>
				<button class="x" @click="open = false" aria-label="Close Hub Help">&times;</button>
			</div>

			<div ref="logEl" class="hubhelp-log">
				<div v-for="(m, i) in messages" :key="i" :class="['msg', m.role, m.soft ? 'soft' : '']">
					<div v-html="m.html"></div>
					<div v-if="m.sources && m.sources.length" class="src">📘 {{ m.sources.join(", ") }}</div>
					<div v-if="m.guide_url" class="readmore">
						<a :href="m.guide_url" target="_blank" rel="noopener">📖 Read the full guide →</a>
					</div>
					<div v-if="m.links && m.links.length" class="links">
						<a v-for="(l, j) in m.links" :key="j" :href="l.url" target="_blank" rel="noopener">{{ l.label }}</a>
					</div>
					<div v-if="m.role === 'bot' && m.status === 'ok'" class="fb">
						<span v-if="m.fb" class="done">Thanks — noted.</span>
						<template v-else>
							<span class="fbq">Helpful?</span>
							<button @click="feedback(m, 1)" aria-label="Helpful">👍</button>
							<button @click="feedback(m, 0)" aria-label="Not helpful">👎</button>
						</template>
					</div>
				</div>
				<div v-if="showPills" class="pills">
					<button v-for="(s, i) in suggestions" :key="i" class="pill" @click="sendPill(s)">{{ s }}</button>
				</div>
				<div v-if="loading" class="typing">Hub Help is looking…</div>
			</div>

			<div class="hubhelp-foot">
				<input
					v-model="q"
					type="text"
					enterkeyhint="send"
					placeholder="e.g. how do I apply for leave?"
					aria-label="Your question"
					@keyup.enter="send"
				/>
				<button :disabled="loading || !q.trim()" @click="send">Ask</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from "vue"
import { createResource } from "frappe-ui"

const enabled = ref(false)
const suggestions = ref([])
const open = ref(false)
const loading = ref(false)
const q = ref("")
const messages = ref([])
const logEl = ref(null)

const GREETING = "Hi! I can help you use the Hub — leave, expenses, attendance and more. What do you need?"

function esc(t) {
	return String(t == null ? "" : t)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

// Minimal, safe markdown: escape first, then **bold** and *bullet lists.
function toHtml(text) {
	let s = esc(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
	const lines = s.split("\n")
	let out = "", inList = false
	for (const ln of lines) {
		const m = ln.match(/^\s*[*\-]\s+(.*)/)
		if (m) {
			if (!inList) { out += "<ul style='margin:6px 0;padding-left:20px'>"; inList = true }
			out += "<li>" + m[1] + "</li>"
		} else {
			if (inList) { out += "</ul>"; inList = false }
			if (ln.trim()) out += ln + "<br>"
		}
	}
	if (inList) out += "</ul>"
	return out
}

async function scroll() {
	await nextTick()
	if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
}

const gate = createResource({ url: "connecthear_ai.help_assistant.is_enabled_for_me" })
const askRes = createResource({ url: "connecthear_ai.help_assistant.ask" })
const fbRes = createResource({ url: "connecthear_ai.help_assistant.submit_feedback" })

onMounted(async () => {
	try {
		const r = await gate.submit()
		enabled.value = !!(r && r.enabled)
		suggestions.value = (r && r.suggestions) || []
	} catch (e) {
		enabled.value = false
	}
})

const showPills = computed(() => suggestions.value.length && messages.value.every((m) => m.role !== "you"))

function sendPill(s) {
	q.value = s
	send()
}

function openPanel() {
	open.value = true
	if (!messages.value.length) {
		messages.value.push({ role: "bot", soft: true, html: toHtml(GREETING) })
	}
	scroll()
}

function pushBot(resp) {
	const soft = ["off", "deferred", "no_result", "error"].includes(resp.status)
	messages.value.push({
		role: "bot",
		soft,
		status: resp.status,
		html: toHtml(resp.answer),
		sources: resp.sources || [],
		guide_url: resp.guide_url || "",
		links: resp.links || [],
		question: resp.__q || "",
		fb: false,
	})
	scroll()
}

async function send() {
	const question = q.value.trim()
	if (!question || loading.value) return
	q.value = ""
	messages.value.push({ role: "you", html: toHtml(question) })
	loading.value = true
	scroll()
	try {
		const r = await askRes.submit({ question })
		r.__q = question
		pushBot(r || { status: "error", answer: "Sorry, something went wrong. Please ask the relevant person." })
	} catch (e) {
		pushBot({ status: "error", answer: "Sorry, I couldn't reach Hub Help just now. Please try again, or ask the relevant person." })
	} finally {
		loading.value = false
	}
}

function feedback(m, helpful) {
	m.fb = true
	try {
		fbRes.submit({ question: m.question, helpful, answer: m.html })
	} catch (e) {
		/* best-effort */
	}
}
</script>

<style scoped>
.hubhelp-fab {
	position: fixed;
	right: 16px;
	bottom: 84px;
	z-index: 999;
	width: 52px;
	height: 52px;
	border: none;
	border-radius: 50%;
	background: #2fbfc7;
	color: #fff;
	font-size: 22px;
	box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
.hubhelp-panel {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	top: 0;
	z-index: 1000;
	background: #fff;
	display: flex;
	flex-direction: column;
}
.hubhelp-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 16px;
	padding-top: max(14px, env(safe-area-inset-top));
	background: linear-gradient(90deg, #2fbfc7, #1aa5ad);
	color: #fff;
}
.hubhelp-head .ttl { font-weight: 700; font-size: 16px; }
.hubhelp-head .sub { font-size: 12px; opacity: 0.9; margin-top: 1px; }
.hubhelp-head .x { background: none; border: none; color: #fff; font-size: 26px; line-height: 1; padding: 0 4px; }
.hubhelp-log {
	flex: 1;
	overflow-y: auto;
	padding: 14px;
	display: flex;
	flex-direction: column;
	gap: 12px;
	background: #f6f8f8;
}
.msg {
	max-width: 88%;
	padding: 10px 13px;
	border-radius: 14px;
	font-size: 14px;
	line-height: 1.5;
	word-wrap: break-word;
}
.msg.you { align-self: flex-end; background: #2fbfc7; color: #fff; border-bottom-right-radius: 4px; }
.msg.bot { align-self: flex-start; background: #fff; border: 1px solid #e6ebea; border-bottom-left-radius: 4px; }
.msg.bot.soft { background: transparent; border: none; color: #6b7a78; font-style: italic; }
.src { margin-top: 7px; font-size: 11px; color: #7a8886; }
.readmore { margin-top: 6px; }
.readmore a { font-size: 12.5px; font-weight: 600; color: #0f7f86; text-decoration: none; }
.links { margin-top: 9px; display: flex; flex-wrap: wrap; gap: 7px; }
.links a { font-size: 12px; text-decoration: none; background: #ef8a2a; color: #fff; padding: 6px 11px; border-radius: 16px; }
.fb { margin-top: 8px; display: flex; gap: 8px; align-items: center; }
.fb .fbq { font-size: 12px; color: #8a9694; }
.fb .done { font-size: 12px; color: #2fbfc7; }
.fb button { border: 1px solid #dfe4e3; background: #fff; border-radius: 14px; font-size: 15px; padding: 2px 10px; }
.typing { align-self: flex-start; color: #7a8886; font-size: 13px; font-style: italic; }
.pills { display: flex; flex-wrap: wrap; gap: 8px; align-self: flex-start; max-width: 95%; }
.pill { border: 1px solid #cdeced; background: #e9f7f8; color: #0f7f86; border-radius: 16px;
	padding: 9px 13px; font-size: 13px; text-align: left; }
.hubhelp-foot {
	display: flex;
	gap: 8px;
	padding: 10px;
	padding-bottom: max(10px, env(safe-area-inset-bottom));
	border-top: 1px solid #e2e7e6;
	background: #fff;
}
.hubhelp-foot input {
	flex: 1;
	border: 1px solid #d8dedd;
	border-radius: 22px;
	padding: 11px 15px;
	font-size: 15px;
}
.hubhelp-foot button {
	border: none;
	background: #2fbfc7;
	color: #fff;
	border-radius: 22px;
	padding: 0 18px;
	font-weight: 600;
}
.hubhelp-foot button:disabled { opacity: 0.5; }
</style>
