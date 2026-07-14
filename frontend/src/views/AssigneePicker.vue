<template>
	<ion-page>
		<ion-header :translucent="true">
			<ion-toolbar>
				<ion-buttons slot="start">
					<ion-back-button :default-href="backHref" />
				</ion-buttons>
				<ion-title>
					{{ isEdit ? __("Assignees") : __("Pick people") }}
					<span v-if="selected.length" class="picked-count">{{ selected.length }}</span>
				</ion-title>
				<ion-buttons slot="end">
					<ion-button strong :disabled="busy" @click="onDone">
						{{ doneLabel }}
					</ion-button>
				</ion-buttons>
			</ion-toolbar>
			<ion-toolbar>
				<ion-searchbar
					v-model="search"
					:placeholder="__('Search by name')"
					:debounce="120"
					show-cancel-button="never"
				/>
			</ion-toolbar>
		</ion-header>

		<ion-content :fullscreen="true">
			<div v-if="loading" class="loading">
				<ion-spinner />
			</div>
			<ion-list v-else lines="full">
				<ion-item
					v-for="u in filteredUsers"
					:key="u.name"
					button
					@click="toggle(u.name)"
				>
					<ion-checkbox
						slot="start"
						:checked="selected.includes(u.name)"
						aria-label="select"
						@click.stop="toggle(u.name)"
					/>
					<ion-label>
						<h2>{{ u.full_name || u.name }}</h2>
						<p>{{ u.name }}</p>
					</ion-label>
				</ion-item>
				<div v-if="filteredUsers.length === 0" class="empty">
					{{ __("No matches") }}
				</div>
			</ion-list>
		</ion-content>
	</ion-page>
</template>

<script setup>
/**
 * Unified assignee picker — runs in two modes determined by route shape:
 *
 *   /dashboard/tasks/new/assignees         → "new" mode (writes to draftTask)
 *   /dashboard/tasks/:taskName/assignees   → "edit" mode (reads + diffs the task's _assign)
 *
 * The shell + checkbox list are identical between modes; only the
 * load/save adapters differ. Replaces the earlier PickAssignees.vue +
 * EditAssignees.vue duplicates (130 + 210 lines for ~30 lines of real
 * difference).
 */
import { ref, computed, inject, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
	IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
	IonBackButton, IonContent, IonList, IonItem, IonCheckbox, IonLabel,
	IonSearchbar, IonSpinner, toastController,
} from "@ionic/vue"
import { createResource } from "frappe-ui"

import { draftTask } from "@/data/draftTask"
import { systemUsers, taskSections } from "@/data/tasks"
import { addAssignees, removeAssignee } from "@/data/taskDetail"
import { parseError } from "@/composables/useTaskHelpers"

const __ = inject("$translate")
const route = useRoute()
const router = useRouter()

const taskName = computed(() => route.params.taskName)
const isEdit = computed(() => !!taskName.value)
const backHref = computed(() =>
	isEdit.value ? "/dashboard/tasks/" + encodeURIComponent(taskName.value) : "/dashboard/tasks/new"
)
const doneLabel = computed(() =>
	busy.value
		? __("Saving...")
		: (isEdit.value ? __("Save") : __("Done"))
)

const search = ref("")
const selected = ref([])
const originalSelected = ref([])
const taskSubject = ref("")
const loading = ref(false)
const busy = ref(false)

// Load initial selection. New mode reads draftTask; edit mode fetches task.
onMounted(async () => {
	// Ensure user cache is warm (both modes)
	if (!systemUsers.data || systemUsers.data.length === 0) {
		try { await systemUsers.reload() } catch {}
	}
	if (isEdit.value) {
		loading.value = true
		try {
			const taskRes = createResource({
				url: "frappe.client.get_value",
				params: {
					doctype: "Task",
					filters: JSON.stringify({ name: taskName.value }),
					fieldname: JSON.stringify(["_assign", "subject"]),
				},
			})
			await taskRes.submit()
			const data = taskRes.data || {}
			taskSubject.value = data.subject || ""
			let current = []
			try {
				const parsed = JSON.parse(data._assign || "[]")
				if (Array.isArray(parsed)) current = parsed
			} catch {}
			selected.value = [...current]
			originalSelected.value = [...current]
		} catch (e) {
			console.error("Load assignees failed:", e)
		} finally {
			loading.value = false
		}
	} else {
		// New mode — pre-fill from the in-progress draft
		selected.value = [...draftTask.assignees]
		// Note: draftTask is the "live" source; on Done we write back.
	}
})

const users = computed(() => systemUsers.data || [])
const filteredUsers = computed(() => {
	const q = (search.value || "").trim().toLowerCase()
	if (!q) return users.value
	return users.value.filter((u) =>
		(u.full_name || "").toLowerCase().includes(q) ||
		(u.name || "").toLowerCase().includes(q)
	)
})

function toggle(userId) {
	const i = selected.value.indexOf(userId)
	if (i >= 0) selected.value.splice(i, 1)
	else selected.value.push(userId)
}

async function onDone() {
	if (isEdit.value) {
		await saveEditMode()
	} else {
		// new mode — commit to draft + go back
		draftTask.assignees = [...selected.value]
		router.back()
	}
}

async function saveEditMode() {
	const toAdd = selected.value.filter((u) => !originalSelected.value.includes(u))
	const toRemove = originalSelected.value.filter((u) => !selected.value.includes(u))
	if (toAdd.length === 0 && toRemove.length === 0) {
		router.back()
		return
	}
	busy.value = true
	try {
		if (toAdd.length > 0) {
			await addAssignees.submit({
				assign_to: toAdd,
				doctype: "Task",
				name: taskName.value,
				description: taskSubject.value || taskName.value,
			})
		}
		for (const u of toRemove) {
			await removeAssignee.submit({
				doctype: "Task",
				name: taskName.value,
				assign_to: u,
			})
		}
		taskSections.reload()
		const t = await toastController.create({
			message: __("Assignees updated"), duration: 1500, color: "success",
		})
		t.present()
		router.back()
	} catch (e) {
		const t = await toastController.create({
			message: parseError(e, __("Failed to update assignees")),
			duration: 3000, color: "danger",
		})
		t.present()
	} finally {
		busy.value = false
	}
}
</script>

<style scoped>
.picked-count {
	background: var(--ion-color-primary, #3880ff);
	color: #fff;
	border-radius: 10px;
	font-size: 12px;
	padding: 1px 8px;
	font-weight: 500;
	margin-left: 6px;
}
.loading {
	display: flex; justify-content: center; align-items: center;
	min-height: 40vh;
}
.empty {
	padding: 32px;
	text-align: center;
	color: var(--ion-color-step-500, #9ca3af);
	font-size: 14px;
}
</style>
