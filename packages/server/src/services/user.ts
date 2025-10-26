import { db } from "@dokploy/server/db";
import { apikey, member, userAvatar, users_temp } from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { auth } from "../lib/auth";

export type User = typeof users_temp.$inferSelect;

export const addNewProject = async (
	userId: string,
	projectId: string,
	organizationId: string,
) => {
	const userR = await findMemberById(userId, organizationId);

	await db
		.update(member)
		.set({
			accessedProjects: [...userR.accessedProjects, projectId],
		})
		.where(
			and(eq(member.id, userR.id), eq(member.organizationId, organizationId)),
		);
};

export const addNewService = async (
	userId: string,
	serviceId: string,
	organizationId: string,
) => {
	const userR = await findMemberById(userId, organizationId);
	await db
		.update(member)
		.set({
			accessedServices: [...userR.accessedServices, serviceId],
		})
		.where(
			and(eq(member.id, userR.id), eq(member.organizationId, organizationId)),
		);
};

export const canPerformCreationService = async (
	userId: string,
	projectId: string,
	organizationId: string,
) => {
	const { accessedProjects, canCreateServices } = await findMemberById(
		userId,
		organizationId,
	);
	const haveAccessToProject = accessedProjects.includes(projectId);

	if (canCreateServices && haveAccessToProject) {
		return true;
	}

	return false;
};

export const canPerformAccessService = async (
	userId: string,
	serviceId: string,
	organizationId: string,
) => {
	const { accessedServices } = await findMemberById(userId, organizationId);
	const haveAccessToService = accessedServices.includes(serviceId);

	if (haveAccessToService) {
		return true;
	}

	return false;
};

export const canPeformDeleteService = async (
	userId: string,
	serviceId: string,
	organizationId: string,
) => {
	const { accessedServices, canDeleteServices } = await findMemberById(
		userId,
		organizationId,
	);
	const haveAccessToService = accessedServices.includes(serviceId);

	if (canDeleteServices && haveAccessToService) {
		return true;
	}

	return false;
};

export const canPerformCreationProject = async (
	userId: string,
	organizationId: string,
) => {
	const { canCreateProjects } = await findMemberById(userId, organizationId);

	if (canCreateProjects) {
		return true;
	}

	return false;
};

export const canPerformDeleteProject = async (
	userId: string,
	organizationId: string,
) => {
	const { canDeleteProjects } = await findMemberById(userId, organizationId);

	if (canDeleteProjects) {
		return true;
	}

	return false;
};

export const canPerformAccessProject = async (
	userId: string,
	projectId: string,
	organizationId: string,
) => {
	const { accessedProjects } = await findMemberById(userId, organizationId);

	const haveAccessToProject = accessedProjects.includes(projectId);

	if (haveAccessToProject) {
		return true;
	}
	return false;
};

export const canAccessToTraefikFiles = async (
	userId: string,
	organizationId: string,
) => {
	const { canAccessToTraefikFiles } = await findMemberById(
		userId,
		organizationId,
	);
	return canAccessToTraefikFiles;
};

export const checkServiceAccess = async (
	userId: string,
	serviceId: string,
	organizationId: string,
	action = "access" as "access" | "create" | "delete",
) => {
	let hasPermission = false;
	switch (action) {
		case "create":
			hasPermission = await canPerformCreationService(
				userId,
				serviceId,
				organizationId,
			);
			break;
		case "access":
			hasPermission = await canPerformAccessService(
				userId,
				serviceId,
				organizationId,
			);
			break;
		case "delete":
			hasPermission = await canPeformDeleteService(
				userId,
				serviceId,
				organizationId,
			);
			break;
		default:
			hasPermission = false;
	}
	if (!hasPermission) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Permission denied",
		});
	}
};

export const checkProjectAccess = async (
	authId: string,
	action: "create" | "delete" | "access",
	organizationId: string,
	projectId?: string,
) => {
	let hasPermission = false;
	switch (action) {
		case "access":
			hasPermission = await canPerformAccessProject(
				authId,
				projectId as string,
				organizationId,
			);
			break;
		case "create":
			hasPermission = await canPerformCreationProject(authId, organizationId);
			break;
		case "delete":
			hasPermission = await canPerformDeleteProject(authId, organizationId);
			break;
		default:
			hasPermission = false;
	}
	if (!hasPermission) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Permission denied",
		});
	}
};

export const findMemberById = async (
	userId: string,
	organizationId: string,
) => {
	const result = await db.query.member.findFirst({
		where: and(
			eq(member.userId, userId),
			eq(member.organizationId, organizationId),
		),
		with: {
			user: true,
		},
	});

	if (!result) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Permission denied",
		});
	}
	return result;
};

export const updateUser = async (userId: string, userData: Partial<User>) => {
	const user = await db
		.update(users_temp)
		.set({
			...userData,
		})
		.where(eq(users_temp.id, userId))
		.returning()
		.then((res) => res[0]);

	return user;
};

export const setUploadedAvatar = async (params: {
	userId: string;
	contentType: string;
	sizeBytes: number;
	base64Data: string;
}) => {
	const { userId, contentType, sizeBytes, base64Data } = params;
	// Get current version
	const current = await db.query.users_temp.findFirst({ where: eq(users_temp.id, userId) });
	if (!current) {
		throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
	}
	const newVersion = (current.avatarVersion ?? 0) + 1;

	// Upsert avatar data
	await db
		.insert(userAvatar)
		.values({ userId, contentType, sizeBytes, data: base64Data })
		.onConflictDoUpdate({ target: userAvatar.userId, set: { contentType, sizeBytes, data: base64Data, updatedAt: new Date() } });

	// Update user metadata and image URL to route for compatibility
	const imageUrl = `/api/user/avatar/${userId}?v=${newVersion}`;
	await db
		.update(users_temp)
		.set({ avatarType: "uploaded", avatarPredefinedId: null, avatarVersion: newVersion, image: imageUrl })
		.where(eq(users_temp.id, userId));

	return { avatarType: "uploaded" as const, avatarVersion: newVersion };
};

export const setPredefinedAvatar = async (params: { userId: string; predefinedAvatarId: string }) => {
	const { userId, predefinedAvatarId } = params;
	const current = await db.query.users_temp.findFirst({ where: eq(users_temp.id, userId) });
	if (!current) {
		throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
	}
	const newVersion = (current.avatarVersion ?? 0) + 1;

	// Remove stored uploaded avatar if exists
	await db.delete(userAvatar).where(eq(userAvatar.userId, userId));

	await db
		.update(users_temp)
		.set({ avatarType: "predefined", avatarPredefinedId: predefinedAvatarId, avatarVersion: newVersion, image: predefinedAvatarId })
		.where(eq(users_temp.id, userId));

	return { avatarType: "predefined" as const, avatarVersion: newVersion, predefinedAvatarId };
};

export const createApiKey = async (
	userId: string,
	input: {
		name: string;
		prefix?: string;
		expiresIn?: number;
		metadata: {
			organizationId: string;
		};
		rateLimitEnabled?: boolean;
		rateLimitTimeWindow?: number;
		rateLimitMax?: number;
		remaining?: number;
		refillAmount?: number;
		refillInterval?: number;
	},
) => {
	const apiKey = await auth.createApiKey({
		body: {
			name: input.name,
			expiresIn: input.expiresIn,
			prefix: input.prefix,
			rateLimitEnabled: input.rateLimitEnabled,
			rateLimitTimeWindow: input.rateLimitTimeWindow,
			rateLimitMax: input.rateLimitMax,
			remaining: input.remaining,
			refillAmount: input.refillAmount,
			refillInterval: input.refillInterval,
			userId,
		},
	});

	if (input.metadata) {
		await db
			.update(apikey)
			.set({
				metadata: JSON.stringify(input.metadata),
			})
			.where(eq(apikey.id, apiKey.id));
	}
	return apiKey;
};
