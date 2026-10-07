import {
  complementarySkills,
  desiredSkills,
  normalizeList,
} from '@/shared/recommendations/taxonomy';
import { ranking } from './config';
export interface Signals {
  skills: string[];
  interests: string[];
  lookingFor: string[];
}
const overlap = (a: string[], b: string[]) => a.filter((v) => b.includes(v));
export function matchReasons(actor: Signals, target: Signals) {
  const a = {
    skills: normalizeList('skills', actor.skills),
    interests: normalizeList('interests', actor.interests),
    lookingFor: normalizeList('lookingFor', actor.lookingFor),
  };
  const b = {
    skills: normalizeList('skills', target.skills),
    interests: normalizeList('interests', target.interests),
    lookingFor: normalizeList('lookingFor', target.lookingFor),
  };
  const reasons: string[] = [];
  if (overlap(desiredSkills(b.lookingFor), a.skills).length)
    reasons.push('Looking for your skills');
  const wanted = overlap(desiredSkills(a.lookingFor), b.skills)[0];
  if (wanted) reasons.push(wanted);
  const shared = overlap(a.interests, b.interests)[0];
  if (shared) reasons.push(shared);
  if (overlap(complementarySkills(a.skills), b.skills).length) reasons.push('Complementary skills');
  if (overlap(a.lookingFor, b.lookingFor).length)
    reasons.push(overlap(a.lookingFor, b.lookingFor)[0]);
  return [...new Set(reasons)].slice(0, ranking.maximumReasons);
}
export function deterministicScore(actor: Signals, target: Signals) {
  const a = {
    skills: normalizeList('skills', actor.skills),
    interests: normalizeList('interests', actor.interests),
    lookingFor: normalizeList('lookingFor', actor.lookingFor),
  };
  const b = {
    skills: normalizeList('skills', target.skills),
    interests: normalizeList('interests', target.interests),
    lookingFor: normalizeList('lookingFor', target.lookingFor),
  };
  const forward = Number(overlap(desiredSkills(a.lookingFor), b.skills).length > 0);
  const reverse = Number(overlap(desiredSkills(b.lookingFor), a.skills).length > 0);
  const w = ranking.weights;
  return Math.round(
    (w.intent * (forward + reverse)) / 2 +
      w.reciprocal * forward * reverse +
      w.complement * Number(overlap(complementarySkills(a.skills), b.skills).length > 0) +
      w.interests *
        Math.min(
          1,
          overlap(a.interests, b.interests).length / Math.max(1, Math.min(a.interests.length, 3)),
        ) +
      w.collaboration * Number(overlap(a.lookingFor, b.lookingFor).length > 0),
  );
}
export function balancedTeam<T extends Signals & { id: string; matchScore: number }>(
  candidates: T[],
  required: string[],
  size: number,
) {
  const needed = normalizeList('skills', required);
  const covered = new Set<string>();
  const result: T[] = [];
  while (result.length < size) {
    const next = candidates
      .filter((c) => !result.some((r) => r.id === c.id))
      .map((c) => ({
        c,
        gain: overlap(
          normalizeList('skills', c.skills),
          needed.filter((s) => !covered.has(s)),
        ).length,
      }))
      .sort(
        (a, b) =>
          b.gain - a.gain || b.c.matchScore - a.c.matchScore || a.c.id.localeCompare(b.c.id),
      )[0];
    if (!next) break;
    result.push(next.c);
    normalizeList('skills', next.c.skills).forEach((s) => covered.add(s));
  }
  return {
    users: result,
    coveredSkills: needed.filter((s) => covered.has(s)),
    missingSkills: needed.filter((s) => !covered.has(s)),
    compatibility: Math.round(
      (needed.length ? needed.filter((s) => covered.has(s)).length / needed.length : 0) * 70 +
        (result.length ? result.reduce((n, c) => n + c.matchScore, 0) / result.length : 0) * 0.3,
    ),
  };
}
