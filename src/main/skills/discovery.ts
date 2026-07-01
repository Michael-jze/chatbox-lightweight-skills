import type { SkillInfo, SkillSource } from '@shared/types/skills'
import fs from 'fs'
import path from 'path'
import { getLogger } from '../util'
import { getBuiltinSkillsRoots } from './builtin-path'
import { parseSkillFile } from './parser'

const log = getLogger('skills:discovery')

const SKILL_FILE_NAME = 'SKILL.md'

export interface DiscoverSkillsOptions {
  /** When set, only scan this directory (legacy single-root mode). */
  skillsDir?: string
  /** Additional roots to scan recursively (e.g. project .cursor/skills). */
  extraRoots?: string[]
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    log.info(`Created skills directory: ${dir}`)
  }
}

function walkForSkillFiles(root: string, results: string[] = []): string[] {
  if (!fs.existsSync(root)) {
    return results
  }

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch (error) {
    log.error(`Failed to read directory: ${root}`, error)
    return results
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const fullPath = path.join(root, entry.name)
    const skillMd = path.join(fullPath, SKILL_FILE_NAME)
    if (fs.existsSync(skillMd)) {
      results.push(skillMd)
      continue
    }
    walkForSkillFiles(fullPath, results)
  }

  return results
}

function skillSourceForRoot(
  skillRoot: string,
  skillsDir: string,
  externalRootsResolved: string[] = []
): SkillSource {
  const normalizedRoot = path.normalize(skillRoot)
  const normalizedUser = path.normalize(skillsDir)

  for (const externalRoot of externalRootsResolved) {
    const normalizedExternal = path.normalize(externalRoot)
    if (
      normalizedRoot === normalizedExternal ||
      normalizedRoot.startsWith(`${normalizedExternal}${path.sep}`)
    ) {
      return { type: 'external', skillPath: skillRoot }
    }
  }

  if (normalizedRoot === normalizedUser || normalizedRoot.startsWith(`${normalizedUser}${path.sep}`)) {
    return { type: 'local' }
  }
  return { type: 'local', skillPath: skillRoot }
}

/**
 * Discover skills by recursively walking skill roots for SKILL.md files.
 */
export function discoverSkills(
  skillsDir: string,
  extraRoots: string[] = [],
  options: { externalRootsResolved?: string[] } = {}
): SkillInfo[] {
  ensureDir(skillsDir)

  const builtinRoots = getBuiltinSkillsRoots()
  const roots = [...builtinRoots, skillsDir, ...extraRoots.filter(Boolean)]
  const skillMdPaths: string[] = []
  for (const root of roots) {
    walkForSkillFiles(root, skillMdPaths)
  }

  const customSkills: SkillInfo[] = []

  for (const skillMdPath of skillMdPaths) {
    const skillRoot = path.dirname(skillMdPath)
    const directoryName = path.basename(skillRoot)
    const parsed = parseSkillFile(skillMdPath, directoryName)
    if (!parsed) continue

    const bodyTokenEstimate = Math.ceil(parsed.body.length / 4)
    const isBuiltin = builtinRoots.some((root) => {
      const normalizedRoot = path.normalize(root)
      return skillRoot === normalizedRoot || skillRoot.startsWith(`${normalizedRoot}${path.sep}`)
    })
    const rootForSource = roots.find((r) => skillRoot.startsWith(path.normalize(r))) ?? skillsDir

    customSkills.push({
      ...parsed.metadata,
      path: skillRoot,
      isBuiltin,
      bodyTokenEstimate,
      source: isBuiltin
        ? { type: 'builtin' as const, skillPath: skillRoot }
        : skillSourceForRoot(skillRoot, skillsDir, options.externalRootsResolved),
    })
  }

  const seenNames = new Set<string>()
  const deduplicatedSkills: SkillInfo[] = []
  for (const skill of customSkills) {
    if (seenNames.has(skill.name)) {
      log.warn(`Duplicate skill name "${skill.name}" found, keeping first occurrence`)
      continue
    }
    seenNames.add(skill.name)
    deduplicatedSkills.push(skill)
  }

  return deduplicatedSkills
}

export function resolveSkillRoot(
  skillsDir: string,
  skillName: string,
  extraRoots: string[] = [],
  options: { externalRootsResolved?: string[] } = {}
): string | null {
  const match = discoverSkills(skillsDir, extraRoots, options).find((skill) => skill.name === skillName)
  return match?.path ?? null
}

export function discoverSkillsFromOptions(options: DiscoverSkillsOptions = {}): SkillInfo[] {
  const skillsDir = options.skillsDir ?? ''
  if (!skillsDir) {
    return []
  }
  return discoverSkills(skillsDir, options.extraRoots ?? [])
}
