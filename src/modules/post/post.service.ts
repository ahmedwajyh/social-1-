import mongoose from "mongoose";
import { postModel } from "../../DB/models/post.model.js";
import { userModel } from "../../DB/models/user.model.js";
import {
    BadRequestException,
    ForbiddenException,
    NotFoundException
} from "../../common/exception/index.js";

class PostService {
    createPost = async (
        userId: string,
        body: { content?: string | undefined; images?: string[] | undefined }
    ) => {
        const content = body.content?.trim() ?? "";
        const images = body.images ?? [];
        if (!content && images.length === 0) {
            throw new BadRequestException("A post must contain text or at least one image");
        }

        const post = await postModel.create({
            author: new mongoose.Types.ObjectId(userId),
            content,
            images,
            likes: [],
            comments: []
        });

        return this.getPost(userId, post._id.toString());
    };

    getFeed = async (userId: string, page = 1, limit = 20) => {
        const currentUser = await userModel.findById(userId).select("following");
        if (!currentUser) throw new NotFoundException("User not found");

        const authorIds = [
            new mongoose.Types.ObjectId(userId),
            ...(currentUser.following ?? [])
        ];

        const [posts, total] = await Promise.all([
            postModel.find({ author: { $in: authorIds } })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("author", "fName lName profilePicture isPrivate")
                .populate("comments.user", "fName lName profilePicture"),
            postModel.countDocuments({ author: { $in: authorIds } })
        ]);

        return {
            posts,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        };
    };

    getPost = async (viewerId: string, postId: string) => {
        const post = await postModel.findById(postId)
            .populate("author", "fName lName profilePicture isPrivate followers")
            .populate("comments.user", "fName lName profilePicture");

        if (!post) throw new NotFoundException("Post not found");

        const author = post.author as unknown as {
            _id: mongoose.Types.ObjectId;
            fName: string;
            lName: string;
            profilePicture?: string;
            isPrivate?: boolean;
            followers?: mongoose.Types.ObjectId[];
        };
        if (!author?._id) throw new NotFoundException("Post author not found");

        const isOwner = author._id.toString() === viewerId;
        const isFollower = author.followers?.some((id) => id.toString() === viewerId) ?? false;
        if (author.isPrivate && !isOwner && !isFollower) {
            throw new ForbiddenException("This post belongs to a private account");
        }

        const result = post.toObject();
        return {
            ...result,
            author: {
                _id: author._id,
                fName: author.fName,
                lName: author.lName,
                profilePicture: author.profilePicture
            }
        };
    };

    updatePost = async (
        userId: string,
        postId: string,
        body: { content?: string | undefined; images?: string[] | undefined }
    ) => {
        const post = await postModel.findById(postId);
        if (!post) throw new NotFoundException("Post not found");
        if (post.author.toString() !== userId) {
            throw new ForbiddenException("You can only update your own posts");
        }

        if (body.content !== undefined) post.content = body.content.trim();
        if (body.images !== undefined) post.images = body.images;
        if (!post.content && post.images.length === 0) {
            throw new BadRequestException("A post must contain text or at least one image");
        }

        await post.save();
        return this.getPost(userId, postId);
    };

    deletePost = async (userId: string, postId: string) => {
        const post = await postModel.findById(postId);
        if (!post) throw new NotFoundException("Post not found");
        if (post.author.toString() !== userId) {
            throw new ForbiddenException("You can only delete your own posts");
        }

        await postModel.deleteOne({ _id: postId });
        return { message: "Post deleted successfully" };
    };

    likePost = async (userId: string, postId: string) => {
        await this.getPost(userId, postId);

        await postModel.updateOne(
            { _id: postId },
            { $addToSet: { likes: new mongoose.Types.ObjectId(userId) } }
        );
        return { message: "Post liked successfully" };
    };

    unlikePost = async (userId: string, postId: string) => {
        await this.getPost(userId, postId);
        const result = await postModel.updateOne(
            { _id: postId },
            { $pull: { likes: new mongoose.Types.ObjectId(userId) } }
        );
        if (result.matchedCount === 0) throw new NotFoundException("Post not found");
        return { message: "Post unliked successfully" };
    };

    addComment = async (userId: string, postId: string, text: string) => {
        await this.getPost(userId, postId);
        const post = await postModel.findById(postId);
        if (!post) throw new NotFoundException("Post not found");

        post.comments.push({
            user: new mongoose.Types.ObjectId(userId),
            text: text.trim()
        });
        await post.save();
        return this.getPost(userId, postId);
    };

    deleteComment = async (userId: string, postId: string, commentId: string) => {
        await this.getPost(userId, postId);
        const post = await postModel.findById(postId);
        if (!post) throw new NotFoundException("Post not found");

        const commentIndex = post.comments.findIndex(
            (comment) => (comment as unknown as { _id: mongoose.Types.ObjectId })._id.toString() === commentId
        );
        if (commentIndex === -1) throw new NotFoundException("Comment not found");

        const comment = post.comments[commentIndex];
        if (!comment || comment.user.toString() !== userId) {
            throw new ForbiddenException("You can only delete your own comments");
        }

        post.comments.splice(commentIndex, 1);
        await post.save();
        return this.getPost(userId, postId);
    };
}

export default new PostService();
