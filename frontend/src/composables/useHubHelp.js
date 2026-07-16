import { ref } from "vue"

// Cross-component trigger for the mobile Hub Help chat.
//
// A screen (e.g. the leave or expense form) calls askHubHelp("question"); the
// globally-mounted HubHelp.vue watches `hubHelpRequest`, opens the chat, and
// pre-fills + sends the question. The incrementing `n` makes each call a fresh
// value so the watcher fires even when the same question is asked twice.
export const hubHelpRequest = ref(null)

let _seq = 0
export function askHubHelp(question = "") {
	_seq += 1
	hubHelpRequest.value = { question, n: _seq }
}
