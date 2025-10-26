import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { generateSHA256Hash } from "@/lib/utils";
import { api } from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, User } from "lucide-react";
import { useTranslation } from "next-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Disable2FA } from "./disable-2fa";
import { Enable2FA } from "./enable-2fa";

const profileSchema = z.object({
	email: z.string(),
	password: z.string().nullable(),
	currentPassword: z.string().nullable(),
	image: z.string().optional(),
	allowImpersonation: z.boolean().optional().default(false),
});

type Profile = z.infer<typeof profileSchema>;

const randomImages = [
	"/avatars/avatar-1.png",
	"/avatars/avatar-2.png",
	"/avatars/avatar-3.png",
	"/avatars/avatar-4.png",
	"/avatars/avatar-5.png",
	"/avatars/avatar-6.png",
	"/avatars/avatar-7.png",
	"/avatars/avatar-8.png",
	"/avatars/avatar-9.png",
	"/avatars/avatar-10.png",
	"/avatars/avatar-11.png",
	"/avatars/avatar-12.png",
];

export const ProfileForm = () => {
	const _utils = api.useUtils();
	const { data, refetch, isLoading } = api.user.get.useQuery();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [uploadPreview, setUploadPreview] = useState<string | null>(null);
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
	const { data: isCloud } = api.settings.isCloud.useQuery();

	const {
		mutateAsync,
		isLoading: isUpdating,
		isError,
		error,
	} = api.user.update.useMutation();
	const updateAvatarMutation = api.user.updateAvatar.useMutation();
	const { t } = useTranslation("settings");
	const [gravatarHash, setGravatarHash] = useState<string | null>(null);

	const availableAvatars = useMemo(() => {
		if (gravatarHash === null) return randomImages;
		return randomImages.concat([
			`https://www.gravatar.com/avatar/${gravatarHash}`,
		]);
	}, [gravatarHash]);

	const form = useForm<Profile>({
		defaultValues: {
			email: data?.user?.email || "",
			password: "",
			image: data?.user?.image || "",
			currentPassword: "",
			allowImpersonation: data?.user?.allowImpersonation || false,
		},
		resolver: zodResolver(profileSchema),
	});

	const currentImage = form.watch("image");
	const isUploadedAvatar = currentImage?.startsWith("/api/user/avatar/") || false;

	const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		if (!file.type.startsWith("image/")) {
			setUploadError("Please select an image file");
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			return;
		}
		if (file.size > MAX_IMAGE_SIZE) {
			setUploadError("Image must be 2MB or smaller");
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			return;
		}

		const url = URL.createObjectURL(file);
		if (uploadPreview) URL.revokeObjectURL(uploadPreview);
		setUploadPreview(url);
		setUploadFile(file);
		setUploadError(null);

		form.setValue("image", "__uploaded_preview__", {
			shouldValidate: true,
			shouldDirty: true,
		});
	};

	useEffect(() => {
		return () => {
			if (uploadPreview) URL.revokeObjectURL(uploadPreview);
		};
	}, [uploadPreview]);

	useEffect(() => {
		if (data) {
			const currentImage = form.getValues("image");
			if (currentImage !== "__uploaded_preview__") {
				form.reset(
					{
						email: data?.user?.email || "",
						password: form.getValues("password") || "",
						image: data?.user?.image || "",
						currentPassword: form.getValues("currentPassword") || "",
						allowImpersonation: data?.user?.allowImpersonation,
					},
					{
						keepValues: true,
					},
				);
			}
			form.setValue("allowImpersonation", data?.user?.allowImpersonation);

			if (data.user.email) {
				generateSHA256Hash(data.user.email).then((hash) => {
					setGravatarHash(hash);
				});
			}
		}
	}, [form, data]);

	const onSubmit = async (values: Profile) => {
		try {
			// Handle avatar upload or predefined avatar selection
			if (uploadFile) {
				const formData = new FormData();
				formData.append("file", uploadFile);
				await updateAvatarMutation.mutateAsync(formData);
			} else if (values.image && !values.image.startsWith("/api/user/avatar/") && values.image !== data?.user?.image) {
				const formData = new FormData();
				formData.append("predefinedAvatarId", values.image);
				await updateAvatarMutation.mutateAsync(formData);
			}

			// Update other profile fields
			const payload: Record<string, any> = {
				email: values.email.toLowerCase(),
				password: values.password || undefined,
				currentPassword: values.currentPassword || undefined,
				allowImpersonation: values.allowImpersonation,
			};
			if (values.image && !values.image.startsWith("/api/user/avatar/") && !uploadFile) {
				payload.image = values.image;
			}
			await mutateAsync(payload);

			await _utils.user.invalidate();
			await refetch();

			toast.success("Profile Updated");

			if (uploadPreview) URL.revokeObjectURL(uploadPreview);
			setUploadPreview(null);
			setUploadFile(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}

		} catch (e) {
			toast.error("Error updating the profile");
		}
	};

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar  p-2.5 rounded-xl  max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md ">
					<CardHeader className="flex flex-row gap-2 flex-wrap justify-between items-center">
						<div>
							<CardTitle className="text-xl flex flex-row gap-2">
								<User className="size-6 text-muted-foreground self-center" />
								{t("settings.profile.title")}
							</CardTitle>
							<CardDescription>
								{t("settings.profile.description")}
							</CardDescription>
						</div>
						{!data?.user.twoFactorEnabled ? <Enable2FA /> : <Disable2FA />}
					</CardHeader>

					<CardContent className="space-y-2 py-8 border-t">
						{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
						{isLoading ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[35vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (
							<>
								<Form {...form}>
									<form
										onSubmit={form.handleSubmit(onSubmit)}
										className="grid gap-4"
									>
										<div className="space-y-4">
											<FormField
												control={form.control}
												name="email"
												render={({ field }) => (
													<FormItem>
														<FormLabel>{t("settings.profile.email")}</FormLabel>
														<FormControl>
															<Input
																placeholder={t("settings.profile.email")}
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="currentPassword"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Current Password</FormLabel>
														<FormControl>
															<Input
																type="password"
																placeholder={t("settings.profile.password")}
																{...field}
																value={field.value || ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="password"
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t("settings.profile.password")}
														</FormLabel>
														<FormControl>
															<Input
																type="password"
																placeholder={t("settings.profile.password")}
																{...field}
																value={field.value || ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											<FormField
												control={form.control}
												name="image"
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t("settings.profile.avatar")}
														</FormLabel>
														<FormControl>
															<RadioGroup
																onValueChange={(newValue) => {
																	if (newValue !== "__uploaded_preview__") {
																		if (uploadPreview) URL.revokeObjectURL(uploadPreview);
																		setUploadPreview(null);
																		setUploadFile(null);
																		setUploadError(null);
																		if (fileInputRef.current) {
																			fileInputRef.current.value = "";
																		}
																	}
																	field.onChange(newValue);
																}}
																defaultValue={field.value}
																value={isUploadedAvatar ? "__uploaded_preview__" : field.value}
																className="flex flex-row flex-wrap gap-2 max-xl:justify-center"
															>
																{/* Upload tile */}
																<FormItem key="__upload__">
																	<FormLabel
																		className="[&:has([data-state=checked])>div]:ring-2 [&:has([data-state=checked])>div]:ring-primary"
																		onClick={(e) => e.preventDefault()}
																	>
																		<FormControl>
																			<RadioGroupItem
																				value="__uploaded_preview__"
																				className="sr-only"
																			/>
																		</FormControl>

																		<div
																			className="h-12 w-12 rounded-full border flex items-center justify-center overflow-hidden cursor-pointer"
																			onClick={(e) => {
																				e.preventDefault();
																				e.stopPropagation();
																				fileInputRef.current?.click();
																			}}
																		>
																			{uploadPreview ? (
																				<img
																					src={uploadPreview}
																					alt="uploaded preview"
																					className="h-12 w-12 object-cover"
																				/>
																			) : isUploadedAvatar && currentImage ? (
																				<img
																					src={currentImage}
																					alt="current uploaded avatar"
																					className="h-12 w-12 object-cover"
																				/>
																			) : (
																				<span className="text-xs text-muted-foreground">
																					Upload
																				</span>
																			)}
																		</div>
																	</FormLabel>
																</FormItem>

																{availableAvatars.map((image) => (
																	<FormItem key={image}>
																		<FormLabel className="[&:has([data-state=checked])>img]:border-primary [&:has([data-state=checked])>img]:border-1 [&:has([data-state=checked])>img]:p-px cursor-pointer">
																			<FormControl>
																				<RadioGroupItem
																					value={image}
																					className="sr-only"
																				/>
																			</FormControl>

																			<img
																				key={image}
																				src={image}
																				alt="avatar"
																				className="h-12 w-12 rounded-full border hover:p-px hover:border-primary transition-transform"
																			/>
																		</FormLabel>
																	</FormItem>
																))}
															</RadioGroup>
														</FormControl>
														{uploadError && (
															<p className="text-sm text-destructive mt-2">
																{uploadError}
															</p>
														)}
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Hidden file input for avatar upload */}
											<input
												ref={fileInputRef}
												type="file"
												accept="image/*"
												onChange={handleFileChange}
												className="hidden"
											/>
											{isCloud && (
												<FormField
													control={form.control}
													name="allowImpersonation"
													render={({ field }) => (
														<FormItem className="flex flex-row items-center justify-between p-3 mt-4 border rounded-lg shadow-sm">
															<div className="space-y-0.5">
																<FormLabel>Allow Impersonation</FormLabel>
																<FormDescription>
																	Enable this option to allow Dokploy Cloud
																	administrators to temporarily access your
																	account for troubleshooting and support
																	purposes. This helps them quickly identify and
																	resolve any issues you may encounter.
																</FormDescription>
															</div>
															<FormControl>
																<Switch
																	checked={field.value}
																	onCheckedChange={field.onChange}
																/>
															</FormControl>
														</FormItem>
													)}
												/>
											)}
										</div>

										<div className="flex items-center justify-end gap-2">
											<Button type="submit" isLoading={isUpdating}>
												{t("settings.common.save")}
											</Button>
										</div>
									</form>
								</Form>
							</>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
