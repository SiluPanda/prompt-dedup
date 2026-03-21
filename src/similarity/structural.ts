import { detectSections } from '../parser/section-detector';
import { detectVariables } from '../parser/variable-detector';

/**
 * Compute structural similarity between two prompts.
 * Considers roles, section titles, variable counts, and example counts.
 */
export function structuralSimilarity(a: string, b: string): number {
  const roleScore = computeRoleScore(a, b);
  const sectionScore = computeSectionScore(a, b);
  const variableScore = computeVariableCountScore(a, b);
  const exampleScore = computeExampleCountScore(a, b);

  return (roleScore + sectionScore + variableScore + exampleScore) / 4;
}

/**
 * Role match score: 1.0 if same roles in same order, 0.0 otherwise.
 */
function computeRoleScore(a: string, b: string): number {
  const rolesA = extractRoles(a);
  const rolesB = extractRoles(b);

  if (rolesA.length === 0 && rolesB.length === 0) return 1.0;
  if (rolesA.length !== rolesB.length) return 0.0;

  for (let i = 0; i < rolesA.length; i++) {
    if (rolesA[i] !== rolesB[i]) return 0.0;
  }

  return 1.0;
}

function extractRoles(text: string): string[] {
  const roleRegex = /^\[(system|user|assistant|developer)\]$/gm;
  const roles: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = roleRegex.exec(text)) !== null) {
    roles.push(match[1]);
  }
  return roles;
}

/**
 * Section title overlap: Jaccard on section title sets.
 */
function computeSectionScore(a: string, b: string): number {
  const sectionsA = detectSections(a);
  const sectionsB = detectSections(b);

  const titlesA = new Set(sectionsA.map((s) => s.title).filter(Boolean));
  const titlesB = new Set(sectionsB.map((s) => s.title).filter(Boolean));

  if (titlesA.size === 0 && titlesB.size === 0) return 1.0;
  if (titlesA.size === 0 || titlesB.size === 0) return 0.0;

  let intersection = 0;
  for (const t of titlesA) {
    if (titlesB.has(t)) intersection++;
  }

  const union = titlesA.size + titlesB.size - intersection;
  return intersection / union;
}

/**
 * Variable count similarity: 1 - |countA - countB| / max(countA, countB).
 */
function computeVariableCountScore(a: string, b: string): number {
  const countA = detectVariables(a).length;
  const countB = detectVariables(b).length;

  if (countA === 0 && countB === 0) return 1.0;
  const maxCount = Math.max(countA, countB);
  return 1 - Math.abs(countA - countB) / maxCount;
}

/**
 * Example count similarity: 1 - |countA - countB| / max(countA, countB).
 */
function computeExampleCountScore(a: string, b: string): number {
  const countA = countExamples(a);
  const countB = countExamples(b);

  if (countA === 0 && countB === 0) return 1.0;
  const maxCount = Math.max(countA, countB);
  return 1 - Math.abs(countA - countB) / maxCount;
}

function countExamples(text: string): number {
  const exampleRegex = /(?:^|\n)(?:Example\s+\d+\s*[:.]|\d+[.)]\s)/gm;
  const matches = text.match(exampleRegex);
  return matches ? matches.length : 0;
}
