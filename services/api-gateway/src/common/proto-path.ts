import { join } from 'path';

/**
 * Resolves a .proto file at repo-root/proto/<file>. Works unchanged in both
 * local dev (ts-node from src/) and the Docker image, because the Dockerfile
 * mirrors this same three-levels-up layout (proto/, services/<name>/dist|src).
 */
export const protoPath = (file: string): string =>
  join(__dirname, '..', '..', '..', '..', 'proto', file);
