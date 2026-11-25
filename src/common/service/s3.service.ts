import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
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

    // Generate File Key
    private generateKey(folder: string, originalName: string): string {
        const fileName = path.basename(originalName).replace(/\s+/g, "-");

        return `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${fileName}`;
    }

    // Get File Body
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

    // Create Pre-Signed URL for Upload
    async createPreSignedUrl({
        path: folder,
        ContentType,
        fileName,
    }: {
        path: string;
        ContentType: string;
        fileName: string;
    }): Promise<{ url: string; Key: string }> {
        const Key = `social_media_app/${folder}/${randomUUID()}_${path.basename(fileName)}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key,
            ContentType,
        });

        const url = await getSignedUrl(this.s3, command, {
            expiresIn: 3600,
        });

        return {
            url,
            Key,
        };
    }

    // Get Files From Folder
    async getFiles({
        path: folder,
        maxKeys = 1000,
        continuationToken,
    }: {
        path: string;
        maxKeys?: number;
        continuationToken?: string;
    }) {
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: `${folder.replace(/\/+$/, "")}/`,
            MaxKeys: maxKeys,
            ContinuationToken: continuationToken,
        });

        const result = await this.s3.send(command);

        return {
            files: (result.Contents ?? []).map((file) => ({
                key: file.Key,
                size: file.Size,
                lastModified: file.LastModified,
                etag: file.ETag,
            })),
            nextToken: result.NextContinuationToken,
            isTruncated: result.IsTruncated,
        };
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
        if (!keys.length) {
            return;
        }

        // S3 DeleteObjects supports up to 1000 keys per request
        for (let i = 0; i < keys.length; i += 1000) {
            const chunk = keys.slice(i, i + 1000);

            await this.s3.send(
                new DeleteObjectsCommand({
                    Bucket: this.bucketName,
                    Delete: {
                        Objects: chunk.map((key) => ({
                            Key: key,
                        })),
                        Quiet: false,
                    },
                })
            );
        }
    }

    // Delete Folder
    async deleteFolder(folder: string): Promise<void> {
        const prefix = `${folder.replace(/\/+$/, "")}/`;

        let continuationToken: string | undefined;

        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            });

            const result = await this.s3.send(listCommand);

            const keys = (result.Contents ?? [])
                .map((file) => file.Key)
                .filter((key): key is string => Boolean(key));

            if (keys.length) {
                await this.deleteFiles(keys);
            }

            continuationToken = result.NextContinuationToken;
        } while (continuationToken);
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

    // Destroy S3 Client
    destroy(): void {
        this.s3.destroy();
    }
}