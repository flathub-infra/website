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
  category_id: number
  translation_key: string
  id: number
  url: string
  category: Category
  read_only: boolean
}

export interface Category {
  translation_key: string
  id: number
}
