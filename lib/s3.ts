import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let s3: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured')
    }
    s3 = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-south-1',
      credentials: { accessKeyId, secretAccessKey },
    })
  }
  return s3
}

const BUCKET = process.env.AWS_S3_BUCKET ?? 'nexushire-resumes'

export async function uploadResume(
  buffer: Buffer,
  key: string,
  contentType = 'application/pdf'
): Promise<string> {
  await getS3Client().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  return key
}

export async function getResumeSignedUrl(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(getS3Client(), cmd, { expiresIn: 3600 })
}

// Generic image upload used for profile photos (stored as object keys in DB).
export async function uploadImage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await getS3Client().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  return key
}

export async function getImageSignedUrl(
  key: string,
  // AWS S3 v4 presigned URLs have restrictions; keep under 1 week.
  expiresInSeconds = 60 * 60 * 24 * 6 // 6 days
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(getS3Client(), cmd, { expiresIn: expiresInSeconds })
}
