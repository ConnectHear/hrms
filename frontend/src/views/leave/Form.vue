<template>
    <ion-page>
        <ion-content :fullscreen="true">
            <!-- CUSTOM: Hub Help moment-of-need pointer (create only) -->
            <div
                v-if="!props.id"
                class="rounded p-3 m-4 mb-0 cursor-pointer"
                style="background: #e9f7f8; border: 1px solid #cdeced"
                @click="askHubHelp('How does casual leave notice work, and how do I apply for leave?')"
            >
                <p class="text-sm" style="color: #0f7f86">
                    💬 Not sure about the leave rules — notice, half-day, or sick-leave proof?
                    <span class="font-semibold underline">Ask Hub Help →</span>
                </p>
            </div>
            <!-- END CUSTOM -->

            <!-- CUSTOM: Insufficient Balance Alert -->
            <div v-if="conversionState.show" class="bg-red-50 border border-red-200 rounded p-4 m-4 mb-0">
                <div class="flex flex-col gap-2">
                    <p class="text-red-700 text-sm font-medium">
                        ⚠️ <b>Insufficient Balance.</b> You are short by {{ conversionState.deficit }} Casual Leave(s).
                    </p>
                    <p class="text-gray-600 text-xs">
                        You can convert <b>{{ conversionState.cost }} Sick Leaves</b> to cover this.
                    </p>
                    <Button 
                        variant="solid" 
                        theme="red" 
                        :loading="convertLeaveResource.loading"
                        @click="convertLeaveResource.submit()">
                        📉 Exchange Leaves
                    </Button>
                </div>
            </div>
            <!-- END CUSTOM -->

            <!-- CUSTOM: workflow status banner — once after_insert auto-transitions
                 the doc to "Pending LM Approval", show the employee a clear "you're
                 done, awaiting manager" message instead of a misleading Submit button. -->
            <div v-if="pendingStatusMessage" class="bg-yellow-50 border border-yellow-200 rounded p-3 m-4 mb-0">
                <p class="text-yellow-800 text-sm">
                    🟡 {{ pendingStatusMessage }}
                </p>
            </div>
            <!-- END CUSTOM -->

            <FormView
                v-if="formFields.data"
                doctype="Leave Application"
                v-model="leaveApplication"
                :isSubmittable="canSubmit"
                :fields="formFields.data"
                :id="props.id"
                :showAttachmentView="true"
                @validateForm="validateForm"
            />
        </ion-content>
    </ion-page>
</template>

<script setup>
import { IonPage, IonContent } from "@ionic/vue"
import { createResource, Button } from "frappe-ui" // Added Button import
import { ref, watch, inject, computed } from "vue"

import FormView from "@/components/FormView.vue"
import { askHubHelp } from "@/composables/useHubHelp"

const dayjs = inject("$dayjs")
const __ = inject("$translate")
const today = dayjs().format("YYYY-MM-DD")

const props = defineProps({
    id: {
        type: String,
        required: false,
    },
})

const sessionEmployee = inject("$employee")
const currEmployee = ref(sessionEmployee.data.name)
const userResource = inject("$user")

// reactive object to store form data
const leaveApplication = ref({})

// CUSTOM: Hide the Submit button once the doc is in a workflow approval
// state — the auto-submit after_insert hook moves it to "Pending LM Approval"
// for the employee, and clicking Submit at that point would just error since
// they don't have the role to perform the next transition. Showing a status
// banner instead avoids the "what do I do now?" confusion.
const canSubmit = computed(() => {
    if (!props.id) return true  // new doc — let Save fire; server hook transitions
    const state = leaveApplication.value.workflow_state
    return state !== "Pending LM Approval" && state !== "Pending HR Approval"
})

const pendingStatusMessage = computed(() => {
    const state = leaveApplication.value.workflow_state
    if (state === "Pending LM Approval") {
        return __("Sent to your manager for approval — no further action needed from you.")
    } else if (state === "Pending HR Approval") {
        return __("Your manager approved this. Awaiting HR for final approval.")
    }
    return null
})

// CUSTOM: State for conversion logic
const conversionState = ref({
    show: false,
    deficit: 0,
    cost: 0
})

// CUSTOM: Resource to call backend
const convertLeaveResource = createResource({
    url: "hr_automations.leave_utils.convert_sl_to_cl",
    makeParams() {
        return {
            employee: currEmployee.value,
            sl_to_deduct: conversionState.value.cost
        }
    },
    onSuccess(data) {
        // Refresh balance after success
        setLeaveBalance()
    }
})

// get form fields
const formFields = createResource({
    url: "hrms.api.get_doctype_fields",
    params: { doctype: "Leave Application" },
    transform(data) {
        let fields = getFilteredFields(data)

        return fields.map((field) => {
            if (field.fieldname === "half_day_date") field.hidden = true

            if (field.fieldname === "posting_date") field.default = today

            return field
        })
    },
    onSuccess(_data) {
        leaveApprovalDetails.reload()
        leaveTypes.reload()
        toggleProjectField(leaveApplication.value.leave_type) 

    },
})
formFields.reload()

const leaveApprovalDetails = createResource({
    url: "hrms.api.get_leave_approval_details",
    params: { employee: currEmployee.value },
    onSuccess(data) {
        setLeaveApprovers(data)
    },
})

const leaveTypes = createResource({
    url: "hrms.api.get_leave_types",
    params: {
        employee: currEmployee.value,
        date: today,
    },
    onSuccess(data) {
        setLeaveTypes(data)
    },
})

// form scripts
watch(
    () => leaveApplication.value.employee,
    (employee_id) => {
        if (props.id && employee_id !== currEmployee.value) {
            setFormReadOnly()
        }
        currEmployee.value = employee_id
        leaveTypes.fetch({ employee: currEmployee.value, date: today })
        leaveApprovalDetails.fetch({ employee: currEmployee.value })
    }
)
watch(
    () => leaveApplication.value.leave_type,
    (leave_type) => {
        setLeaveBalance(leave_type)
        toggleProjectField(leave_type) // <--- NEW CALL
    }
)

watch(
    () => leaveApplication.value.half_day,
    (half_day) => setHalfDayDate(half_day)
)

watch(
    () => leaveApplication.value.half_day && leaveApplication.value.half_day_date,
    () => setTotalLeaveDays()
)

watch(
    () => leaveApplication.value.from_date,
    (from_date) => {
        if (!leaveApplication.value.to_date) {
            leaveApplication.value.to_date = from_date
        }
        leaveTypes.fetch({
            employee: currEmployee.value,
            date: from_date,
        })
    }
)

watch(
    () => [leaveApplication.value.from_date, leaveApplication.value.to_date],
    ([from_date, to_date]) => {
        validateDates(from_date, to_date)
        setHalfDayDateRange()
        setTotalLeaveDays()
    }
)

watch(
    () => leaveApplication.value.leave_approver,
    (newApprover) => {
        const approverField = formFields.data.find(f => f.fieldname === "leave_approver")
        const selected = approverField?.documentList?.find(opt => opt.value === newApprover)
        leaveApplication.value.leave_approver_name = selected?.label?.split(" : ")[1] || ""
    }
)

// helper functions
function getFilteredFields(fields) {
    const excludeFields = [
        "naming_series",
        "sb_other_details",
        "salary_slip",
        "letter_head",
    ]

    const employeeFields = [
        "employee",
        "employee_name",
        "department",
        "company",
        "follow_via_email",
        "status",
        "posting_date",
    ]

    if (!props.id) excludeFields.push(...employeeFields)

    return fields.filter((field) => !excludeFields.includes(field.fieldname))
}

function setFormReadOnly() {
    if (leaveApplication.value.leave_approver === sessionEmployee.data.user_id) return
    formFields.data.map((field) => (field.read_only = true))
}

function validateDates(from_date, to_date) {
    if (!(from_date && to_date)) return

    const error_message =
        from_date > to_date ? __("To Date cannot be before From Date") : ""
    const from_date_field = formFields.data.find(
        (field) => field.fieldname === "from_date"
    )
    from_date_field.error_message = error_message
}

function setTotalLeaveDays() {
    if (!areValuesSet()) return

    const leaveDays = createResource({
        url: "hrms.hr.doctype.leave_application.leave_application.get_number_of_leave_days",
        params: {
            employee: currEmployee.value,
            leave_type: leaveApplication.value.leave_type,
            from_date: leaveApplication.value.from_date,
            to_date: leaveApplication.value.to_date,
            half_day: leaveApplication.value.half_day,
            half_day_date: leaveApplication.value.half_day_date,
        },
        onSuccess(data) {
            leaveApplication.value.total_leave_days = data
            // CUSTOM: Check eligibility after days are calculated
            checkConversionEligibility(leaveApplication.value.leave_balance, data)
        },
    })
    leaveDays.reload()
    setLeaveBalance()
}

function setLeaveBalance() {
    if (!areValuesSet()) return

    const leaveBalance = createResource({
        url: "hrms.hr.doctype.leave_application.leave_application.get_leave_balance_on",
        params: {
            employee: currEmployee.value,
            date: leaveApplication.value.from_date,
            to_date: leaveApplication.value.to_date,
            leave_type: leaveApplication.value.leave_type,
            consider_all_leaves_in_the_allocation_period: 1,
        },
        onSuccess(data) {
            leaveApplication.value.leave_balance = data
            // CUSTOM: Check eligibility after balance is fetched
            checkConversionEligibility(data, leaveApplication.value.total_leave_days)
        },
    })
    leaveBalance.reload()
}
function toggleProjectField(leaveType) {
    if (!formFields.data) return;

    const projectField = formFields.data.find(f => f.fieldname === 'custom_project');
    
    if (projectField) {
        if (leaveType === "Compensatory Off") {
            // Show and Make Mandatory
            projectField.hidden = 0;
            projectField.reqd = 1;
        } else {
            // Hide and Reset
            projectField.hidden = 1;
            projectField.reqd = 0;
            leaveApplication.value.custom_project = ""; 
        }
    }
}
// CUSTOM: Logic to calculate deficit
function checkConversionEligibility(balance, daysNeeded) {
    // Reset state
    conversionState.value.show = false
    
    if (leaveApplication.value.leave_type !== "Casual Leave") return
    if (!daysNeeded || daysNeeded <= 0) return

    const currentBalance = balance || 0
    const deficit = daysNeeded - currentBalance

    if (deficit > 0) {
        conversionState.value.deficit = deficit
        conversionState.value.cost = Math.ceil(deficit * 2)
        conversionState.value.show = true
    }
}

function setHalfDayDate(half_day) {
    const half_day_date = formFields.data.find(
        (field) => field.fieldname === "half_day_date"
    )
    half_day_date.hidden = !half_day
    half_day_date.reqd = half_day

    if (!half_day) return

    if (leaveApplication.value.from_date === leaveApplication.value.to_date) {
        leaveApplication.value.half_day_date = leaveApplication.value.from_date
    } else {
        setHalfDayDateRange()
    }
}

function setHalfDayDateRange() {
    const half_day_date = formFields.data.find(
        (field) => field.fieldname === "half_day_date"
    )
    half_day_date.minDate = leaveApplication.value.from_date
    half_day_date.maxDate = leaveApplication.value.to_date
}

function setLeaveApprovers(data) {
    const leave_approver = formFields.data?.find(
        (field) => field.fieldname === "leave_approver"
    )
    leave_approver.reqd = data?.is_mandatory
    leave_approver.documentList = data?.department_approvers.map((approver) => ({
        label: approver.full_name
            ? `${approver.name} : ${approver.full_name}`
            : approver.name,
        value: approver.name,
    }))
    if (!leaveApplication.value.leave_approver){
        leaveApplication.value.leave_approver = data?.leave_approver
        leaveApplication.value.leave_approver_name = data?.leave_approver_name
    }
}

function setLeaveTypes(data) {
    const leave_type = formFields.data.find(
        (field) => field.fieldname === "leave_type"
    )
    leave_type.documentList = data?.map((leave_type) => ({
        label: leave_type,
        value: leave_type,
    }))
}

function areValuesSet() {
    return (
        leaveApplication.value.from_date &&
        leaveApplication.value.to_date &&
        leaveApplication.value.leave_type
    )
}

function validateForm() {
    setHalfDayDate(leaveApplication.value.half_day)
    leaveApplication.value.employee = currEmployee.value
}
</script>
