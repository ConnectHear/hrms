<template>
	<ion-page>
		<ion-header :translucent="true">
			<ion-toolbar>
				<ion-buttons slot="start">
					<ion-back-button default-href="/dashboard/tasks" :text="__('Cancel')" />
				</ion-buttons>
				<ion-title>{{ __("New Task") }}</ion-title>
				<ion-buttons slot="end">
					<ion-button
						strong
						:disabled="!draft.subject.trim() || submitting"
						@click="onSubmit"
					>
						{{ submitting ? __("Saving...") : __("Add") }}
					</ion-button>
				</ion-buttons>
			</ion-toolbar>
		</ion-header>

		<ion-content :fullscreen="true" class="ion-padding-horizontal">
			<div class="form">
				<div class="field">
					<label class="field-label">
						{{ __("What needs doing?") }} <span class="reqd">*</span>
					</label>
					<input
						v-model="draft.subject"
						type="text"
						class="input"
						:placeholder="__('Title — keep it short')"
						@keyup.enter="onSubmit"
					/>
				</div>

				<div class="field">
					<label class="field-label">{{ __("Assign to") }}</label>
					<div class="chip-input" @click="openPicker">
						<div v-if="!draft.assignees.length" class="placeholder">
							{{ __("Tap to pick people — empty assigns to yourself") }}
						</div>
						<span
							v-for="a in draft.assignees"
							:key="a"
							class="chip"
							@click.stop
						>
							{{ userDisplay(a) }}
							<span class="x" @click.stop="removeAssignee(a)">×</span>
						</span>
						<span
							v-if="draft.assignees.length"
							class="add-more"
							@click.stop="openPicker"
						>+</span>
					</div>
				</div>

				<div class="field-row">
					<div class="field">
						<label class="field-label">{{ __("Due date") }}</label>
						<input v-model="draft.dueDate" type="date" class="input" />
					</div>
					<div class="field">
						<label class="field-label">{{ __("Project") }}</label>
						<select v-model="draft.project" class="input">
							<option :value="null">{{ __('— None —') }}</option>
							<option
								v-for="p in projects"
								:key="p.name"
								:value="p.name"
							>
								{{ p.project_name || p.name }}
							</option>
						</select>
					</div>
				</div>

				<label class="check-row">
					<input v-model="draft.addAnother" type="checkbox" />
					<span>
						<div>{{ __("Add another after this") }}</div>
						<div class="hint">{{ __("Keep this screen open — title clears, the rest stays.") }}</div>
					</span>
				</label>
			</div>
		</ion-content>
	</ion-page>
</template>

<script setup>
import { ref, computed, inject } from "vue"
import { useRouter } from "vue-router"
import {
	IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
	IonBackButton, IonContent, toastController,
} from "@ionic/vue"

import { draftTask, resetDraft } from "@/data/draftTask"
import { createQuickTask, systemUsers, openProjects } from "@/data/tasks"

const __ = inject("$translate")
const router = useRouter()
const draft = draftTask

const submitting = ref(false)

const users = computed(() => systemUsers.data || [])
const projects = computed(() => openProjects.data || [])

function userDisplay(userId) {
	const u = users.value.find((x) => x.name === userId)
	return u ? (u.full_name || u.name) : userId
}

function removeAssignee(userId) {
	draft.assignees = draft.assignees.filter((u) => u !== userId)
}

function openPicker() {
	router.push("/dashboard/tasks/new/assignees")
}

async function onSubmit() {
	if (!draft.subject.trim()) return
	submitting.value = true
	try {
		const task = await createQuickTask({
			subject: draft.subject,
			assignees: draft.assignees,
			dueDate: draft.dueDate || null,
			project: draft.project,
		})
		const toast = await toastController.create({
			message: __("Task created: ") + draft.subject,
			duration: 2000,
			color: "success",
		})
		toast.present()

		if (draft.addAnother) {
			// Clear title only — keep assignees/due/project for the next task
			resetDraft({ keepRecipients: true })
		} else {
			resetDraft()
			router.replace("/dashboard/tasks")
		}
	} catch (e) {
		console.error("Create task failed:", e)
		const toast = await toastController.create({
			message: __("Failed to create task: ") + (e.message || e),
			duration: 3000,
			color: "danger",
		})
		toast.present()
	} finally {
		submitting.value = false
	}
}
</script>

<style scoped>
.form {
	display: flex;
	flex-direction: column;
	gap: 18px;
	padding: 20px 4px 80px;
}
.field { display: flex; flex-direction: column; }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1 1 0; }
.field-label {
	font-size: 12px;
	color: var(--ion-color-step-600, #6b7280);
	margin-bottom: 6px;
	font-weight: 500;
}
.reqd { color: var(--ion-color-danger, #eb445a); }

.input {
	width: 100%;
	padding: 12px 14px;
	font-size: 16px;
	border: 1px solid var(--ion-color-step-200, #d1d5db);
	border-radius: 10px;
	background: var(--ion-color-step-50, #fafafa);
	color: var(--ion-text-color, #1f2937);
	font-family: inherit;
	box-sizing: border-box;
}
.input:focus {
	outline: none;
	border-color: var(--ion-color-primary, #3880ff);
	background: #fff;
}

.chip-input {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	min-height: 46px;
	padding: 8px 12px;
	border: 1px solid var(--ion-color-step-200, #d1d5db);
	border-radius: 10px;
	background: var(--ion-color-step-50, #fafafa);
	cursor: pointer;
	align-items: center;
}
.chip-input .placeholder {
	color: var(--ion-color-step-500, #9ca3af);
	font-size: 14px;
}
.chip-input .chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 10px;
	border-radius: 14px;
	background: #fff7ed;
	color: #c2410c;
	font-size: 13px;
	font-weight: 500;
	border: 1px solid #fed7aa;
}
.chip-input .chip .x {
	font-size: 18px;
	line-height: 1;
	cursor: pointer;
	padding: 0 2px;
}
.chip-input .add-more {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px; height: 26px;
	border-radius: 13px;
	background: var(--ion-color-step-150, #e5e7eb);
	color: var(--ion-color-step-700, #374151);
	font-size: 18px;
	font-weight: 500;
	cursor: pointer;
}

.check-row {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	font-size: 14px;
	cursor: pointer;
	padding-top: 4px;
}
.check-row input {
	margin-top: 3px;
	width: 18px; height: 18px;
}
.hint {
	font-size: 12px;
	color: var(--ion-color-step-500, #9ca3af);
	margin-top: 2px;
}
</style>
