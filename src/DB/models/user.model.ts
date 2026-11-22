import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { GenderEnum, RoleEnum } from "../../common/utils/enum/user.enum.js";

export interface Iuser {
    fName: string;
    lName: string;
    age?: number | undefined;
    email: string;
    password?: string | undefined;
    googleId?: string | undefined;
    role: RoleEnum;
    gender: GenderEnum;
    phone?: string | undefined;
    bio?: string | undefined;
    profilePicture?: string | undefined;
    isPrivate?: boolean | undefined;
    followers?: mongoose.Types.ObjectId[] | undefined;
    following?: mongoose.Types.ObjectId[] | undefined;
    followRequests?: mongoose.Types.ObjectId[] | undefined;
    isEmailVerified: boolean;
    refreshToken?: string | null | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
}

const userSchema = new mongoose.Schema<Iuser>({
    fName: {
        type: String,
        minlength: 2,
        maxlength: 44,
        trim: true,
        required: true
    },
    lName: {
        type: String,
        minlength: 2,
        maxlength: 44,
        trim: true,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        trim: true
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    age: {
        type: Number,
        required: false
    },
    phone: {
        type: String,
        required: false
    },
    password: {
        type: String,
        required: false,
        select: false
    },
    refreshToken: {
        type: String,
        default: null,
        select: false
    },
    role: {
        type: String,
        enum: [RoleEnum.admin, RoleEnum.user],
        default: RoleEnum.user
    },
    gender: {
        type: String,
        enum: [GenderEnum.female, GenderEnum.male],
        default: GenderEnum.male
    },
    bio: {
        type: String,
        trim: true,
        maxlength: 160,
        default: ""
    },
    profilePicture: {
        type: String,
        trim: true,
        default: ""
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    followRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    isEmailVerified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    strict: true,
    strictQuery: true
});

userSchema.index({ fName: 1, lName: 1 });

userSchema.pre("save", async function () {
    if (!this.isModified("password") || !this.password) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 12);
});

export const userModel =
    (mongoose.models.User as mongoose.Model<Iuser>) ||
    mongoose.model<Iuser>("User", userSchema);
