"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PersonInput } from "@zyk-dyna-admin/api/lib/person-input";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getPersonSaveError } from "@/lib/person-errors";
import { EMPTY_PERSON_FORM_VALUES } from "@/lib/person-validation";
import { getTrpcErrorCode } from "@/lib/trpc-errors";
import { useTRPC } from "@/utils/trpc";

import PersonForm, { type PersonFormSubmitResult } from "./person-form";

/** 新增人员：`person.create` 成功后让列表失效、提示「已保存」并回到列表 */
export default function PersonCreate() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	const createMutation = useMutation(trpc.person.create.mutationOptions());

	const handleSubmit = async (
		input: PersonInput
	): Promise<PersonFormSubmitResult> => {
		try {
			await createMutation.mutateAsync(input);
		} catch (error) {
			const saveError = getPersonSaveError(getTrpcErrorCode(error));
			if (saveError.type === "employeeNoConflict") {
				return { message: saveError.message, status: "employeeNoConflict" };
			}
			toast.error(saveError.message);
			return { status: "failed" };
		}
		await queryClient.invalidateQueries(trpc.person.list.pathFilter());
		toast.success("已保存");
		router.push("/persons");
		return { status: "saved" };
	};

	return (
		<PersonForm
			defaultValues={EMPTY_PERSON_FORM_VALUES}
			onSubmit={handleSubmit}
		/>
	);
}
