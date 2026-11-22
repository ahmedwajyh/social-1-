import mongoose from "mongoose";

export interface IComment {
    user: mongoose.Types.ObjectId;
    text: string;
    createdAt?: Date;
    updatedAt?: Date;
    _id?: mongoose.Types.ObjectId;
}

export interface IPost {
    author: mongoose.Types.ObjectId;
    content: string;
    images: string[];
    likes: mongoose.Types.ObjectId[];
    comments: IComment[];
}

const commentSchema = new mongoose.Schema<IComment>({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        trim: true,
        minlength: 1,
        maxlength: 1000,
        required: true
    }
}, { timestamps: true });

const postSchema = new mongoose.Schema<IPost>({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    content: {
        type: String,
        trim: true,
        maxlength: 5000,
        default: ""
    },
    images: [{
        type: String,
        trim: true
    }],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    comments: [commentSchema]
}, { timestamps: true });

postSchema.index({ createdAt: -1 });

export const postModel =
    (mongoose.models.Post as mongoose.Model<IPost>) ||
    mongoose.model<IPost>("Post", postSchema);
