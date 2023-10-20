export interface QualityModeration {
  guideline_id: string
  app_id: string
  updated_at: string
  updated_by: string
  passed: boolean
  comment: string
}

export interface QualityGuideline {
  id: string
  url: string
  read_only: boolean
}

export interface QualityCategory {
  id: string
  guidelines: QualityGuideline[]
}

export interface QualityModerationResponse {
  categories: QualityCategory[]
  marks: { [id: string]: QualityModeration }
}

export interface QualityModerationStatus {
  passes: boolean
  unrated: number
  passed: number
  "not-passed": number
}

export interface QualityModerationDashboardRow {
  id: string
  name: string
  "quality-moderation-status": QualityModerationStatus
}

export interface QualityModerationDashboardResponse {
  apps: QualityModerationDashboardRow[]
}
