import { z } from "zod";
import { generalRules } from "../../common/utils/generelRules.js";

export const userIdSchema = {
    params: z.object({
        userId: generalRules.id
    })
};

export const updateProfileSchema = {
    body: z.object({
        fName: generalRules.fName.optional(),
        lName: generalRules.lName.optional(),
        age: generalRules.age.optional(),
        gender: generalRules.gender.optional(),
        phone: generalRules.phone.optional(),
        bio: z.string().trim().max(160, "Bio cannot exceed 160 characters.").optional(),
        profilePicture: z.string().url("Profile picture must be a valid URL.").optional()
    }).refine((value) => Object.values(value).some((item) => item !== undefined), {
        message: "Provide at least one profile field to update."
    })
};

export const privacySchema = {
    body: z.object({
        isPrivate: z.boolean()
    })
};

export const searchUsersSchema = {
    query: z.object({
        q: z.string().trim().min(1).max(80),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional()
    })
};

export const requesterIdSchema = {
    params: z.object({
        requesterId: generalRules.id
    })
};
