import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import {
    Upload
  } from "@aws-sdk/lib-storage";

import fs from "fs";

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET_NAME,
} = process.env;

if (
  !AWS_ACCESS_KEY_ID ||
  !AWS_SECRET_ACCESS_KEY ||
  !AWS_REGION ||
  !AWS_S3_BUCKET_NAME
) {
  throw new Error("Missing AWS configuration");
}

// Create an S3 client
const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    requestHandler:{
      connectionTimeout: 3600000, // 1 hour
      socketTimeout: 3600000,     // 1 hour
    },
  });
  
  // Uploading file with multipart upload and progress tracking
  export async function uploadFileS3(localFilePath, s3Key, onProgress) {
    try {
      if (!localFilePath) {
        throw new Error("Local path is not provided");
      }
  
      const fileStream = fs.createReadStream(localFilePath);
      const fileSize = fs.statSync(localFilePath).size;
      let uploadedSize = 0;
  
      // Monitor file stream progress
      fileStream.on("data", (chunk) => {
        uploadedSize += chunk.length;
        const progress = Math.round((uploadedSize / fileSize) * 100);
  
        // Call the progress callback to send progress back to the client
        if (onProgress) {
          onProgress(progress);
        }
      });
  
      // Set up multipart upload parameters
      const upload = new Upload({
        client: s3,
        params: {
          Bucket: AWS_S3_BUCKET_NAME,
          Key: s3Key,
          Body: fileStream,
          ACL: "private", // File permissions
        },
        partSize: 10 * 1024 * 1024, // Part size: 10 MB (adjust according to your file size)
        leavePartsOnError: false,   // Ensure failed uploads are cleaned up
      });
  
      // Execute the upload with progress
      upload.on("httpUploadProgress", (progress) => {
        const progressPercentage = Math.round((progress.loaded / fileSize) * 100);
        if (onProgress) {
          onProgress(progressPercentage);
        }
      });
  
      const result = await upload.done();
  
      // On success, delete the local file
      fs.unlinkSync(localFilePath);
      console.log(`File successfully uploaded to S3: ${s3Key}`);
  
      return result;
    } catch (error) {
      // Handle errors and ensure the local file is removed if necessary
      console.error("Error during file upload:", error);
  
      // Only delete the file if it exists and the upload fails
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log(`Local file deleted after failure: ${localFilePath}`);
      }
  
      throw error;
    }
  }

// geting file

export async function getFile(objKey) {
  try {
    if (!objKey) {
      return null;
    }

    const params = {
      Bucket: AWS_S3_BUCKET_NAME,
      Key: objKey,
    };

    const command = new GetObjectCommand(params);
    const response = await s3.send(command);

    return response.Body;
  } catch (error) {
    return null;
  }
}

// delting file with objKey

export async function deleteS3File(objKey) {
  try {
    if (!objKey) {
      return null;
    }

    const params = {
      Bucket: AWS_S3_BUCKET_NAME, // Replace with your S3 bucket name
      Key: objKey,
    };

    const command = new DeleteObjectCommand(params);
    const response = await s3.send(command);

    return response;
  } catch (error) {
    return null;
  }
}
