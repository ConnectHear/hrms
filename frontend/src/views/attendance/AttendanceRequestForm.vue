<template>
	<ion-page>
		<ion-content :fullscreen="true">
			<!-- CUSTOM: Hub Help moment-of-need pointer (create only) -->
			<div
				v-if="!props.id"
				class="rounded p-3 m-4 mb-0 cursor-pointer"
				style="background: #e9f7f8; border: 1px solid #cdeced"
				@click="askHubHelp('How do I fix a wrong or missed attendance day?')"
			>
				<p class="text-sm" style="color: #0f7f86">
					💬 Fixing a wrong or missed attendance day?
					<span class="font-semibold underline">Ask Hub Help →</span>
				</p>
			</div>
			<!-- END CUSTOM -->

			<FormView
				v-if="formFields.data"
				doctype="Attendance Request"
				v-model="attendanceRequest"
				:isSubmittable="true"
				:fields="formFields.data"
				:id="props.id"
				@validateForm="validateForm"
			/>
		</ion-content>
	</ion-page>
</template>

<script setup>
import { IonPage, IonContent } from "@ionic/vue"
import { createResource, call, toast } from "frappe-ui"
import { ref, watch, inject } from "vue"

import FormView from "@/components/FormView.vue"
import { askHubHelp } from "@/composables/useHubHelp"

const employee = inject("$employee")
const __ = inject("$translate")

const props = defineProps({
	id: {
		type: String,
		required: false,
	},
})

// Reactive form data. For new requests, default from_date and to_date to
// today — most Attendance Requests are for the current day (employee
// forgot to check in/out), so pre-filling saves two taps. Combined with
// the prefill watcher below, the user lands on a form that's already
// got today's date + their actual check-in time, only needing to pick
// reason + submit.
const today = (() => {
	const d = new Date()
	const yyyy = d.getFullYear()
	const mm = String(d.getMonth() + 1).padStart(2, "0")
	const dd = String(d.getDate()).padStart(2, "0")
	return `${yyyy}-${mm}-${dd}`
})()
const attendanceRequest = ref(
	props.id ? {} : { from_date: today, to_date: today },
)

// get form fields
const formFields = createResource({
	url: "hrms.api.get_doctype_fields",
	params: { doctype: "Attendance Request" },
	auto: true,
	transform(data) {
		if (props.id) return data
		return data.filter(
			(field) => !["employee", "employee_name", "status", "company"].includes(field.fieldname)
		)
	},
})

// form scripts
watch(
	() => attendanceRequest.value.employee,
	(employee_id) => {
		if (props.id && employee_id !== employee.data.name) {
			// if employee is not the current user, set form as read only
			setFormReadOnly()
		}
	}
)

watch(
	() => attendanceRequest.value.from_date,
	(from_date) => {
		if (!attendanceRequest.value.to_date) {
			attendanceRequest.value.to_date = from_date
		}
	}
)

watch(
	() => [attendanceRequest.value.from_date, attendanceRequest.value.to_date],
	([from_date, to_date]) => {
		validateDates(from_date, to_date)
	}
)

// Half-day flow simplification: when half_day is on, all 15 historical
// records on the bench have been single-day, so we hide both `to_date` and
// `half_day_date` and auto-sync them to `from_date`. User just toggles the
// checkbox and picks one date.
watch(
	() => attendanceRequest.value.half_day,
	(half_day) => {
		const to_date = formFields.data.find((field) => field.fieldname === "to_date")
		const half_day_date = formFields.data.find((field) => field.fieldname === "half_day_date")
		if (to_date) to_date.hidden = !!half_day
		if (half_day_date) half_day_date.hidden = true   // always hidden — we auto-set
		if (half_day && attendanceRequest.value.from_date) {
			attendanceRequest.value.to_date = attendanceRequest.value.from_date
			attendanceRequest.value.half_day_date = attendanceRequest.value.from_date
		}
	},
	{ immediate: true },
)

// Keep to_date + half_day_date synced to from_date while half_day is on.
watch(
	() => attendanceRequest.value.from_date,
	(from_date) => {
		if (attendanceRequest.value.half_day && from_date) {
			attendanceRequest.value.to_date = from_date
			attendanceRequest.value.half_day_date = from_date
		}
	},
)

// Pre-fill Check-in / Check-out times from the user's existing Employee
// Checkins for the selected date. Single-day only. Doesn't override values
// the user has already typed. Special-cases the "checked in but forgot to
// check out" scenario by suggesting the user's shift end time as check-out.
let prefillLock = false
async function tryPrefill() {
	if (prefillLock) return
	const { from_date, to_date, custom_checkin_time, custom_checkout_time } =
		attendanceRequest.value
	if (!from_date || from_date !== to_date) return
	if (custom_checkin_time && custom_checkout_time) return
	const empId = employee?.data?.name
	if (!empId) return
	prefillLock = true
	try {
		const r = await call(
			"hr_automations.attendance_helpers.get_first_last_checkin",
			{ employee: empId, date: from_date },
		)
		if (!r?.first && !r?.last) return

		let toastMsg = null

		if (r.first && !attendanceRequest.value.custom_checkin_time) {
			attendanceRequest.value.custom_checkin_time = r.first
		}

		if (r.only_checkin) {
			if (r.suggested_checkout && !attendanceRequest.value.custom_checkout_time) {
				attendanceRequest.value.custom_checkout_time = r.suggested_checkout
				toastMsg = __(
					"Looks like you forgot to check out — pre-filled your shift end time. Adjust if needed.",
				)
			} else {
				toastMsg = __("Check-in pre-filled. Please enter your check-out time.")
			}
		} else if (
			r.last &&
			r.last !== r.first &&
			!attendanceRequest.value.custom_checkout_time
		) {
			attendanceRequest.value.custom_checkout_time = r.last
			toastMsg = __("Pre-filled from your check-ins")
		}

		if (toastMsg) toast({ message: toastMsg, icon: "info" })
	} catch (e) {
		// Non-fatal; user can still type manually.
		console.warn("Attendance Request pre-fill failed:", e)
	} finally {
		prefillLock = false
	}
}

watch(
	() => [attendanceRequest.value.from_date, attendanceRequest.value.to_date],
	() => tryPrefill(),
)

// Explanation is required when Reason = "On Duty" (manager needs context —
// where were you / what were you doing). Optional for "Work From Home"
// (usually self-evident). Mirrors the Desk-side mandatory_depends_on.
watch(
	() => attendanceRequest.value.reason,
	(reason) => {
		const explanation = formFields.data.find(
			(field) => field.fieldname === "explanation",
		)
		if (!explanation) return
		explanation.reqd = reason === "On Duty" ? 1 : 0
	},
	{ immediate: true },
)

// Check-in / Check-out time fields only make sense for single-day requests.
// For a date range, a single Datetime can't represent multiple days — the
// per-day Attendance records inherit their times from the employee's shift
// instead. Hide + un-require these fields whenever from_date != to_date.
watch(
	() => [attendanceRequest.value.from_date, attendanceRequest.value.to_date],
	([from_date, to_date]) => {
		const checkin = formFields.data.find((field) => field.fieldname === "custom_checkin_time")
		const checkout = formFields.data.find((field) => field.fieldname === "custom_checkout_time")
		if (!checkin || !checkout) return
		const isSingleDay = from_date && to_date && from_date === to_date
		checkin.hidden = !isSingleDay
		checkout.hidden = !isSingleDay
		checkin.reqd = isSingleDay ? 1 : 0
		checkout.reqd = isSingleDay ? 1 : 0
		// Clear any stale times when switching to multi-day — they'd be
		// meaningless and could carry over to the saved doc.
		if (!isSingleDay) {
			attendanceRequest.value.custom_checkin_time = null
			attendanceRequest.value.custom_checkout_time = null
		}
	},
	{ immediate: true },
)

// helper functions
function setFormReadOnly() {
	formFields.data.map((field) => (field.read_only = true))
}

function validateDates(from_date, to_date) {
	if (!(from_date && to_date)) return

	const error_message = from_date > to_date ? __("To Date cannot be before From Date") : ""

	const from_date_field = formFields.data.find((field) => field.fieldname === "from_date")
	from_date_field.error_message = error_message
}

function validateForm() {
	attendanceRequest.value.employee = employee.data.name
}
</script>
