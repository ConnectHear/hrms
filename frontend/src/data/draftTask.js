/**
 * Shared draft state for the New Task flow.
 *
 * The flow is multi-page (NewTask.vue → PickAssignees.vue → back) and uses
 * a single reactive object so the picker can write assignees back to the
 * form without route params or events. Reset after a successful submit
 * (unless "Add another" is checked).
 */

import { reactive } from "vue"

export const draftTask = reactive({
	subject: "",
	assignees: [], // array of user IDs (strings)
	dueDate: "",
	project: null,
	addAnother: false,
})

export function resetDraft({ keepRecipients = false } = {}) {
	draftTask.subject = ""
	if (!keepRecipients) {
		draftTask.assignees = []
		draftTask.dueDate = ""
		draftTask.project = null
	}
	draftTask.addAnother = false
}
