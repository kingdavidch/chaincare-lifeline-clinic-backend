export const countryToTimezone: Record<string, string> = {
  rwanda: "Africa/Kigali",
  nigeria: "Africa/Lagos",
  kenya: "Africa/Nairobi",
  ghana: "Africa/Accra",
  uganda: "Africa/Kampala",
  southafrica: "Africa/Johannesburg",
  tanzania: "Africa/Dar_es_Salaam",
  default: "UTC"
}

export const getTimezoneForCountry = (country?: string): string => {
  if (!country) return countryToTimezone.default
  return (
    countryToTimezone[country.toLowerCase().replace(/\s+/g, "")] ||
    countryToTimezone.default
  )
}
