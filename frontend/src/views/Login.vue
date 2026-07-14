<template>
	<ion-page>
		<ion-content class="ion-padding">
			<div
				class="flex h-screen w-screen flex-col justify-center"
				style="background: linear-gradient(180deg, rgba(71,193,200,0.10) 0%, #ffffff 35%);"
			>
				<div class="flex flex-col mx-auto gap-3 items-center">
					<FrappeHRLogo class="h-12 w-12" />
					<div class="text-3xl font-semibold text-gray-900 text-center">
						{{ __("Login to ConnectHear Hub") }}
					</div>
				</div>

				<div class="mx-auto mt-10 w-full px-8 sm:w-96">
					<form class="flex flex-col space-y-4" @submit.prevent="submit">
						<Input
							:label="__('Email')"
							:placeholder="__('johndoe@mail.com')"
							v-model="email"
							type="text"
							autocomplete="username"
						/>
						<!-- CUSTOM: password input with show/hide toggle. The eye
						     button sits inside the Input's bounding box at the right
						     edge and swaps between Feather "eye" and "eye-off" icons. -->
						<div class="relative">
							<Input
								:label="__('Password')"
								:type="showPassword ? 'text' : 'password'"
								placeholder="••••••"
								v-model="password"
								autocomplete="current-password"
							/>
							<button
								type="button"
								class="absolute right-2 top-[28px] flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 focus:outline-none"
								@click="showPassword = !showPassword"
								:aria-label="showPassword ? __('Hide password') : __('Show password')"
								tabindex="-1"
							>
								<svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
								<svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
									<line x1="1" y1="1" x2="23" y2="23" />
								</svg>
							</button>
						</div>
						<!-- END CUSTOM -->
						<ErrorMessage :message="errorMessage" />
						<Button
							:loading="session.login.loading"
							variant="solid"
							class="disabled:bg-gray-700 disabled:text-white !mt-6"
						>
							{{ __("Login") }}
						</Button>
					</form>

					<template v-if="authProviders.data?.length">
						<div class="text-center text-sm text-gray-600 my-4">or</div>
						<div class="space-y-4">
							<a
								v-for="provider in authProviders.data"
								:key="provider.name"
								class="flex items-center justify-center gap-2 transition-colors focus:outline-none text-gray-800 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring focus-visible:ring-gray-400 h-7 text-base p-2 rounded"
								:href="provider.auth_url"
							>
								<img class="h-4 w-4" :src="provider.icon" :alt="provider.provider_name" />
								<span>Login with {{ provider.provider_name }}</span>
							</a>
						</div>
					</template>
				</div>
			</div>

			<Dialog v-model="resetPassword.showDialog">
				<template #body-title>
					<h2 class="text-lg font-bold">{{ __("Reset Password") }} </h2>
				</template>
				<template #body-content>
					<p>
						{{ __("Your password has expired. Please reset your password to continue") }}
					</p>
				</template>
				<template #actions>
					<a
						class="inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-white bg-gray-900 hover:bg-gray-800 active:bg-gray-700 focus-visible:ring focus-visible:ring-gray-400 h-7 text-base px-2 rounded"
						:href="resetPassword.link"
						target="_blank"
					>
						{{ __("Go to Reset Password page") }}
					</a>
				</template>
			</Dialog>

			<Dialog v-model="otp.showDialog">
				<template #body-title>
					<h2 class="text-lg font-bold">{{ __("OTP Verification") }}</h2>
				</template>
				<template #body-content>
					<p class="mb-4" v-if="otp.verification.prompt">
						{{ otp.verification.prompt }}
					</p>

					<form class="flex flex-col space-y-4" @submit.prevent="submit">
						<Input
							:label="__('OTP Code')"
							type="text"
							placeholder="000000"
							v-model="otp.code"
							autocomplete="one-time-code"
						/>
						<ErrorMessage :message="errorMessage" />
						<Button
							:loading="session.otp.loading"
							variant="solid"
							class="disabled:bg-gray-700 disabled:text-white !mt-6"
						>
							{{ __("Verify") }}
						</Button>
					</form>
				</template>
			</Dialog>
		</ion-content>
	</ion-page>
</template>

<script setup>
import { IonPage, IonContent } from "@ionic/vue"
import { inject, reactive, ref } from "vue"
import { Input, Button, ErrorMessage, Dialog, createResource } from "frappe-ui"

import FrappeHRLogo from "@/components/icons/FrappeHRLogo.vue"

const email = ref(null)
const password = ref(null)
const showPassword = ref(false)
const errorMessage = ref("")

const resetPassword = reactive({
	showDialog: false,
	link: "",
})
const otp = reactive({
	showDialog: false,
	tmp_id: "",
	code: "",
	verification: {},
})

const session = inject("$session")
const __ = inject("$translate")

async function submit(e) {
	try {
		let response
		if (otp.showDialog) {
			response = await session.otp(otp.tmp_id, otp.code)
		} else {
			response = await session.login(email.value, password.value)
		}

		if (response.message === "Password Reset") {
			resetPassword.showDialog = true
			resetPassword.link = response.redirect_to
		} else {
			resetPassword.showDialog = false
			resetPassword.link = ""
		}

		// OTP verification
		if (response.verification) {
			if (response.verification.setup) {
				otp.showDialog = true
				otp.tmp_id = response.tmp_id
				otp.verification = response.verification
			} else {
				// Don't bother handling impossible OTP setup (e.g. no phone number).
				window.open("/login?redirect-to=" + encodeURIComponent(window.location.pathname), "_blank")
			}
		}
	} catch (error) {
		errorMessage.value = error.messages.join("\n")
	}
}

const authProviders = createResource({
	url: "hrms.api.oauth.oauth_providers",
	auto: true,
})
</script>
