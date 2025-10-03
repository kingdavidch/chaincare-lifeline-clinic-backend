import mongoose from "mongoose"
import "dotenv/config"

export default class Database {
  private static connectionString: string = process.env.MONGO_URL || ""

  public static async connect(): Promise<void> {
    try {
      await mongoose.connect(this.connectionString)
      console.log("DB Connected")
    } catch (error) {
      console.error(
        "Database connection error.- Couldn't connect because ",
        error
      )
    }
  }
}
