import { createResource } from "frappe-ui"
import { reactive, computed } from "vue"
import { sessionUser } from "./session"
import { employeeResource } from "./employee"

// Module-level ref read by taskSections.params getter so the "Show completed"
// toggle in Tasks.vue can flip include_done without re-creating the resource.
import { ref as _ref } from "vue"
export const includeCompletedTasks = _ref(false)

// Sectioned tasks for the current user. Backs the /dashboard/tasks PWA view.
// Mirrors the Desk page hr_automations.page.my_tasks but for mobile.
export const taskSections = createResource({
	url: "hr_automations.hr_automations.page.my_tasks.my_tasks.get_sections",
	makeParams() {
		// Called by frappe-ui on each fetch/reload — reads current toggle.
		return { include_done: includeCompletedTasks.value ? 1 : 0 }
	},
	auto: true,
	cache: "hrms:task_sections",
	transform(data) {
		// Server returns {today, overdue, assigned, created, counts}
		return data || {
			today: [], overdue: [], assigned: [], created: [],
			counts: { today: 0, overdue: 0, assigned: 0, created: 0 },
		}
	},
})

// Helper to toggle and refetch in one call.
export function setIncludeCompleted(val) {
	includeCompletedTasks.value = !!val
	taskSections.reload()
}

// Helper: total open count across all sections — drives badge counts elsewhere
export const totalOpenTasks = computed(() => {
	const c = taskSections.data?.counts
	if (!c) return 0
	return (c.today || 0) + (c.overdue || 0) + (c.assigned || 0) + (c.created || 0)
})

// Mark complete / reopen — binary toggle, mirrors the My Tasks Desk page
export const setTaskStatus = createResource({
	url: "frappe.client.set_value",
	onSuccess() {
		taskSections.reload()
	},
})

export function toggleTaskDone(taskName, currentStatus) {
	const target = currentStatus === "Completed" ? "Open" : "Completed"
	return setTaskStatus.submit({
		doctype: "Task",
		name: taskName,
		fieldname: "status",
		value: target,
	}).then(() => target)
}

// Create a new task + assign via ToDo (mirrors Quick Add modal on Desk).
// Assignee defaults to current user if blank.
const createTaskResource = createResource({
	url: "frappe.client.insert",
})
const assignToResource = createResource({
	url: "frappe.desk.form.assign_to.add",
})

export async function createQuickTask({ subject, assignees, dueDate, project }) {
	if (!subject || !subject.trim()) {
		throw new Error("Title is required")
	}
	const payload = {
		doctype: "Task",
		subject: subject.trim(),
		status: "Open",
	}
	if (dueDate) payload.exp_end_date = dueDate
	if (project) payload.project = project

	// Task has department as a required field (Hub-specific Property Setter).
	// The Auto-Set Task Department Server Script normally fills it on Before
	// Insert from the creator's Employee, but that doesn't always fire in the
	// PWA's API path. Pass it explicitly from the already-loaded employee
	// resource so creation never hits a MandatoryError.
	const emp = employeeResource.data
	if (emp?.department) {
		payload.department = emp.department
	}
	if (emp?.company) {
		payload.company = emp.company
	}

	const task = await createTaskResource.submit({ doc: payload })
	const taskName = task.name

	// Multi-assign. Accepts either an array of user IDs OR a single string for
	// backward compatibility. Empty/null falls back to the current user so the
	// task always has at least one ToDo.
	let list = Array.isArray(assignees) ? assignees.filter(Boolean) : (assignees ? [assignees] : [])
	if (list.length === 0) {
		const me = sessionUser()  // reads user_id from cookie — window.frappe.session doesn't exist in PWA
		if (me) list = [me]
	}
	if (list.length > 0) {
		await assignToResource.submit({
			assign_to: list,
			doctype: "Task",
			name: taskName,
			description: subject.trim(),
		})
	}
	taskSections.reload()
	return task
}

// Lightweight cache of active System Users for the assignee picker
export const systemUsers = createResource({
	url: "frappe.client.get_list",
	params: {
		doctype: "User",
		filters: JSON.stringify({ enabled: 1, user_type: "System User" }),
		fields: JSON.stringify(["name", "full_name"]),
		limit_page_length: 200,
		order_by: "full_name asc",
	},
	auto: true,
	cache: "hrms:active_system_users",
})

// Lightweight cache of open Projects for the project picker.
// Fetch BOTH the ID and project_name so the dropdown can show the human-readable
// name instead of "CHPL-PRJ-2026-xxxx".
export const openProjects = createResource({
	url: "frappe.client.get_list",
	params: {
		doctype: "Project",
		filters: JSON.stringify({ status: "Open" }),
		fields: JSON.stringify(["name", "project_name"]),
		limit_page_length: 100,
		order_by: "modified desc",
	},
	auto: true,
	cache: "hrms:open_projects_v2",
})
