import multer from "multer"
import path from "path"
import { Request } from "express"

const allowedFileTypes: Record<string, { types: RegExp; maxSize: number }> = {
  image: { types: /jpeg|jpg|png|gif/, maxSize: 5 * 1024 * 1024 }, // 5MB for images
  avatar: { types: /jpeg|jpg|png|gif/, maxSize: 5 * 1024 * 1024 }, // Adding avatar as an alias for image
  testResult: { types: /pdf/, maxSize: 10 * 1024 * 1024 }, // 10MB limit for test result PDFs
  certificate: {
    types: /pdf|jpeg|jpg|png|gif/,
    maxSize: 5 * 1024 * 1024 // 5MB limit
  }
}

const createFileFilter =
  (allowedTypes: RegExp) =>
  (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ): void => {
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    )
    const mimeType = allowedTypes.test(file.mimetype)

    if (extname && mimeType) {
      cb(null, true)
    } else {
      cb(
        new Error(
          `Unsupported file type. Allowed types: ${allowedTypes.toString()}`
        )
      )
    }
  }

const createMulterUpload = (fileType: keyof typeof allowedFileTypes) => {
  if (!allowedFileTypes[fileType]) {
    throw new Error(`Invalid file type: ${fileType}`)
  }

  const { types, maxSize } = allowedFileTypes[fileType]

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: createFileFilter(types)
  })
}

export const avatarUpload = createMulterUpload("avatar")
export const testResultUpload = createMulterUpload("testResult")
export const certificateUpload = createMulterUpload("certificate")
