<!--
  "Still working?" opt-out banner (mobile-correct surface for the auto-checkout snooze).
  A link inside a native push notification isn't tappable, so the opt-out lives here:
  when the user opens the app past their shift end and is still checked IN, this banner
  lets them tap "I'm still working" to stop today's auto-checkout. Self-gates on
  hr_automations.auto_checkout.should_show_still_working; renders nothing otherwise.
-->
<template>
	<div v-if="visible" class="sw-wrap">
		<div v-if="!done" class="sw-banner">
			<div class="sw-head">🕔 Still checked in past your shift?</div>
			<div class="sw-sub">
				Tap below and the Hub won't auto-check you out at your shift end. Just remember to
				tap <b>OUT</b> when you actually leave, so your real hours are recorded.
			</div>
			<div class="sw-actions">
				<button class="sw-primary" :disabled="busy" @click="stillWorking">
					{{ busy ? "…" : "I'm still working" }}
				</button>
				<button class="sw-dismiss" @click="visible = false">Dismiss</button>
			</div>
		</div>
		<div v-else class="sw-banner sw-done">
			✅ Got it, we won't auto-check you out today. Remember to tap <b>OUT</b> when you leave.
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { createResource } from "frappe-ui"

const visible = ref(false)
const done = ref(false)
const busy = ref(false)

const check = createResource({ url: "hr_automations.auto_checkout.should_show_still_working" })
const snooze = createResource({ url: "hr_automations.auto_checkout.im_still_working" })

onMounted(async () => {
	try {
		const r = await check.submit()
		visible.value = !!(r && r.show)
	} catch (e) {
		visible.value = false
	}
})

async function stillWorking() {
	busy.value = true
	try {
		await snooze.submit()
		done.value = true
		setTimeout(() => {
			visible.value = false
		}, 5000)
	} catch (e) {
		busy.value = false
	}
}
</script>

<style scoped>
.sw-wrap {
	position: fixed;
	left: 12px;
	right: 12px;
	bottom: 84px;
	z-index: 1000;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.sw-banner {
	background: #fff;
	border: 1px solid #e2e7e6;
	border-left: 4px solid #ef8a2a;
	border-radius: 12px;
	box-shadow: 0 8px 26px rgba(0, 0, 0, 0.2);
	padding: 13px 15px;
}
.sw-head {
	font-weight: 700;
	font-size: 14px;
	color: #1f272e;
}
.sw-sub {
	font-size: 12.5px;
	color: #5b6b6e;
	line-height: 1.45;
	margin-top: 3px;
}
.sw-actions {
	display: flex;
	gap: 8px;
	margin-top: 11px;
}
.sw-primary {
	flex: 1;
	background: #0f7f86;
	color: #fff;
	border: none;
	border-radius: 8px;
	padding: 10px;
	font-weight: 600;
	font-size: 13.5px;
}
.sw-primary:disabled {
	opacity: 0.6;
}
.sw-dismiss {
	background: none;
	border: 1px solid #d8dedd;
	color: #5b6b6e;
	border-radius: 8px;
	padding: 10px 16px;
	font-size: 13.5px;
}
.sw-done {
	border-left-color: #1c7c4a;
	font-size: 13px;
	color: #1f272e;
	line-height: 1.45;
}
</style>
