<template>
	<ion-page>
		<ion-content class="ion-padding">
			<div class="flex flex-col h-screen w-screen">
				<div class="w-full sm:w-96">
					<header
						class="flex flex-row bg-white shadow-sm py-4 px-3 items-center justify-between border-b sticky top-0 z-10"
					>
						<div class="flex flex-row items-center">
							<Button
								variant="ghost"
								class="!pl-0 hover:bg-white"
								@click="router.back()"
							>
								<FeatherIcon name="chevron-left" class="h-5 w-5" />
							</Button>
							<h2 class="text-xl font-semibold text-gray-900">{{ __("Settings") }} </h2>
						</div>
					</header>

					<div class="flex flex-col gap-5 my-4 w-full p-4">
						<div class="flex flex-col bg-white rounded">
							<Switch
								size="md"
								:label="__('Enable Push Notifications')"
								:class="description ? 'p-2' : ''"
								:model-value="pushNotificationState"
								:disabled="disablePushSetting"
								:description="description"
								@update:model-value="togglePushNotifications"
							/>
						</div>
						<!-- Loading Indicator -->
						<div
							v-if="isLoading"
							class="flex -mt-2 items-center justify-center gap-2"
						>
							<LoadingIndicator class="w-3 h-3 text-gray-800" />
							<span class="text-gray-900 text-sm">
								{{ pushNotificationState ? __("Disabling Push Notifications...") : __("Enabling Push Notifications...") }}
							</span>
						</div>
						<!-- Test push button — visible only when notifications are on -->
						<div
							v-if="pushNotificationState && !isLoading"
							class="flex flex-col bg-white rounded p-2"
						>
							<Button
								variant="subtle"
								:loading="isSendingTest"
								@click="onSendTest"
							>
								{{ __("Send test push to this device") }}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</ion-content>
	</ion-page>
</template>

<script setup>
import { IonPage, IonContent } from "@ionic/vue"
import { useRouter } from "vue-router"
import { FeatherIcon, Switch, toast, LoadingIndicator } from "frappe-ui"

import { computed, inject, ref } from "vue"

const __ = inject("$translate")
const router = useRouter()
const pushNotificationState = ref(
	window.frappePushNotification?.isNotificationEnabled()
)
const isLoading = ref(false)
const isSendingTest = ref(false)

// Site is push-capable when the VAPID public key is exposed via boot
// (injected by hr_automations.web_push.boot.extend_bootinfo).
const isSiteEnabled = computed(() => Boolean(window.frappe?.boot?.vapid_public_key))

const disablePushSetting = computed(() => !isSiteEnabled.value || isLoading.value)

const description = computed(() => {
	if (!isSiteEnabled.value) {
		return __("Push notifications have not been configured on this site")
	}
	if (typeof Notification !== "undefined" && Notification.permission === "denied") {
		return __("Notifications are blocked in your browser settings. Enable them and reload.")
	}
	return ""
})

const onSendTest = async () => {
	isSendingTest.value = true
	try {
		const res = await window.frappePushNotification.sendTestPush()
		const sent = res?.sent ?? 0
		toast({
			title: sent > 0 ? __("Test push sent") : __("No active subscription"),
			text: sent > 0
				? __("Check your notification tray in a few seconds.")
				: __("Toggle Push off and on, then try again."),
			icon: sent > 0 ? "check-circle" : "alert-circle",
			position: "bottom-center",
			iconClasses: sent > 0 ? "text-green-500" : "text-red-500",
		})
	} catch (e) {
		toast({
			title: __("Error"),
			text: e.message || String(e),
			icon: "alert-circle",
			position: "bottom-center",
			iconClasses: "text-red-500",
		})
	} finally {
		isSendingTest.value = false
	}
}

const togglePushNotifications = (newValue) => {
	if (newValue) {
		enablePushNotifications()
	} else {
		isLoading.value = true
		window.frappePushNotification
			.disableNotification()
			.then((data) => {
				pushNotificationState.value = false // Disable the switch
				// TODO: add commonfied toast util for success and error messages
				toast({
					title: __("Success"),
					text: __("Push notifications disabled"),
					icon: "check-circle",
					position: "bottom-center",
					iconClasses: "text-green-500",
				})
			})
			.catch((error) => {
				toast({
					title: __("Error"),
					text: __(error.message),
					icon: "alert-circle",
					position: "bottom-center",
					iconClasses: "text-red-500",
				})
			})
			.finally(() => {
				isLoading.value = false
			})
	}
}

const enablePushNotifications = () => {
	isLoading.value = true

	window.frappePushNotification
		.enableNotification()
		.then((data) => {
			if (data.permission_granted) {
				pushNotificationState.value = true
			} else {
				toast({
					title: __("Error"),
					text: __("Push Notification permission denied"),
					icon: "alert-circle",
					position: "bottom-center",
					iconClasses: "text-red-500",
				})
				pushNotificationState.value = false
			}
		})
		.catch((error) => {
			toast({
				title: __("Error"),
				text: __(error.message),
				icon: "alert-circle",
				position: "bottom-center",
				iconClasses: "text-red-500",
			})
			pushNotificationState.value = false
		})
		.finally(() => {
			isLoading.value = false
		})
}
</script>
