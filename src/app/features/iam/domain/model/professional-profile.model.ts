/** Professional details exposed by the IAM backend. */
export interface ProfessionalProfile {
  readonly specialty: string;
  readonly licenseNumber: string;
  readonly yearsOfExperience: number;
}

/** Input accepted by PUT /api/v1/profiles/me. */
export type CompleteProfessionalProfile = ProfessionalProfile;
