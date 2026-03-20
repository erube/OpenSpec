import path from 'path';
import { readProjectConfig } from '../project-config.js';

export function resolveProjectId(projectRoot: string): string {
  const config = readProjectConfig(projectRoot);
  if (config?.projectId) {
    return config.projectId;
  }
  return path.basename(projectRoot);
}
