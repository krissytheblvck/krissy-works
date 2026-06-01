import type { ProjectType } from '@/types'
import { PROJECT_TYPE_LABELS } from '@/types'

export function getDefaultScopeText(projectType: ProjectType): string {
  switch (projectType) {
    case 'staircase':
      return 'Supply, fabricate and install staircase railing and handrail as per agreed design'
    case 'balcony':
      return 'Supply, fabricate and install balcony railing as per agreed design'
    default:
      return `Supply, fabricate and install ${PROJECT_TYPE_LABELS[projectType].toLowerCase()} as per agreed design`
  }
}

export function getAreaLineLabel(projectType: ProjectType, areaName: string): string {
  const typeLabel = PROJECT_TYPE_LABELS[projectType] ?? 'Work'
  return `${typeLabel} — ${areaName}`
}
