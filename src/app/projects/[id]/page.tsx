import { getProject } from '@/app/actions/projects'
import { ProjectClient } from '@/components/projects/ProjectClient'
import { StaircaseClient } from '@/components/projects/StaircaseClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params

  if (id === 'demo' || id === 'demo-new') {
    return <ProjectClient project={null} />
  }

  let project: Awaited<ReturnType<typeof getProject>> | null = null
  try {
    project = await getProject(id)
  } catch {
    project = null
  }

  if (!project) {
    return <ProjectClient project={null} />
  }

  if (project.type === 'staircase') {
    return <StaircaseClient project={project} />
  }

  return <ProjectClient project={project} />
}
