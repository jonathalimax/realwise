import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { attachments } from '../db/schema';

type Attachment = typeof attachments.$inferSelect;

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT')!;
    const port = Number(this.config.get<string>('MINIO_PORT') ?? '9000');
    const useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';
    this.bucket = this.config.get<string>('MINIO_BUCKET')!;

    this.s3 = new S3Client({
      endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY')!,
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY')!,
      },
      forcePathStyle: true,
    });
  }

  buildKey(clientId: string, userId: string, importId: string, fileName: string): string {
    return `${clientId}/${userId}/${importId}/${fileName}`;
  }

  async getPresignedUploadUrl(key: string, mimeType: string): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.s3, cmd, { expiresIn: 300 });
  }

  async getPresignedDownloadUrl(key: string): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, cmd, { expiresIn: 300 });
  }

  async recordAttachment(input: {
    clientId: string;
    userId: string;
    importId?: string;
    objectKey: string;
    mimeType?: string;
    sizeBytes?: number;
  }): Promise<Attachment> {
    const rows = await this.db
      .insert(attachments)
      .values(input)
      .returning();
    return rows[0];
  }

  async getDownloadUrl(attachmentId: string, clientId: string, userId: string): Promise<string> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.clientId, clientId), eq(attachments.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return this.getPresignedDownloadUrl(rows[0].objectKey);
  }
}
