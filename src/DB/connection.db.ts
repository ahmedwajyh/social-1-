import mongoose from "mongoose";
import { DB_URI } from "../config/config.service.js";

export const connectionDB = async (): Promise<void> => {
    if (!DB_URI) {
        throw new Error("DB_URI is not configured.");
    }

    await mongoose.connect(DB_URI);
    console.log("Database connected successfully.");
};
