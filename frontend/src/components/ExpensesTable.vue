<template>
	<!-- Header -->
	<div class="flex flex-row justify-between items-center mt-2">
		<h2 class="text-base font-semibold text-gray-800">{{ __("Expenses") }} </h2>
		<div class="flex flex-row gap-3 items-center">
			<span class="text-base font-semibold text-gray-800">
				{{ formatCurrency(expenseClaim.total_claimed_amount, currency) }}
			</span>
			<Button
				v-if="!isReadOnly"
				id="add-expense-modal"
				class="text-sm"
				icon="plus"
				variant="subtle"
				@click="openModal()"
			/>
		</div>
	</div>

	<!-- Table -->
	<div
		v-if="expenseClaim.expenses"
		class="flex flex-col bg-white mt-5 rounded border overflow-auto"
	>
		<div
			class="flex flex-row p-3.5 items-center justify-between border-b cursor-pointer"
			v-for="(item, idx) in expenseClaim.expenses"
			:key="idx"
			@click="openModal(item, idx)"
		>
			<div class="flex flex-col w-full justify-center gap-2.5">
				<div class="flex flex-row items-center justify-between">
					<div class="flex flex-row items-start gap-3 grow">
						<div class="flex flex-col items-start gap-1.5">
							<div class="text-base font-normal text-gray-800">
								{{ __(item.expense_type) }}
							</div>
							<div class="text-xs font-normal text-gray-500">
								<span>
									{{
										__("{0}: {1}", [
											__("Sanctioned"),
											formatCurrency(item.sanctioned_amount || 0, currency),
										])
									}}
								</span>
								<span class="whitespace-pre"> &middot; </span>
								<span class="whitespace-nowrap" v-if="item.expense_date">
									{{ dayjs(item.expense_date).format("D MMM") }}
								</span>
							</div>
						</div>
					</div>
					<div class="flex flex-row justify-end items-center gap-2">
						<span class="text-gray-700 font-normal rounded text-base">
							{{ formatCurrency(item.amount, currency) }}
						</span>
						<FeatherIcon name="chevron-right" class="h-5 w-5 text-gray-500" />
					</div>
				</div>
			</div>
		</div>
	</div>
	<EmptyState v-else :message="__('No expenses added')" :isTableField="true" />

	<CustomIonModal :isOpen="isModalOpen" @didDismiss="resetSelectedItem()">
		<template #actionSheet>
			<!-- Add Expense Action Sheet -->
			<div class="bg-white w-full flex flex-col items-center justify-center pb-5">
				<div class="w-full pt-8 pb-5 border-b text-center">
					<span class="text-gray-900 font-bold text-lg">
						{{ modalTitle }}
					</span>
				</div>
				<div class="w-full flex flex-col items-center justify-center gap-5 p-4 max-h-[80vh]">
					<div class="flex flex-col w-full space-y-4 overflow-y-auto">
						
                        <!-- STANDARD FIELDS LOOP -->
						<FormField
							v-for="field in expensesTableFields.data"
							:key="field.fieldname"
							class="w-full"
							:label="__(field.label, null, 'Expense Claim Detail')"
							:fieldtype="field.fieldtype"
							:fieldname="field.fieldname"
							:options="field.options"
							:hidden="field.hidden"
							:reqd="field.reqd"
							:default="field.default"
							:readOnly="field.read_only || isReadOnly"
                            :placeholder="field.placeholder" 
							v-model="expenseItem[field.fieldname]"
						/>

						<!-- CUSTOM TRAVEL LOGIC START -->
						<div v-if="expenseItem.expense_type === 'Transport / Conveyance'" class="mt-4 bg-gray-50 p-3 rounded border">
							<h3 class="text-sm font-bold text-gray-800 mb-3">Trip Details</h3>

							<!-- Row 1: From / To -->
							<div class="flex flex-col gap-3 mb-3">
								<FormField
									label="Travel From"
									fieldtype="Data"
									fieldname="travel_from"
									v-model="expenseItem.travel_from"
								/>
								<FormField
									label="Travel To"
									fieldtype="Data"
									fieldname="travel_to"
									v-model="expenseItem.travel_to"
								/>
							</div>

							<!-- Row 2: Mode / Distance -->
							<div class="flex gap-3 mb-3">
								<div class="w-1/2">
									<FormField
										label="Mode of Travel"
										fieldtype="Select"
										fieldname="travel_mode"
										options="Ride hailing (Careem, Yango, inDrive)
Personal vehicle - Bike
Personal vehicle - Car
Public Transport"
										v-model="expenseItem.travel_mode"
									/>
								</div>
								<div class="w-1/2">
									<FormField
										label="Distance (KM)"
										fieldtype="Float"
										fieldname="distance_km"
										v-model="expenseItem.distance_km"
									/>
								</div>
							</div>
						</div>
						<!-- CUSTOM TRAVEL LOGIC END -->

                        <!-- Row 3: Attachment (Global) -->
                        <div>
                            <!-- Added Red Asterisk for Mandatory -->
                            <label class="block text-xs font-medium text-gray-700 mb-2">
                                Receipt / Screenshot <span class="text-red-600">*</span>
                            </label>
                            
                            <input
                                type="file"
                                id="manual-upload"
                                accept="image/*,.pdf"
                                class="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-xs file:font-semibold
                                    file:bg-gray-100 file:text-gray-700
                                    hover:file:bg-gray-200
                                    border border-gray-300 rounded-lg p-1
                                "
                                @change="uploadReceipt"
                            />

                            <!-- Success Preview -->
                            <div v-if="expenseItem.travel_proof" class="mt-2 flex items-center gap-2 text-xs text-green-600 font-bold">
                                <FeatherIcon name="check-circle" class="w-4 h-4" />
                                <span>File Attached!</span>
                                <a :href="expenseItem.travel_proof" target="_blank" class="underline text-blue-600 ml-2">View</a>
                            </div>
                        </div>

                        <!-- Row 4: Proof of Payment (Optional — only when Finance asks for it) -->
                        <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">
                                Proof of Payment <span class="text-gray-400">(optional)</span>
                            </label>
                            <p class="text-[11px] text-gray-500 mb-2">Bank/wallet payment confirmation (only if Finance asks).</p>

                            <input
                                type="file"
                                id="manual-upload-pop"
                                accept="image/*,.pdf"
                                class="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-xs file:font-semibold
                                    file:bg-gray-100 file:text-gray-700
                                    hover:file:bg-gray-200
                                    border border-gray-300 rounded-lg p-1
                                "
                                @change="uploadProofOfPayment"
                            />

                            <div v-if="expenseItem.custom_proof_of_transaction" class="mt-2 flex items-center gap-2 text-xs text-green-600 font-bold">
                                <FeatherIcon name="check-circle" class="w-4 h-4" />
                                <span>File Attached!</span>
                                <a :href="expenseItem.custom_proof_of_transaction" target="_blank" class="underline text-blue-600 ml-2">View</a>
                            </div>
                        </div>

					</div>
					<div
						v-if="!isReadOnly"
						class="flex w-full flex-row items-center justify-between gap-3"
					>
						<Button
							v-if="editingIdx !== null"
							class="border-red-600 text-red-600 py-5 text-sm"
							variant="outline"
							theme="red"
							@click="deleteExpenseItem()"
						>
							<template #prefix>
								<FeatherIcon name="trash" class="w-4" />
							</template>
							{{ __("Delete") }}
						</Button>
						<Button
							variant="solid"
							class="w-full py-5 text-sm disabled:bg-gray-700 disabled:text-white"
							@click="updateExpenseItem()"
							:disabled="addButtonDisabled"
						>
							<template #prefix>
								<FeatherIcon
									:name="editingIdx === null ? 'plus' : 'check'"
									class="w-4"
								/>
							</template>
							{{ editingIdx === null ? __("Add Expense") : __("Update Expense") }}
						</Button>
					</div>
				</div>
			</div>
		</template>
	</CustomIonModal>
</template>

<script setup>
import { FeatherIcon, createResource } from "frappe-ui"
import { computed, ref, watch, inject } from "vue"

import FormField from "@/components/FormField.vue"
import EmptyState from "@/components/EmptyState.vue"
import CustomIonModal from "@/components/CustomIonModal.vue"

import { claimTypesByID } from "@/data/claims"
import { formatCurrency } from "@/utils/formatters"

const props = defineProps({
	expenseClaim: {
		type: Object,
		required: true,
	},
	currency: {
		type: String,
		required: true,
	},
	isReadOnly: {
		type: Boolean,
		default: false,
	},
})
const emit = defineEmits([
	"add-expense-item",
	"update-expense-item",
	"delete-expense-item",
])
const dayjs = inject("$dayjs")
const __ = inject("$translate")
const expenseItem = ref({})
const editingIdx = ref(null)

const isModalOpen = ref(false)
const isFirstRender = ref(false)

const openModal = async (item, idx) => {
	if (item) {
		expenseItem.value = { ...item }
		editingIdx.value = idx
	}
	isFirstRender.value = true
	isModalOpen.value = true
}

const deleteExpenseItem = () => {
	emit("delete-expense-item", editingIdx.value)
	resetSelectedItem()
}

const updateExpenseItem = () => {
	if (editingIdx.value === null) {
		emit("add-expense-item", expenseItem.value)
	} else {
		emit("update-expense-item", expenseItem.value, editingIdx.value)
	}
	resetSelectedItem()
}

function resetSelectedItem() {
	isFirstRender.value = false
	isModalOpen.value = false
	expenseItem.value = {}
	editingIdx.value = null
}

const uploadReceipt = (e) => uploadFileTo(e, "travel_proof")
const uploadProofOfPayment = (e) => uploadFileTo(e, "custom_proof_of_transaction")

async function uploadFileTo(e, targetField) {
	const file = e.target.files[0]
	if (!file) return

	const formData = new window.FormData()
	formData.append("file", file, file.name)
	formData.append("is_private", 0)

	// Attach to Employee to avoid 403 Orphan error for Admins. NOTE: this
	// requires the uploading user to have write permission on their own
	// Employee record (via `Employee Self Service` role's if_owner clause).
	// Users missing that role will silently fail the upload — make sure
	// every regular employee has Employee Self Service granted.
	if (props.expenseClaim && props.expenseClaim.employee) {
		formData.append("doctype", "Employee")
		formData.append("docname", props.expenseClaim.employee)
	}

	try {
		e.target.style.opacity = "0.5"

		const res = await fetch("/api/method/upload_file", {
			method: "POST",
			headers: { "X-Frappe-CSRF-Token": window.csrf_token },
			body: formData,
		})

		if (!res.ok) {
			throw new Error(`Upload failed: HTTP ${res.status}`)
		}

		const data = await res.json()

		if (data.message) {
			expenseItem.value[targetField] = data.message.file_url
			e.target.style.opacity = "1"
			e.target.style.borderColor = "#22c55e"
			e.target.style.backgroundColor = "#f0fdf4"
		} else {
			throw new Error("Upload succeeded but server returned no file URL")
		}
	} catch (err) {
		console.error("Upload failed", err)
		e.target.style.opacity = "1"
		e.target.style.borderColor = "#dc2626"
		alert("Upload failed. Please try again or use a smaller file.")
	}
}

const expensesTableFields = createResource({
	url: "hrms.api.get_doctype_fields",
	params: { doctype: "Expense Claim Detail" },
	transform(data) {
        const excludeFields = ["description_sb", "amounts_sb", "travel_from", "travel_to", "distance_km", "travel_mode", "travel_proof", "custom_proof_of_transaction", "initiative", "campaign"]
		
        // 1. FILTER FIELDS
        let filtered = data.filter((field) => !excludeFields.includes(field.fieldname))

        // 2. INJECT HELPER TEXT FOR DESCRIPTION
        filtered = filtered.map(field => {
            if (field.fieldname === 'description') {
                field.placeholder = "Name of person travelled with and other details (if applicable)"
            }
            return field
        })

        return filtered
	},
})
expensesTableFields.reload()

const modalTitle = computed(() => {
	if (props.isReadOnly) return __("Expense Item")

	return editingIdx.value === null ? __("New Expense Item") : __("Edit Expense Item")
})

const addButtonDisabled = computed(() => {
    // 1. Check standard fields required
	const standardMissing = expensesTableFields.data?.some((field) => {
		if (field.reqd && !expenseItem.value[field.fieldname]) {
			return true
		}
	})
    if (standardMissing) return true;

    // 2. CHECK CUSTOM MANDATORY ATTACHMENT
    // If no file link is present, disable the button
    if (!expenseItem.value.travel_proof) {
        return true;
    }

    return false;
})

// child table form scripts
watch(
	() => expenseItem.value.expense_type,
	(value) => {
		if (!expenseItem.value.description) {
			expenseItem.value.description = claimTypesByID[value]?.description
		}

		expenseItem.value.cost_center = props.expenseClaim.cost_center
	}
)

watch(
	() => expenseItem.value.amount,
	(value) => {
		if (!isFirstRender.value) {
			expenseItem.value.sanctioned_amount = parseFloat(value)
		} else {
			isFirstRender.value = false
		}
	}
)
</script>
