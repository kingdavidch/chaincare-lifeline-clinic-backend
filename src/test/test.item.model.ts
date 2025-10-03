import { Schema, model, Types } from "mongoose"

export interface ITestItem {
  clinic: Types.ObjectId
  name: string
  image: string
  icon: string
}

const testItemSchema = new Schema<ITestItem>(
  {
    clinic: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    image: {
      type: String
    },
    icon: {
      type: String
    }
  },
  {
    timestamps: true
  }
)

testItemSchema.index({ clinic: 1, name: 1 }, { unique: true })

export default model<ITestItem>("TestItem", testItemSchema)
