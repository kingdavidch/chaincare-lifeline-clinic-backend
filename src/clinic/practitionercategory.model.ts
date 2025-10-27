import mongoose, { Schema, Document } from "mongoose"

export interface PractitionerCategoryDocument extends Document {
  name: string
  type: string // doctor | therapist | clinic | nurse | hospital
  description?: string
  createdAt: Date
  updatedAt: Date
}

const practitionerCategorySchema = new Schema<PractitionerCategoryDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: ["doctor", "therapist", "clinic", "nurse", "hospital"],
      lowercase: true,
      trim: true
    },
    description: {
      type: String
    }
  },
  { timestamps: true }
)

const practitionerCategoryModel = mongoose.model<PractitionerCategoryDocument>(
  "practitionercategory",
  practitionerCategorySchema
)

export default practitionerCategoryModel
