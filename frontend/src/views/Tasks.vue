<template>
	<ion-page>
		<ion-header :translucent="true">
			<ion-toolbar>
				<ion-title>{{ __("My Tasks") }}</ion-title>
				<ion-buttons slot="end">
					<ion-button @click="onNewTask">
						<ion-icon :icon="addOutline" />
					</ion-button>
					<ion-button @click="reload" :disabled="taskSections.loading">
						<ion-icon :icon="refreshOutline" />
					</ion-button>
				</ion-buttons>
			</ion-toolbar>
		</ion-header>

		<ion-content :fullscreen="true">
			<ion-refresher slot="fixed" @ionRefresh="onRefresh">
				<ion-refresher-content />
			</ion-refresher>

			<div v-if="taskSections.loading && !taskSections.data" class="loading-state">
				<ion-spinner />
			</div>

			<div v-else-if="empty" class="empty-state">
				<div class="empty-emoji">🎉</div>
				<div class="empty-title">{{ __("All clear!") }}</div>
				<div class="empty-sub">{{ __("No tasks right now.") }}</div>
				<ion-button @click="onNewTask" fill="solid" color="primary" size="default" style="margin-top: 16px;">
					{{ __("+ Create one") }}
				</ion-button>
			</div>

			<template v-else>
				<!-- Search bar + filter chip row -->
				<div class="search-bar">
					<ion-searchbar
						v-model="searchQuery"
						:placeholder="__('Search by title, project, dept...')"
						:debounce="100"
						show-cancel-button="never"
						class="task-searchbar"
					/>
				</div>
				<div class="filter-bar">
					<button
						class="filter-chip"
						:class="{ active: showCompleted }"
						@click="onToggleShowCompleted"
					>
						<ion-icon :icon="showCompleted ? checkmarkCircleOutline : ellipseOutline" />
						<span>{{ __("Completed") }}</span>
					</button>
				</div>

				<TaskSection
					v-if="filteredSections.overdue.length"
					title="Overdue"
					icon="⏰"
					:tasks="filteredSections.overdue"
					@toggle="onToggle"
					@open="onOpen"
				/>
				<TaskSection
					v-if="filteredSections.today.length"
					title="Today"
					icon="📅"
					:tasks="filteredSections.today"
					@toggle="onToggle"
					@open="onOpen"
				/>
				<TaskSection
					v-if="filteredSections.assigned.length"
					title="Assigned to me"
					icon="📝"
					:tasks="filteredSections.assigned"
					@toggle="onToggle"
					@open="onOpen"
				/>
				<TaskSection
					v-if="filteredSections.created.length"
					title="Created by me"
					icon="✨"
					:tasks="filteredSections.created"
					@toggle="onToggle"
					@open="onOpen"
				/>
				<div v-if="searchQuery && totalFiltered === 0" class="empty-search">
					{{ __("No tasks match") }} "{{ searchQuery }}"
				</div>
			</template>

			<!-- FAB → navigates to the New Task page (not a modal). -->
			<ion-fab vertical="bottom" horizontal="end" slot="fixed" style="margin-bottom: 16px;">
				<ion-fab-button @click="onNewTask" color="primary">
					<ion-icon :icon="addOutline" />
				</ion-fab-button>
			</ion-fab>
		</ion-content>
	</ion-page>
</template>

<script setup>
import { computed, inject, ref } from "vue"
import { useRouter } from "vue-router"
import {
	IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
	IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSpinner,
	IonFab, IonFabButton, IonSearchbar, toastController,
} from "@ionic/vue"
import { addOutline, refreshOutline, checkmarkCircleOutline, ellipseOutline } from "ionicons/icons"

const searchQuery = ref("")

function matchesQuery(task, q) {
	if (!q) return true
	const needle = q.toLowerCase()
	const fields = [
		task.subject,
		task.project,
		task.department,
		...(task.assignees || []).map(a => a.name + " " + a.id),
	]
	return fields.some(f => (f || "").toLowerCase().includes(needle))
}

import TaskSection from "@/components/TaskSection.vue"
import { taskSections, toggleTaskDone, includeCompletedTasks, setIncludeCompleted } from "@/data/tasks"
import { resetDraft } from "@/data/draftTask"

const __ = inject("$translate")
const router = useRouter()

const showCompleted = includeCompletedTasks  // shared module-level ref

function onToggleShowCompleted() {
	setIncludeCompleted(!showCompleted.value)
}

function onNewTask() {
	resetDraft()
	router.push("/dashboard/tasks/new")
}

const sections = computed(() => taskSections.data || {
	today: [], overdue: [], assigned: [], created: [],
	counts: { today: 0, overdue: 0, assigned: 0, created: 0 },
})

// Client-side filter — uses sections data, applies search query
const filteredSections = computed(() => {
	const s = sections.value
	const q = searchQuery.value.trim()
	if (!q) return s
	return {
		today: s.today.filter(t => matchesQuery(t, q)),
		overdue: s.overdue.filter(t => matchesQuery(t, q)),
		assigned: s.assigned.filter(t => matchesQuery(t, q)),
		created: s.created.filter(t => matchesQuery(t, q)),
	}
})

const totalFiltered = computed(() => {
	const fs = filteredSections.value
	return fs.today.length + fs.overdue.length + fs.assigned.length + fs.created.length
})

const empty = computed(() => {
	const s = sections.value
	return !s.today.length && !s.overdue.length && !s.assigned.length && !s.created.length
})

function reload() {
	taskSections.reload()
}

async function onRefresh(event) {
	await taskSections.reload()
	event.target.complete()
}

async function onToggle(task) {
	try {
		const newStatus = await toggleTaskDone(task.name, task.status)
		const toast = await toastController.create({
			message: newStatus === "Completed" ? __("Marked as done") : __("Reopened"),
			duration: 1500,
			position: "bottom",
			color: newStatus === "Completed" ? "success" : "medium",
		})
		toast.present()
	} catch (e) {
		console.error("Toggle failed:", e)
	}
}

function onOpen(task) {
	// Native mobile detail page (no Desk handoff)
	router.push("/dashboard/tasks/" + encodeURIComponent(task.name))
}

// onTaskCreated handler removed — task creation now happens in NewTask.vue
// page (router-driven), not a modal. NewTask.vue shows its own toast and
// navigates back here.
</script>

<style scoped>
.search-bar {
	padding: 4px 8px 0;
}
.task-searchbar {
	padding: 0;
	--background: var(--ion-color-step-50, #f7f8f9);
}
.empty-search {
	padding: 32px;
	text-align: center;
	color: var(--ion-color-step-500, #9ca3af);
	font-size: 14px;
}
.filter-bar {
	display: flex;
	gap: 8px;
	padding: 4px 16px 4px;
	overflow-x: auto;
	flex-wrap: nowrap;
}
.filter-chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 12px;
	border-radius: 14px;
	border: 1px solid var(--ion-color-step-200, #d1d5db);
	background: var(--ion-card-background, #fff);
	color: var(--ion-color-step-600, #6b7280);
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;
	white-space: nowrap;
	transition: all 0.12s ease;
}
.filter-chip ion-icon {
	font-size: 16px;
}
.filter-chip.active {
	background: var(--ion-color-primary, #3880ff);
	color: #fff;
	border-color: var(--ion-color-primary, #3880ff);
}
.filter-chip:active { transform: scale(0.97); }

.loading-state {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 50vh;
}
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 60vh;
	text-align: center;
	padding: 24px;
}
.empty-emoji {
	font-size: 64px;
	margin-bottom: 12px;
}
.empty-title {
	font-size: 20px;
	font-weight: 600;
	color: var(--ion-color-step-900);
	margin-bottom: 4px;
}
.empty-sub {
	font-size: 14px;
	color: var(--ion-color-step-600);
}
</style>
