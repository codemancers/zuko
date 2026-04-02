import { Injectable } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { BaseService } from "../../common/base/base.service";

@Injectable()
export class AwsService extends BaseService {
  constructor() {
    super("AwsService");
  }

  private s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });

  async uploadToS3(bucketName: string, key: string, body: any): Promise<any> {
    const contentType = key.endsWith(".mp4")
      ? "video/mp4"
      : key.endsWith(".txt")
      ? "text/plain"
      : "application/octet-stream";

    const response = await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );

    return response;
  }
}
