export interface ISubscriptionPlan {
  id: number
  name: string
  price: number
  duration: string
  description: string
  includedTests: string[]
  privilege?: number
}

export const SUBSCRIPTION_PLANS = [
  {
    id: 1,
    name: "Standard",
    price: 4100, // RWF
    duration: "1 Month",
    description:
      "Access 5 essential clinical tests every month from our partner clinics. Results available within 24 hours.",
    includedTests: [
      "Malaria Test",
      "Typhoid Test",
      "Complete Blood Count",
      "Urinalysis",
      "Blood Glucose"
    ]
  },
  {
    id: 2,
    name: "Premium",
    price: 6800, // RWF
    duration: "1 Month (extendable to 2 if unused tests remain)",
    description:
      "Access all 10 covered tests, including advanced diagnostics. Results available within 24 hours from partner clinics.",
    includedTests: [
      "Malaria Test",
      "Typhoid Test",
      "Complete Blood Count",
      "Urinalysis",
      "Blood Glucose",
      "HIV Test",
      "Hepatitis B Test",
      "Stool Microscopy",
      "Erythrocyte Sedimentation Rate",
      "Blood Pressure Check"
    ],
    privilege: 68000
  }
]
