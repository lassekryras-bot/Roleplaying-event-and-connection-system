import type { ProjectGraphResponse } from '@/lib/api';

import type { ProjectBoardData } from './types';

export function toProjectBoardData(response: ProjectGraphResponse): ProjectBoardData {
  return {
    project: {
      ...response.project,
      status: response.project.status === 'paused' ? 'paused' : 'active',
    },
    now: response.now as ProjectBoardData['now'],
    threads: response.threads,
    patterns: response.patterns,
    linkedEntities: response.linkedEntities,
    playerProfiles: response.playerProfiles,
    manualLinks: response.manualLinks,
    sharing: response.sharing,
    revision: response.revision,
    history: response.history,
  };
}
