<template>
	<ion-page>
		<ion-header :translucent="true">
			<ion-toolbar>
				<ion-buttons slot="start">
					<ion-back-button default-href="/dashboard/tasks" />
				</ion-buttons>
				<ion-title>{{ __("Task") }}</ion-title>
				<ion-buttons slot="end">
					<ion-button @click="onDelete" :disabled="!task || saving">
						<ion-icon :icon="trashOutline" color="danger" />
					</ion-button>
					<ion-button @click="reload" :disabled="loading">
						<ion-icon :icon="refreshOutline" />
					</ion-button>
				</ion-buttons>
			</ion-toolbar>
		</ion-header>

		<ion-content :fullscreen="true">
			<div v-if="loading && !task" class="loading">
				<ion-spinner />
			</div>

			<template v-else-if="task">
				<!-- Title (editable) -->
				<div class="title-block">
					<div class="task-id">{{ task.name }}</div>
					<textarea
						class="title-input"
						v-model="local.subject"
						:placeholder="__('Title')"
						rows="1"
						@blur="saveField('subject', local.subject)"
						@input="autoResize"
						ref="titleInputRef"
					/>
				</div>

				<!-- Status pills -->
				<div class="section">
					<div class="section-label">{{ __("Status") }}</div>
					<div class="status-pills">
						<button
							v-for="s in STATUSES"
							:key="s.value"
							:class="['status-pill', 's-' + s.cls, { active: task.status === s.value }]"
							:disabled="saving"
							@click="changeStatus(s.value)"
						>
							{{ s.label }}
						</button>
					</div>
				</div>

				<!-- Metadata (editable) -->
				<div class="section meta-section">
					<div class="meta-edit-row">
						<label class="meta-key">📅 {{ __("Due") }}</label>
						<input
							type="date"
							class="meta-input"
							v-model="local.exp_end_date"
							@change="saveField('exp_end_date', local.exp_end_date || null)"
						/>
					</div>

					<div class="meta-edit-row">
						<label class="meta-key">🚩 {{ __("Priority") }}</label>
						<select
							class="meta-input"
							v-model="local.priority"
							@change="saveField('priority', local.priority)"
						>
							<option value="Low">{{ __("Low") }}</option>
							<option value="Medium">{{ __("Medium") }}</option>
							<option value="High">{{ __("High") }}</option>
							<option value="Urgent">{{ __("Urgent") }}</option>
						</select>
					</div>

					<div class="meta-edit-row">
						<label class="meta-key">📁 {{ __("Project") }}</label>
						<select
							class="meta-input"
							v-model="local.project"
							@change="saveField('project', local.project || null)"
						>
							<option :value="null">{{ __('— None —') }}</option>
							<option
								v-for="p in projects"
								:key="p.name"
								:value="p.name"
							>{{ p.project_name || p.name }}</option>
						</select>
					</div>

					<div class="meta-row">
						<span class="meta-key">🏢 {{ __("Department") }}</span>
						<span class="meta-val">{{ cleanDept(task.department) || "—" }}</span>
					</div>

					<div class="meta-row">
						<span class="meta-key">✍️ {{ __("Created by") }}</span>
						<span class="meta-val">{{ userName(task.owner) }}</span>
					</div>
				</div>

				<!-- Assignees -->
				<div class="section">
					<div class="section-label">
						{{ __("Assignees") }}
						<button class="link-btn" @click="manageAssignees">{{ __("Manage") }}</button>
					</div>
					<div class="assignee-chips">
						<span
							v-for="a in assigneeList"
							:key="a"
							class="assignee-chip"
							:style="userChipStyle(a)"
						>{{ userName(a) }}</span>
						<span v-if="assigneeList.length === 0" class="empty-mini">{{ __("No one assigned") }}</span>
					</div>
				</div>

				<!-- Subtasks -->
				<div class="section subtasks-section">
					<div class="section-label">
						{{ __("Subtasks") }}
						<span v-if="subtasks.length" class="subtask-count">
							{{ subtasks.filter(s => s.status === 'Completed').length }}/{{ subtasks.length }}
						</span>
					</div>
					<div v-if="subtasks.length === 0" class="empty-mini">
						{{ __("No subtasks yet.") }}
					</div>
					<div v-else class="subtask-list">
						<div
							v-for="st in subtasks"
							:key="st.name"
							class="subtask-row"
							:data-status="st.status"
						>
							<button
								type="button"
								class="subtask-check"
								:class="{ done: st.status === 'Completed' }"
								@click="toggleSubtaskDone(st)"
								:aria-label="st.status === 'Completed' ? __('Mark as not done') : __('Mark as done')"
							/>
							<div class="subtask-body" @click="openSubtask(st)">
								<div class="subtask-title">{{ st.subject }}</div>
								<div v-if="st.exp_end_date" class="subtask-due">
									📅 {{ formatDate(st.exp_end_date) }}
								</div>
							</div>
						</div>
					</div>
					<div class="subtask-add">
						<input
							v-model="newSubtaskTitle"
							type="text"
							class="subtask-input"
							:placeholder="__('+ Add a subtask')"
							@keyup.enter="addSubtask"
						/>
						<button
							class="subtask-add-btn"
							:disabled="!newSubtaskTitle.trim() || addingSubtask"
							@click="addSubtask"
						>
							{{ addingSubtask ? "..." : __("Add") }}
						</button>
					</div>
				</div>

				<!-- Attachments -->
				<div class="section attachments-section">
					<div class="section-label">
						{{ __("Attachments") }}
						<button class="link-btn" @click="triggerUpload">
							{{ uploading ? __("Uploading...") : __("+ Add") }}
						</button>
					</div>
					<input
						ref="fileInputRef"
						type="file"
						multiple
						style="display:none"
						@change="onFilesPicked"
					/>
					<div v-if="attachments.length === 0" class="empty-mini">
						{{ __("No files attached.") }}
					</div>
					<div v-else class="attachments-list">
						<div
							v-for="f in attachments"
							:key="f.name"
							class="attachment-row"
						>
							<a :href="f.file_url" target="_blank" class="attachment-link">
								<ion-icon :icon="documentOutline" />
								<span class="attachment-name">{{ f.file_name }}</span>
								<span v-if="f.file_size" class="attachment-size">
									{{ humanFileSize(f.file_size) }}
								</span>
							</a>
							<button class="attachment-remove" @click="removeAttachment(f)" :title="__('Delete')">×</button>
						</div>
					</div>
				</div>

				<!-- Description (editable textarea) -->
				<div class="section">
					<div class="section-label">{{ __("Description") }}</div>
					<textarea
						class="description-input"
						v-model="local.descriptionText"
						:placeholder="__('Add a description...')"
						rows="4"
						@blur="saveDescription"
					/>
				</div>

				<!-- Comments (newest first) -->
				<div class="section comments-section">
					<div class="section-label">{{ __("Discussion") }}</div>
					<div v-if="comments.length === 0" class="empty-mini">
						{{ __("No comments yet. Start the conversation below.") }}
					</div>
					<div v-else class="comments-list">
						<div v-for="c in comments" :key="c.name" class="comment-card">
							<div class="comment-meta">
								<span class="comment-author">{{ userName(c.owner) }}</span>
								<span class="comment-time">{{ relativeTime(c.creation) }}</span>
							</div>
							<div class="comment-body" v-html="c.content" />
						</div>
					</div>
				</div>

				<!-- Spacer so compose doesn't overlap last comment -->
				<div style="height: 100px;" />
			</template>
		</ion-content>

		<!-- Sticky compose -->
		<ion-footer v-if="task">
			<!-- Mention suggestions popover (positioned above the compose row) -->
			<div v-if="mentionSuggestions.length" class="mention-popover">
				<div
					v-for="u in mentionSuggestions"
					:key="u.name"
					class="mention-row"
					@click="insertMention(u)"
				>
					<div class="mention-name">{{ u.full_name || u.name }}</div>
					<div class="mention-email">{{ u.name }}</div>
				</div>
			</div>
			<ion-toolbar>
				<div class="compose">
					<input
						v-model="newComment"
						type="text"
						class="compose-input"
						:placeholder="__('Add a comment... use @ to mention')"
						@keyup.enter="sendComment"
					/>
					<button
						class="compose-send"
						:disabled="!newComment.trim() || posting"
						@click="sendComment"
					>
						{{ posting ? "..." : "Send" }}
					</button>
				</div>
			</ion-toolbar>
		</ion-footer>
	</ion-page>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch, reactive, nextTick } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
	IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
	IonBackButton, IonContent, IonFooter, IonIcon, IonSpinner,
	toastController, alertController,
} from "@ionic/vue"
import { refreshOutline, trashOutline, documentOutline } from "ionicons/icons"

import { call } from "frappe-ui"
import {
	fetchTask,
	postComment, updateTaskField, deleteTask,
	fetchAttachments, deleteFile,
	fetchSubtasks,
} from "@/data/taskDetail"
import { taskSections, systemUsers, openProjects } from "@/data/tasks"
import { sessionUser } from "@/data/session"
import {
	userName, formatDate, cleanDept, relativeTime,
	parseError, htmlToText, textToHtml, mentionsToHtml, humanFileSize,
	userChipStyle,
} from "@/composables/useTaskHelpers"

const __ = inject("$translate")
const route = useRoute()
const router = useRouter()

const STATUSES = [
	{ value: "Open",            label: "Open",      cls: "open" },
	{ value: "Working",         label: "Working",   cls: "working" },
	{ value: "Pending Review",  label: "Review",    cls: "review" },
	{ value: "Completed",       label: "Completed", cls: "completed" },
]

const taskName = computed(() => route.params.taskName)

const taskRes = ref(null)
// Comments are managed via a local ref instead of createResource because
// the resource pattern had reactivity edge cases (optimistic inserts vanished
// when the resource was replaced; .reload() didn't always trigger the computed).
// Local ref + imperative call() is more predictable.
const commentsList = ref([])
const commentsLoading = ref(false)
const attachmentsRes = ref(null)
const fileInputRef = ref(null)
const uploading = ref(false)
const subtasksRes = ref(null)
const newSubtaskTitle = ref("")
const addingSubtask = ref(false)

// Local editable state — synced from task on load so we can debounce / save on blur
const local = reactive({
	subject: "",
	exp_end_date: "",
	priority: "Medium",
	project: null,
	descriptionText: "",  // plain-text view; saved back as wrapped HTML
})

function loadAll() {
	taskRes.value = fetchTask(taskName.value)
	loadComments()
	attachmentsRes.value = fetchAttachments(taskName.value)
	subtasksRes.value = fetchSubtasks(taskName.value)
}

const subtasks = computed(() => subtasksRes.value?.data || [])

async function addSubtask() {
	const title = (newSubtaskTitle.value || "").trim()
	if (!title || !task.value) return
	addingSubtask.value = true
	try {
		// Inherit project + department + company from parent. Server-side
		// Auto-Set Task Department covers it too but we set explicitly here
		// since createQuickTask via createResource doesn't always trigger
		// the script in time on the PWA's API path.
		const subtask = await call("frappe.client.insert", {
			doc: {
				doctype: "Task",
				subject: title,
				status: "Open",
				parent_task: task.value.name,
				project: task.value.project || null,
				department: task.value.department || null,
				company: task.value.company || null,
			},
		})
		// Assign to creator so it shows up in their "Assigned to me"
		const me = sessionUser()
		if (me) {
			await call("frappe.desk.form.assign_to.add", {
				assign_to: [me],
				doctype: "Task",
				name: subtask.name,
				description: title,
			})
		}
		newSubtaskTitle.value = ""
		subtasksRes.value = fetchSubtasks(taskName.value)
		taskSections.reload()
	} catch (e) {
		const toast = await toastController.create({
			message: parseError(e, __("Couldn't add subtask")),
			duration: 3000, color: "danger",
		})
		toast.present()
	} finally {
		addingSubtask.value = false
	}
}

async function toggleSubtaskDone(st) {
	const target = st.status === "Completed" ? "Open" : "Completed"
	try {
		await updateTaskField.submit({
			doctype: "Task", name: st.name, fieldname: "status", value: target,
		})
		subtasksRes.value = fetchSubtasks(taskName.value)
		taskSections.reload()
	} catch (e) {
		console.error("Subtask toggle failed:", e)
	}
}

function openSubtask(st) {
	router.push("/dashboard/tasks/" + encodeURIComponent(st.name))
}

const attachments = computed(() => attachmentsRes.value?.data || [])

function triggerUpload() {
	if (fileInputRef.value) fileInputRef.value.click()
}

async function onFilesPicked(event) {
	const files = Array.from(event.target.files || [])
	if (!files.length) return
	uploading.value = true
	try {
		for (const f of files) await uploadOne(f)
		attachmentsRes.value = fetchAttachments(taskName.value)
		const toast = await toastController.create({
			message: __("Attached: ") + files.map(f => f.name).join(", "),
			duration: 1800, color: "success",
		})
		toast.present()
	} catch (e) {
		console.error("Upload failed:", e)
		const toast = await toastController.create({
			message: parseError(e, __("Upload failed")),
			duration: 4000, color: "danger",
		})
		toast.present()
	} finally {
		uploading.value = false
		// Reset input so same file can be re-picked
		if (fileInputRef.value) fileInputRef.value.value = ""
	}
}

async function uploadOne(file) {
	// Frappe's upload_file accepts multipart/form-data with these fields
	const fd = new FormData()
	fd.append("file", file, file.name)
	fd.append("doctype", "Task")
	fd.append("docname", taskName.value)
	fd.append("is_private", "0")   // task attachments are usually shared with assignees
	fd.append("folder", "Home/Attachments")
	const csrf = (window.csrf_token || (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] || "")
	const resp = await fetch("/api/method/upload_file", {
		method: "POST",
		credentials: "include",
		headers: csrf ? { "X-Frappe-CSRF-Token": decodeURIComponent(csrf) } : {},
		body: fd,
	})
	if (!resp.ok) {
		const text = await resp.text().catch(() => "")
		throw new Error("HTTP " + resp.status + " " + text.slice(0, 200))
	}
}

async function removeAttachment(f) {
	const alert = await alertController.create({
		header: __("Delete attachment?"),
		message: f.file_name,
		buttons: [
			{ text: __("Cancel"), role: "cancel" },
			{
				text: __("Delete"), role: "destructive",
				handler: async () => {
					try {
						await deleteFile.submit({ doctype: "File", name: f.name })
						attachmentsRes.value = fetchAttachments(taskName.value)
					} catch (e) {
						const t = await toastController.create({
							message: parseError(e, __("Couldn't delete file")),
							duration: 3000, color: "danger",
						})
						t.present()
					}
				},
			},
		],
	})
	alert.present()
}

async function loadComments() {
	commentsLoading.value = true
	try {
		const res = await call("frappe.client.get_list", {
			doctype: "Comment",
			filters: {
				reference_doctype: "Task",
				reference_name: taskName.value,
				comment_type: "Comment",
			},
			fields: ["name", "content", "owner", "creation"],
			order_by: "creation desc",
			limit_page_length: 200,
		})
		commentsList.value = Array.isArray(res) ? res : []
	} catch (e) {
		console.error("Failed to load comments:", e)
	} finally {
		commentsLoading.value = false
	}
}

onMounted(loadAll)
watch(taskName, loadAll)

const task = computed(() => taskRes.value?.data || null)
const comments = computed(() => commentsList.value)
const projects = computed(() => openProjects.data || [])
const loading = computed(() =>
	taskRes.value?.loading || commentsLoading.value
)

// When task loads/reloads, hydrate local fields
watch(task, (t) => {
	if (!t) return
	local.subject = t.subject || ""
	local.exp_end_date = t.exp_end_date ? String(t.exp_end_date).slice(0, 10) : ""
	local.priority = t.priority || "Medium"
	local.project = t.project || null
	local.descriptionText = htmlToText(t.description || "")
	nextTick(autoResize)
}, { immediate: true })

const assigneeList = computed(() => {
	const raw = task.value?._assign
	if (!raw) return []
	try {
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
})

const titleInputRef = ref(null)
function autoResize() {
	const el = titleInputRef.value
	if (!el) return
	el.style.height = "auto"
	el.style.height = el.scrollHeight + "px"
}

function reload() {
	taskRes.value = fetchTask(taskName.value)
	loadComments()
	attachmentsRes.value = fetchAttachments(taskName.value)
}

// Helpers (userName / formatDate / cleanDept / relativeTime / htmlToText
// / textToHtml / parseError / mentionsToHtml / humanFileSize) live in
// composables/useTaskHelpers — imported at the top of this file.

// Generic field save
const saving = ref(false)
async function saveField(fieldname, value) {
	if (!task.value) return
	// Only save if changed
	if (task.value[fieldname] === value) return
	if (fieldname === "subject" && (!value || !value.trim())) {
		// Don't allow empty subject — revert
		local.subject = task.value.subject || ""
		const toast = await toastController.create({
			message: __("Title can't be empty"), duration: 2000, color: "warning",
		})
		toast.present()
		return
	}
	saving.value = true
	try {
		await updateTaskField.submit({
			doctype: "Task",
			name: task.value.name,
			fieldname,
			value,
		})
		taskRes.value = fetchTask(taskName.value)
		taskSections.reload()
	} catch (e) {
		const msg = parseError(e, __("Failed to update"))
		const toast = await toastController.create({ message: msg, duration: 4000, color: "danger" })
		toast.present()
		// revert local
		taskRes.value = fetchTask(taskName.value)
	} finally {
		saving.value = false
	}
}

async function saveDescription() {
	if (!task.value) return
	const newHtml = textToHtml(local.descriptionText)
	const oldText = htmlToText(task.value.description || "")
	if (oldText === local.descriptionText.trim()) return
	saving.value = true
	try {
		await updateTaskField.submit({
			doctype: "Task",
			name: task.value.name,
			fieldname: "description",
			value: newHtml,
		})
		taskRes.value = fetchTask(taskName.value)
	} catch (e) {
		const msg = parseError(e, __("Failed to update description"))
		const toast = await toastController.create({ message: msg, duration: 4000, color: "danger" })
		toast.present()
		taskRes.value = fetchTask(taskName.value)
	} finally {
		saving.value = false
	}
}

async function changeStatus(newStatus) {
	if (!task.value || task.value.status === newStatus) return
	saving.value = true
	try {
		try {
			await updateTaskField.submit({
				doctype: "Task", name: task.value.name,
				fieldname: "status", value: newStatus,
			})
		} catch (firstErr) {
			const m = (firstErr?.message || "") + " " + (firstErr?.toString?.() || "")
			if (m.toLowerCase().includes("failed to fetch") || m.toLowerCase().includes("networkerror")) {
				await updateTaskField.submit({
					doctype: "Task", name: task.value.name,
					fieldname: "status", value: newStatus,
				})
			} else { throw firstErr }
		}
		taskRes.value = fetchTask(taskName.value)
		taskSections.reload()
		const toast = await toastController.create({
			message: __("Status: ") + newStatus,
			duration: 1500,
			color: newStatus === "Completed" ? "success" : "medium",
		})
		toast.present()
	} catch (e) {
		const msg = parseError(e, __("Failed to change status"))
		const toast = await toastController.create({ message: msg, duration: 5000, color: "danger" })
		toast.present()
	} finally {
		saving.value = false
	}
}

function manageAssignees() {
	router.push("/dashboard/tasks/" + encodeURIComponent(taskName.value) + "/assignees")
}

async function onDelete() {
	if (!task.value) return
	const alert = await alertController.create({
		header: __("Delete task?"),
		message: __("This will permanently remove ") + task.value.subject + ". " + __("This can't be undone."),
		buttons: [
			{ text: __("Cancel"), role: "cancel" },
			{
				text: __("Delete"),
				role: "destructive",
				handler: async () => {
					saving.value = true
					try {
						await deleteTask.submit({ doctype: "Task", name: task.value.name })
						taskSections.reload()
						const toast = await toastController.create({
							message: __("Task deleted"), duration: 1500, color: "medium",
						})
						toast.present()
						router.replace("/dashboard/tasks")
					} catch (e) {
						const msg = parseError(e, __("Couldn't delete — you may not have permission"))
						const toast = await toastController.create({
							message: msg, duration: 5000, color: "danger",
						})
						toast.present()
					} finally {
						saving.value = false
					}
				},
			},
		],
	})
	alert.present()
}

const newComment = ref("")
const posting = ref(false)

// @-mention autocomplete state
const mentionQuery = computed(() => {
	const v = newComment.value || ""
	// Match @<query> at the end of the text (before trailing space)
	const m = v.match(/@(\S*)$/)
	return m ? m[1].toLowerCase() : null
})

const mentionSuggestions = computed(() => {
	if (mentionQuery.value === null) return []
	const q = mentionQuery.value
	const users = systemUsers.data || []
	return users
		.filter((u) =>
			(u.full_name || "").toLowerCase().includes(q) ||
			(u.name || "").toLowerCase().includes(q)
		)
		.slice(0, 20)
})

function insertMention(user) {
	// Replace the @<query> at the end of the comment text with @<user-id> + space
	newComment.value = (newComment.value || "").replace(/@(\S*)$/, "@" + user.name + " ")
}

async function sendComment() {
	const text = newComment.value.trim()
	if (!text) return
	const me = sessionUser()
	if (!me) {
		const toast = await toastController.create({
			message: __("You're signed out — please log in again"),
			duration: 3000, color: "danger",
		})
		toast.present()
		return
	}
	posting.value = true
	try {
		// Convert plain @user-id syntax into Frappe's mention HTML spans
		// so add_comment triggers the standard notification chain for
		// each mentioned user.
		const html = mentionsToHtml(text)
		const result = await postComment.submit({
			reference_doctype: "Task",
			reference_name: taskName.value,
			content: html,
			comment_email: me,
			comment_by: me,
		})
		// Optimistic prepend — local ref means this sticks until the
		// real fetch reconciles a moment later.
		const created = result?.message || result
		const optimistic = {
			name: created?.name || "_optimistic_" + Date.now(),
			content: created?.content || html,
			owner: created?.owner || me,
			creation: created?.creation || new Date().toISOString(),
		}
		commentsList.value = [optimistic, ...commentsList.value]
		newComment.value = ""
		const toast = await toastController.create({
			message: __("Comment posted"), duration: 1200, color: "success",
		})
		toast.present()
		// Reconcile with the server (gets the real comment record, replaces
		// our optimistic one with the canonical version).
		await loadComments()
	} catch (e) {
		const msg = parseError(e, __("Failed to post comment"))
		const toast = await toastController.create({
			message: msg, duration: 4000, color: "danger",
		})
		toast.present()
	} finally {
		posting.value = false
	}
}
</script>

<style scoped>
.loading {
	display: flex; justify-content: center; align-items: center;
	min-height: 50vh;
}

.title-block { padding: 16px 18px 8px; }
.task-id {
	font-size: 11px;
	color: var(--ion-color-step-500, #9ca3af);
	letter-spacing: 0.04em;
	text-transform: uppercase;
}
.title-input {
	width: 100%;
	font-size: 22px;
	line-height: 1.3;
	font-weight: 600;
	border: none;
	border-bottom: 1px dashed transparent;
	background: transparent;
	padding: 4px 0;
	margin-top: 4px;
	color: var(--ion-text-color, #1f2937);
	resize: none;
	font-family: inherit;
	outline: none;
}
.title-input:focus {
	border-bottom-color: var(--ion-color-primary, #3880ff);
}

.section {
	padding: 16px 18px 12px;
	border-bottom: 1px solid var(--ion-color-step-100, #e5e7eb);
}
.section-label {
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--ion-color-step-600, #6b7280);
	font-weight: 600;
	margin-bottom: 10px;
	display: flex; justify-content: space-between; align-items: center;
}
.link-btn {
	background: none; border: none;
	color: var(--ion-color-primary, #3880ff);
	font-size: 12px; font-weight: 600;
	cursor: pointer; padding: 0;
	text-transform: none; letter-spacing: 0;
}

.status-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.status-pill {
	padding: 8px 14px;
	border-radius: 18px;
	border: 1px solid var(--ion-color-step-200, #d1d5db);
	background: var(--ion-color-step-50, #fafafa);
	color: var(--ion-color-step-700, #374151);
	font-size: 13px; font-weight: 500;
	cursor: pointer;
	transition: all 0.15s ease;
}
.status-pill.active.s-open { background: #f3f4f6; border-color: #6b7280; color: #374151; }
.status-pill.active.s-working { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
.status-pill.active.s-review { background: #dbeafe; border-color: #3b82f6; color: #1e40af; }
.status-pill.active.s-completed { background: #16a34a; border-color: #16a34a; color: #fff; }
.status-pill:disabled { opacity: 0.6; cursor: not-allowed; }

.meta-section { display: flex; flex-direction: column; gap: 10px; }
.meta-row {
	display: flex; gap: 12px; align-items: baseline;
	font-size: 14px;
}
.meta-edit-row {
	display: flex; gap: 12px; align-items: center;
	font-size: 14px;
}
.meta-key {
	color: var(--ion-color-step-600, #6b7280);
	min-width: 130px;
	font-size: 13px;
	flex-shrink: 0;
}
.meta-val {
	color: var(--ion-text-color, #1f2937);
}
.meta-input {
	flex: 1 1 auto;
	padding: 8px 10px;
	font-size: 14px;
	border: 1px solid var(--ion-color-step-200, #d1d5db);
	border-radius: 8px;
	background: var(--ion-color-step-50, #fafafa);
	color: var(--ion-text-color, #1f2937);
	font-family: inherit;
}
.meta-input:focus {
	outline: none;
	border-color: var(--ion-color-primary, #3880ff);
	background: #fff;
}

.assignee-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.assignee-chip {
	display: inline-flex; align-items: center;
	padding: 4px 10px;
	border-radius: 14px;
	background: #fff7ed; color: #c2410c;
	font-size: 13px; font-weight: 500;
	border: 1px solid #fed7aa;
}
.empty-mini {
	color: var(--ion-color-step-500, #9ca3af);
	font-style: italic;
	font-size: 13px;
}

.subtask-count {
	background: var(--ion-color-step-150, #ebeef0);
	color: var(--ion-color-step-700, #374151);
	border-radius: 10px;
	padding: 1px 8px;
	font-size: 11px;
	font-weight: 500;
	text-transform: none;
	letter-spacing: 0;
}
.subtask-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-bottom: 8px;
}
.subtask-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 4px;
}
.subtask-check {
	flex: 0 0 18px;
	width: 18px; height: 18px;
	border: 1.5px solid var(--ion-color-step-500, #aab1b8);
	border-radius: 4px;
	cursor: pointer;
	position: relative;
	background: transparent;
	padding: 0;
}
.subtask-check::before {
	content: "";
	position: absolute;
	top: 50%; left: 50%;
	width: 5px; height: 9px;
	border: solid #fff;
	border-width: 0 2px 2px 0;
	transform: translate(-50%, -60%) rotate(45deg);
	opacity: 0;
}
.subtask-check.done {
	background: #16a34a;
	border-color: #16a34a;
}
.subtask-check.done::before { opacity: 1; }
.subtask-body {
	flex: 1 1 auto;
	cursor: pointer;
	min-width: 0;
}
.subtask-title {
	font-size: 14px;
	color: var(--ion-text-color, #1f2937);
	line-height: 1.3;
	word-break: break-word;
}
.subtask-row[data-status="Completed"] .subtask-title {
	text-decoration: line-through;
	color: var(--ion-color-step-500, #9ca3af);
}
.subtask-due {
	font-size: 11px;
	color: var(--ion-color-step-500, #9ca3af);
	margin-top: 2px;
}
.subtask-add {
	display: flex;
	gap: 6px;
	margin-top: 8px;
}
.subtask-input {
	flex: 1 1 auto;
	padding: 8px 10px;
	font-size: 13px;
	border: 1px dashed var(--ion-color-step-300, #cbd5e1);
	border-radius: 8px;
	background: transparent;
	color: var(--ion-text-color, #1f2937);
	font-family: inherit;
}
.subtask-input:focus {
	outline: none;
	border-color: var(--ion-color-primary, #3880ff);
	border-style: solid;
	background: var(--ion-color-step-50, #fafafa);
}
.subtask-add-btn {
	background: var(--ion-color-primary, #3880ff);
	color: #fff;
	border: none;
	border-radius: 8px;
	padding: 6px 14px;
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;
}
.subtask-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.attachments-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.attachment-row {
	display: flex;
	align-items: center;
	padding: 8px 10px;
	background: var(--ion-color-step-50, #fafafa);
	border-radius: 8px;
	border: 1px solid var(--ion-color-step-100, #e5e7eb);
}
.attachment-link {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1 1 auto;
	color: var(--ion-text-color, #1f2937);
	text-decoration: none;
	min-width: 0;
}
.attachment-link ion-icon {
	font-size: 18px;
	color: var(--ion-color-primary, #3880ff);
	flex-shrink: 0;
}
.attachment-name {
	flex: 1 1 auto;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 14px;
}
.attachment-size {
	font-size: 11px;
	color: var(--ion-color-step-500, #9ca3af);
	flex-shrink: 0;
	margin-left: 8px;
}
.attachment-remove {
	background: none;
	border: none;
	color: var(--ion-color-step-500, #9ca3af);
	font-size: 22px;
	line-height: 1;
	cursor: pointer;
	padding: 0 8px;
}
.attachment-remove:hover {
	color: var(--ion-color-danger, #eb445a);
}

.description-input {
	width: 100%;
	padding: 12px 14px;
	font-size: 14px;
	line-height: 1.5;
	border: 1px solid var(--ion-color-step-200, #d1d5db);
	border-radius: 10px;
	background: var(--ion-color-step-50, #fafafa);
	color: var(--ion-text-color, #1f2937);
	font-family: inherit;
	resize: vertical;
	min-height: 80px;
}
.description-input:focus {
	outline: none;
	border-color: var(--ion-color-primary, #3880ff);
	background: #fff;
}

.comments-list { display: flex; flex-direction: column; gap: 10px; }
.comment-card {
	padding: 10px 12px;
	background: var(--ion-color-step-50, #fafafa);
	border-radius: 10px;
	border: 1px solid var(--ion-color-step-100, #e5e7eb);
}
.comment-meta {
	display: flex; justify-content: space-between;
	font-size: 12px; margin-bottom: 4px;
}
.comment-author { color: #c2410c; font-weight: 600; }
.comment-time { color: var(--ion-color-step-500, #9ca3af); }
.comment-body {
	font-size: 14px; line-height: 1.4;
	color: var(--ion-text-color, #1f2937);
}
.comment-body :deep(p) { margin: 0 0 4px 0; }

/* Mention autocomplete popover — sits above compose row inside ion-footer */
.mention-popover {
	background: var(--ion-card-background, #fff);
	border-top: 1px solid var(--ion-color-step-100, #e5e7eb);
	max-height: 220px;
	overflow-y: auto;
}
.mention-row {
	padding: 10px 14px;
	cursor: pointer;
	border-bottom: 1px solid var(--ion-color-step-100, #e5e7eb);
}
.mention-row:last-child { border-bottom: none; }
.mention-row:active { background: var(--ion-color-step-100, #f3f4f6); }
.mention-name { font-size: 14px; color: var(--ion-text-color, #1f2937); }
.mention-email { font-size: 12px; color: var(--ion-color-step-500, #9ca3af); }

/* Rendered mention spans inside comments */
.comment-body :deep(.mention) {
	background: #e0e7ff;
	color: #3730a3;
	padding: 1px 5px;
	border-radius: 4px;
	font-weight: 500;
	font-size: 13px;
}

.compose {
	display: flex; align-items: center; gap: 8px;
	padding: 8px 12px;
}
.compose-input {
	flex: 1 1 auto;
	padding: 10px 14px;
	font-size: 15px;
	border: 1px solid var(--ion-color-step-200, #d1d5db);
	border-radius: 18px;
	background: var(--ion-color-step-50, #fafafa);
	color: var(--ion-text-color, #1f2937);
	font-family: inherit;
}
.compose-input:focus {
	outline: none;
	border-color: var(--ion-color-primary, #3880ff);
	background: #fff;
}
.compose-send {
	background: var(--ion-color-primary, #3880ff);
	color: #fff; border: none;
	border-radius: 18px;
	padding: 8px 18px;
	font-size: 14px; font-weight: 600;
	cursor: pointer;
}
.compose-send:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
