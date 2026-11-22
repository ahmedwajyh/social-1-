import { z } from "zod";
import { generalRules } from "../../common/utils/generelRules.js";

const mediaFields = {
    content: z.string().trim().max(5000).optional(),
    images: z.array(z.string().url("Each image must be a valid URL.")).max(10).optional()
};

export const createPostSchema = {
    body: z.object(mediaFields).refine(
        (value) => Boolean(value.content?.length) || Boolean(value.images?.length),
        { message: "A post must contain text or at least one image." }
    )
};

export const updatePostSchema = {
    body: z.object(mediaFields).refine(
        (value) => value.content !== undefined || value.images !== undefined,
        { message: "Provide content or images to update." }
    )
};

export const postIdSchema = {
    params: z.object({ postId: generalRules.id })
};

export const commentSchema = {
    body: z.object({
        text: z.string().trim().min(1).max(1000)
    })
};

export const commentIdSchema = {
    params: z.object({
        postId: generalRules.id,
        commentId: generalRules.id
    })
};

export const feedQuerySchema = {
    query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional()
    })
};
