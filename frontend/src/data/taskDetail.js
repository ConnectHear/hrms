/**
 * Data layer for the TaskDetail page.
 *
 * Two resources we recreate per-task: the task doc and its comments.
 * Use as: const { task, comments, ... } = useTaskDetail(taskName)
 */

import { createResource } from "frappe-ui"

export function fetchTask(name) {
	return createResource({
		url: "frappe.client.get",
		params: { doctype: "Task", name },
		auto: true,
	})
}

export function fetchComments(taskName) {
	// Newest first feels more chat-like and matches Talal's request.
	return createResource({
		url: "frappe.client.get_list",
		params: {
			doctype: "Comment",
			filters: JSON.stringify({
				reference_doctype: "Task",
				reference_name: taskName,
				comment_type: "Comment",
			}),
			fields: JSON.stringify(["name", "content", "owner", "creation"]),
			order_by: "creation desc",
			limit_page_length: 200,
		},
		auto: true,
	})
}

export const postComment = createResource({
	url: "frappe.desk.form.utils.add_comment",
})

export const updateTaskField = createResource({
	url: "frappe.client.set_value",
})

export const addAssignees = createResource({
	url: "frappe.desk.form.assign_to.add",
})

export const removeAssignee = createResource({
	url: "frappe.desk.form.assign_to.remove",
})

export const deleteTask = createResource({
	url: "frappe.client.delete",
})

// File attachments on a Task — list via File doctype filtered by attached_to.
// Upload uses Frappe's standard /api/method/upload_file endpoint via FormData
// (createResource doesn't natively support multipart; we use fetch directly
// in the component).
export function fetchAttachments(taskName) {
	return createResource({
		url: "frappe.client.get_list",
		params: {
			doctype: "File",
			filters: JSON.stringify({
				attached_to_doctype: "Task",
				attached_to_name: taskName,
			}),
			fields: JSON.stringify([
				"name", "file_name", "file_url", "is_private",
				"file_size", "owner", "creation",
			]),
			order_by: "creation desc",
			limit_page_length: 100,
		},
		auto: true,
	})
}

export const deleteFile = createResource({
	url: "frappe.client.delete",
})

// Subtasks: list child Tasks where parent_task = this task name.
export function fetchSubtasks(taskName) {
	return createResource({
		url: "frappe.client.get_list",
		params: {
			doctype: "Task",
			filters: JSON.stringify({ parent_task: taskName }),
			fields: JSON.stringify(["name", "subject", "status", "exp_end_date"]),
			order_by: "creation desc",
			limit_page_length: 100,
		},
		auto: true,
	})
}
