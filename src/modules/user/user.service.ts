import mongoose from "mongoose";
import { type Iuser, userModel } from "../../DB/models/user.model.js";
import {
    BadRequestException,
    NotFoundException
} from "../../common/exception/index.js";

const safeUserProjection = "-password -refreshToken -googleId -followRequests -__v";

class UserService {
    getMyProfile = async (userId: string) => {
        const user = await userModel.findById(userId).select(safeUserProjection);
        if (!user) throw new NotFoundException("User not found");
        return user;
    };

    getUserProfile = async (viewerId: string, targetId: string) => {
        const target = await userModel.findById(targetId)
            .select("fName lName bio profilePicture isPrivate followers following createdAt");
        if (!target) throw new NotFoundException("User not found");

        const isOwnProfile = viewerId === targetId;
        const isFollowing = target.followers?.some((id) => id.toString() === viewerId) ?? false;

        return {
            _id: target._id,
            fName: target.fName,
            lName: target.lName,
            bio: target.isPrivate && !isOwnProfile && !isFollowing ? "" : target.bio,
            profilePicture: target.profilePicture,
            isPrivate: target.isPrivate,
            createdAt: target.createdAt,
            followersCount: target.followers?.length ?? 0,
            followingCount: target.following?.length ?? 0,
            isFollowing: isOwnProfile ? false : isFollowing,
            ...(target.isPrivate && !isOwnProfile && !isFollowing ? { contentHidden: true } : {})
        };
    };

    updateProfile = async (
        userId: string,
        body: Partial<Pick<Iuser, "fName" | "lName" | "age" | "gender" | "phone" | "bio" | "profilePicture">>
    ) => {
        const user = await userModel.findByIdAndUpdate(
            userId,
            { $set: body },
            { new: true, runValidators: true }
        ).select(safeUserProjection);

        if (!user) throw new NotFoundException("User not found");
        return user;
    };

    updatePrivacy = async (userId: string, isPrivate: boolean) => {
        const user = await userModel.findByIdAndUpdate(
            userId,
            { $set: { isPrivate } },
            { new: true, runValidators: true }
        ).select(safeUserProjection);

        if (!user) throw new NotFoundException("User not found");
        return { isPrivate: user.isPrivate };
    };

    searchUsers = async (viewerId: string, query: string, page = 1, limit = 20) => {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");
        const filter = {
            _id: { $ne: new mongoose.Types.ObjectId(viewerId) },
            isEmailVerified: true,
            $or: [{ fName: regex }, { lName: regex }, { email: regex }]
        };

        const [users, total] = await Promise.all([
            userModel.find(filter)
                .select("fName lName profilePicture isPrivate")
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            userModel.countDocuments(filter)
        ]);

        return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    };

    suggestions = async (userId: string, limit = 10) => {
        const currentUser = await userModel.findById(userId).select("following");
        if (!currentUser) throw new NotFoundException("User not found");

        const excludedIds = [
            new mongoose.Types.ObjectId(userId),
            ...(currentUser.following ?? [])
        ];

        return userModel.find({ isEmailVerified: true, _id: { $nin: excludedIds } })
            .select("fName lName profilePicture isPrivate")
            .limit(limit)
            .lean();
    };

    follow = async (userId: string, targetId: string) => {
        if (userId === targetId) throw new BadRequestException("You cannot follow yourself");

        const [currentUser, targetUser] = await Promise.all([
            userModel.findById(userId).select("following"),
            userModel.findById(targetId).select("isPrivate isEmailVerified followers followRequests")
        ]);

        if (!currentUser) throw new NotFoundException("User not found");
        if (!targetUser || !targetUser.isEmailVerified) throw new NotFoundException("Target user not found");

        const alreadyFollowing = currentUser.following?.some((id) => id.toString() === targetId);
        if (alreadyFollowing) return { status: "following" };

        if (targetUser.isPrivate) {
            const requestExists = targetUser.followRequests?.some((id) => id.toString() === userId);
            if (requestExists) return { status: "request-pending" };

            await userModel.updateOne(
                { _id: targetId },
                { $addToSet: { followRequests: new mongoose.Types.ObjectId(userId) } }
            );
            return { status: "request-sent" };
        }

        await Promise.all([
            userModel.updateOne(
                { _id: userId },
                { $addToSet: { following: new mongoose.Types.ObjectId(targetId) } }
            ),
            userModel.updateOne(
                { _id: targetId },
                {
                    $addToSet: { followers: new mongoose.Types.ObjectId(userId) },
                    $pull: { followRequests: new mongoose.Types.ObjectId(userId) }
                }
            )
        ]);

        return { status: "following" };
    };

    unfollow = async (userId: string, targetId: string) => {
        if (userId === targetId) throw new BadRequestException("You cannot unfollow yourself");

        const [currentExists, targetExists] = await Promise.all([
            userModel.exists({ _id: userId }),
            userModel.exists({ _id: targetId })
        ]);
        if (!currentExists) throw new NotFoundException("User not found");
        if (!targetExists) throw new NotFoundException("Target user not found");

        await Promise.all([
            userModel.updateOne(
                { _id: userId },
                {
                    $pull: {
                        following: new mongoose.Types.ObjectId(targetId),
                        followRequests: new mongoose.Types.ObjectId(targetId)
                    }
                }
            ),
            userModel.updateOne(
                { _id: targetId },
                {
                    $pull: {
                        followers: new mongoose.Types.ObjectId(userId),
                        followRequests: new mongoose.Types.ObjectId(userId)
                    }
                }
            )
        ]);

        return { message: "Unfollowed successfully" };
    };

    getFollowRequests = async (userId: string) => {
        const user = await userModel.findById(userId)
            .select("followRequests")
            .populate("followRequests", "fName lName profilePicture");
        if (!user) throw new NotFoundException("User not found");
        return user.followRequests ?? [];
    };

    acceptFollowRequest = async (userId: string, requesterId: string) => {
        if (userId === requesterId) throw new BadRequestException("Invalid follow request");

        const [user, requester] = await Promise.all([
            userModel.findById(userId).select("followRequests"),
            userModel.findById(requesterId).select("_id")
        ]);
        if (!user || !requester) throw new NotFoundException("User or requester not found");

        const exists = user.followRequests?.some((id) => id.toString() === requesterId);
        if (!exists) throw new NotFoundException("Follow request not found");

        await Promise.all([
            userModel.updateOne(
                { _id: userId },
                {
                    $pull: { followRequests: new mongoose.Types.ObjectId(requesterId) },
                    $addToSet: { followers: new mongoose.Types.ObjectId(requesterId) }
                }
            ),
            userModel.updateOne(
                { _id: requesterId },
                { $addToSet: { following: new mongoose.Types.ObjectId(userId) } }
            )
        ]);

        return { message: "Follow request accepted" };
    };

    rejectFollowRequest = async (userId: string, requesterId: string) => {
        const result = await userModel.updateOne(
            { _id: userId, followRequests: new mongoose.Types.ObjectId(requesterId) },
            { $pull: { followRequests: new mongoose.Types.ObjectId(requesterId) } }
        );

        if (result.matchedCount === 0) {
            throw new NotFoundException("Follow request not found");
        }
        return { message: "Follow request rejected" };
    };
}

export default new UserService();
