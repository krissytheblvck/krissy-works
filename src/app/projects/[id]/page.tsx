import { getProject } from '@/app/actions/projects'
import { getResolvedPrices } from '@/app/actions/prices'
import { ProjectClient } from '@/components/projects/ProjectClient'
import { StaircaseClient } from '@/components/projects/StaircaseClient'
import type { ResolvedPrices } from '@/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const prices: ResolvedPrices = await getResolvedPrices()

  if (id === 'demo' || id === 'demo-new') {
    return <ProjectClient project={null} initialPrices={prices} />
  }

  let project: Awaited<ReturnType<typeof getProject>> | null = null
  try {
    project = await getProject(id)
  } catch {
    project = null
  }

  if (!project) {
    return <ProjectClient project={null} initialPrices={prices} />
  }

  if (project.type === 'staircase') {
    return <StaircaseClient project={project} initialPrices={prices} />
  }

  return <ProjectClient project={project} initialPrices={prices} />
}
