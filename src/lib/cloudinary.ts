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

// Deletes an image from Cloudinary given its secure_url. Best-effort — a
// failure here (e.g. already gone) shouldn't break the request. The public_id
// is the path after /upload/[vNNN/] minus the extension, e.g.
// https://res.cloudinary.com/x/image/upload/v1/posts/abc.jpg -> posts/abc
export async function destroyImage(secureUrl: string): Promise<void> {
  const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  if (!match) return;
  try {
    // invalidate: true also purges the CDN edge cache, so browsers stop
    // serving the old image after it's removed.
    await cloudinary.uploader.destroy(match[1], { invalidate: true });
  } catch (error) {
    console.error('Failed to delete Cloudinary image:', match[1], error);
  }
}
