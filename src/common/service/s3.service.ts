import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";

import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";
import path from "path";
import { StoreEnum } from "./store.enum.js";

export class S3Service {
    private readonly s3: S3Client;
    private readonly bucketName: string;

    constructor() {
        this.bucketName = process.env.AWS_S3_BUCKET_NAME ?? "";

        this.s3 = new S3Client({
            region: process.env.AWS_REGION ?? "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
            },
        });
    }

    private generateKey(folder: string, originalName: string): string {
        const fileName = path.basename(originalName).replace(/\s+/g, "-");

        return `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${fileName}`;
    }

    private getBody(file: Express.Multer.File, store_type: StoreEnum) {
        if (store_type === StoreEnum.disk) {
            if (!file.path) {
                throw new Error("File path is missing");
            }

            return fs.createReadStream(file.path);
        }

        return file.buffer;
    }

    // Upload Single File
    async uploadFile({
        path: folder = "General",
        file,
        store_type = StoreEnum.memory,
    }: {
        path?: string;
        file: Express.Multer.File;
        store_type?: StoreEnum;
    }): Promise<string> {
        const key = this.generateKey(folder, file.originalname);

        await this.s3.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: this.getBody(file, store_type),
                ContentType: file.mimetype,
            })
        );

        return key;
    }

    // Upload Large File
    async uploadLargeFile({
        path: folder = "General",
        file,
        store_type = StoreEnum.memory,
    }: {
        path?: string;
        file: Express.Multer.File;
        store_type?: StoreEnum;
    }): Promise<string> {
        const key = this.generateKey(folder, file.originalname);

        try {
            const parallelUpload = new Upload({
                client: this.s3,
                params: {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: this.getBody(file, store_type),
                    ContentType: file.mimetype,
                },
                queueSize: 4,
                partSize: 5 * 1024 * 1024,
                leavePartsOnError: false,
            });

            await parallelUpload.done();

            return key;
        } finally {
            if (store_type === StoreEnum.disk && file.path) {
                await fs.promises.unlink(file.path).catch(() => undefined);
            }
        }
    }

    // Upload Multiple Files
    async uploadFiles({
        path: folder = "General",
        files,
        store_type = StoreEnum.memory,
        isLarge = false,
    }: {
        path?: string;
        files: Express.Multer.File[];
        store_type?: StoreEnum;
        isLarge?: boolean;
    }): Promise<string[]> {
        return Promise.all(
            files.map((file) =>
                isLarge
                    ? this.uploadLargeFile({
                          file,
                          path: folder,
                          store_type,
                      })
                    : this.uploadFile({
                          file,
                          path: folder,
                          store_type,
                      })
            )
        );
    }

    // Delete Single File
    async deleteFile(key: string): Promise<void> {
        await this.s3.send(
            new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            })
        );
    }

    // Delete Multiple Files
    async deleteFiles(keys: string[]): Promise<void> {
        await Promise.all(keys.map((key) => this.deleteFile(key)));
    }

    // Get Download URL
    async downloadFile(
        key: string,
        expiresIn: number = 3600
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ResponseContentDisposition: "attachment",
        });

        return getSignedUrl(this.s3, command, {
            expiresIn,
        });
    }

    // Get Signed URL
    async getSignedUrl(
        key: string,
        expiresIn: number = 3600
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        return getSignedUrl(this.s3, command, {
            expiresIn,
        });
    }

    destroy(): void {
        this.s3.destroy();
    }
}