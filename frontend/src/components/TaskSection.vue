<template>
	<div class="task-section">
		<div class="section-header">
			<span class="section-icon">{{ icon }}</span>
			<span class="section-title">{{ __(title) }}</span>
			<span class="section-count">{{ tasks.length }}</span>
		</div>
		<ion-list class="task-list">
			<!-- Each row is wrapped in ion-item-sliding so the user can swipe
			     left to reveal a "Done" / "Reopen" action. The checkbox tap
			     target still works for non-swipe users. -->
			<ion-item-sliding
				v-for="task in tasks"
				:key="task.name"
			>
				<ion-item
					class="task-row-wrapper"
					:data-status="task.status"
					lines="none"
				>
					<div class="task-row">
						<button
							type="button"
							class="status-check"
							:class="'status-' + statusClass(task.status)"
							:aria-checked="task.status === 'Completed'"
							role="checkbox"
							@click.stop="$emit('toggle', task)"
						/>
						<div class="task-body" @click="$emit('open', task)">
							<div class="task-title">{{ task.subject }}</div>
							<div class="task-meta">
								<span v-if="task.exp_end_date" class="meta-chip due">
									📅 {{ formatDate(task.exp_end_date) }}
								</span>
								<span v-if="task.status === 'Working'" class="meta-chip status s-working">{{ __("In progress") }}</span>
								<span v-if="task.status === 'Pending Review'" class="meta-chip status s-review">{{ __("Pending review") }}</span>
								<span v-if="cleanDept(task.department)" class="meta-chip dept">{{ cleanDept(task.department) }}</span>
								<span v-if="task.project" class="meta-chip project">{{ task.project }}</span>
								<span v-if="task.priority && task.priority !== 'Medium'" class="meta-chip pri" :class="'pri-' + task.priority.toLowerCase()">
									{{ task.priority }}
								</span>
								<span v-for="a in task.assignees" :key="a.id" class="assignee-chip" :style="userChipStyle(a.id)">{{ a.name }}</span>
							</div>
						</div>
					</div>
				</ion-item>
				<ion-item-options side="end">
					<ion-item-option
						:color="task.status === 'Completed' ? 'medium' : 'success'"
						@click="onSwipeToggle(task, $event)"
					>
						<ion-icon
							slot="icon-only"
							:icon="task.status === 'Completed' ? refreshOutline : checkmarkOutline"
						/>
					</ion-item-option>
				</ion-item-options>
			</ion-item-sliding>
		</ion-list>
	</div>
</template>

<script setup>
import { inject } from "vue"
import dayjs from "@/utils/dayjs"
import {
	IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption, IonIcon,
} from "@ionic/vue"
import { checkmarkOutline, refreshOutline } from "ionicons/icons"
import { cleanDept, userChipStyle } from "@/composables/useTaskHelpers"

function onSwipeToggle(task, event) {
	// Close the sliding item before firing the toggle event so the
	// row visually snaps back. Without this Ionic leaves the option
	// drawer open under the swiped row.
	const sliding = event?.target?.closest?.("ion-item-sliding")
	if (sliding?.close) sliding.close()
	emit("toggle", task)
}

const emit = defineEmits(["toggle", "open"])

defineProps({
	title: { type: String, required: true },
	icon: { type: String, default: "" },
	tasks: { type: Array, default: () => [] },
})

const __ = inject("$translate")

// Locally we want short "D MMM" (no year) on the task row chips,
// so we don't reuse useTaskHelpers.formatDate (which is "D MMM YYYY").
function formatDate(d) {
	if (!d) return ""
	return dayjs(d).format("D MMM")
}

function statusClass(s) {
	return (s || "").toLowerCase().replace(" ", "-")
}
</script>

<style scoped>
.task-section {
	padding: 8px 16px;
	margin-bottom: 16px;
}
.section-header {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--ion-color-step-600);
	font-weight: 600;
	margin-bottom: 8px;
	padding: 0 4px;
}
.section-icon {
	font-size: 16px;
}
.section-count {
	background: var(--ion-color-step-150);
	border-radius: 10px;
	padding: 1px 8px;
	font-size: 11px;
	font-weight: 500;
}

.task-list {
	background: var(--ion-card-background);
	border-radius: 12px;
	overflow: hidden;
	box-shadow: 0 1px 3px rgba(0,0,0,0.04);
	padding: 0;
}

/* The ion-item wrapper needs its own padding stripped so our .task-row
 * inside gets full control of layout. */
ion-item.task-row-wrapper {
	--padding-start: 0;
	--padding-end: 0;
	--inner-padding-start: 0;
	--inner-padding-end: 0;
	--min-height: auto;
	--background: transparent;
	border-bottom: 1px solid var(--ion-color-step-100, #e5e7eb);
}
ion-item.task-row-wrapper:last-child {
	border-bottom: none;
}

.task-row {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	padding: 14px 14px;
	width: 100%;
	transition: background 0.1s ease;
}
/* Active state only on the body to give visual feedback that the right
 * target is being tapped — NOT the whole row. */
.task-body:active {
	background: var(--ion-color-step-100);
}

.status-check {
	flex: 0 0 22px;
	width: 22px; height: 22px;
	margin-top: 1px;
	border: 1.5px solid var(--ion-color-step-500);
	border-radius: 5px;
	cursor: pointer;
	position: relative;
	transition: all 0.12s ease;
	background: transparent;
	padding: 0;
	font: inherit;
}
.status-check:focus { outline: 2px solid var(--ion-color-primary, #3880ff); outline-offset: 2px; }
.status-check::before {
	content: "";
	position: absolute;
	top: 50%; left: 50%;
	width: 6px; height: 11px;
	border: solid #fff;
	border-width: 0 2.5px 2.5px 0;
	transform: translate(-50%, -60%) rotate(45deg);
	opacity: 0;
	transition: opacity 0.12s ease;
}
.status-check.status-completed {
	border-color: #16a34a;
	background: #16a34a;
}
.status-check.status-completed::before { opacity: 1; }
.status-check.status-cancelled {
	border-color: #94a3b8;
	background: #94a3b8;
}

.task-body { flex: 1 1 auto; min-width: 0; }
.task-title {
	font-size: 15px;
	color: var(--ion-color-step-900);
	line-height: 1.35;
	margin-bottom: 6px;
	word-break: break-word;
}
.task-row[data-status="Completed"] .task-title {
	text-decoration: line-through;
	color: var(--ion-color-step-600);
}

.task-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	font-size: 11px;
}
.meta-chip {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 10px;
	background: var(--ion-color-step-150);
	color: var(--ion-color-step-700);
	white-space: nowrap;
	border: 1px solid transparent;
}
.meta-chip.due { background: #fef3c7; color: #92400e; }
.meta-chip.project { background: #dbeafe; color: #1e40af; }
.meta-chip.dept { background: #f3e8ff; color: #6b21a8; }
.meta-chip.pri-high, .meta-chip.pri-urgent { background: #fee2e2; color: #b91c1c; font-weight: 600; }
.meta-chip.pri-low { background: #e0e7ff; color: #3730a3; }
.meta-chip.status.s-working { background: #fef3c7; color: #92400e; font-weight: 500; }
.meta-chip.status.s-review { background: #dbeafe; color: #1e40af; font-weight: 500; }

.assignee-chip {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 10px;
	background: #fff7ed;
	color: #c2410c;
	font-weight: 500;
	border: 1px solid #fed7aa;
	font-size: 11px;
	white-space: nowrap;
}
</style>
