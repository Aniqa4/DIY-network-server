import { PassThrough } from 'stream';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import env from '../config/env';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

// Streams a multer memory-storage file buffer to Cloudinary and resolves
// with the upload result (result.secure_url is the hosted image URL).
export function uploadImage(
  file: Express.Multer.File,
  folder: string,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error || !result) {
          return reject(
            error instanceof Error
              ? error
              : new Error(error?.message ?? 'Cloudinary upload failed'),
          );
        }
        resolve(result);
      },
    );
    const bufferStream = new PassThrough();
    bufferStream.end(file.buffer);
    bufferStream.pipe(uploadStream);
  });
}
