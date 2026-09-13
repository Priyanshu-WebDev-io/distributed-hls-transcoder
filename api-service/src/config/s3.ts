import { S3Client, CreateBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";

export const S3_ENDPOINT = process.env.S3_ENDPOINT || "http://localhost:9000";
export const AWS_REGION = process.env.AWS_REGION || "us-east-1";
export const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "minio_admin";
export const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "minio_password";
export const RAW_BUCKET = process.env.RAW_BUCKET || "raw-videos";
export const PUBLIC_BUCKET = process.env.PUBLIC_BUCKET || "public-videos";

export const s3Client = new S3Client({
  region: AWS_REGION,
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export const initializeStorage = async () => {
  const buckets = [RAW_BUCKET, PUBLIC_BUCKET];

  for (const bucket of buckets) {
    try {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`Bucket created: ${bucket}`);
      } catch (err: any) {
        if (err.name === "BucketAlreadyExists" || err.name === "BucketAlreadyOwnedByYou") {
          console.log(`Bucket already exists: ${bucket}`);
        } else {
          throw err;
        }
      }

      if (bucket === "public-videos") {
        const policy = {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        };
        await s3Client.send(
          new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify(policy),
          })
        );
        console.log(`Public read policy applied to ${bucket}`);
      }
    } catch (err: any) {
      console.error(`Error initializing bucket ${bucket}:`, err);
    }
  }
};
