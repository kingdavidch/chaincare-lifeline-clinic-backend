import adminModel from "./admin.model"
import adminNotificationModel, {
  IAdminNotification
} from "./admin.notification.model"

export async function notifyAdmin(
  title: string,
  message: string,
  type: IAdminNotification["type"] = "info"
) {
  const admin = await adminModel.findOne()
  if (admin) {
    await adminNotificationModel.create({
      admin: admin._id,
      title,
      message,
      type,
      isRead: false
    })
  }
}
