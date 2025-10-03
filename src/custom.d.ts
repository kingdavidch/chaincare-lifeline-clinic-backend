import { IPatientPayload } from "./patient/patient.types"
import { IClinicPayload } from "./clinic/clinic.types"
import { IAdminPayload } from "./admin/admin.types"

declare global {
  namespace Express {
    interface Request {
      clinic?: IClinicPayload
      patient?: IPatientPayload
      admin?: IAdminPayload
    }
  }
}

export {}
