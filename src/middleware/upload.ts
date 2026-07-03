import multer from 'multer';

// Images are held in memory and streamed straight to Cloudinary — nothing
// is ever written to local disk.
const IMAGE_TYPES = /(jpg|jpeg|png|webp)$/i;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB, same as the NestJS server

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});

// POST /posts — up to 5 images under the "images" field.
export const postImages = upload.array('images', 5);
// POST /users/me/avatar — a single "avatar" field.
export const avatar = upload.single('avatar');
