export interface QualityModeration {
  guideline_id: number
  app_id: string
  updated_at: Date
  updated_by: Date
  passed: boolean
  comment: string
  guideline: Guideline
}

export interface Guideline {
  category: string
  translation_key: string
  id: number
  url: string
  read_only: boolean
}
