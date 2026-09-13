import { S3Client, CreateBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:9000",
  credentials: {
    accessKeyId: "minio_admin",
    secretAccessKey: "minio_password",
  },
  forcePathStyle: true,
});

export const initializeStorage = async () => {
  const buckets = ["raw-videos", "public-videos"];
  
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
