import { currentLogin, myID } from "@fermuch/monoutils";

function getMyTags(loginId) {
  const loginName = loginId || currentLogin() || '';
  const userTags = env.project?.logins?.find((login) => login.key === loginName || login.$modelId === loginName)?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
  const allTags = [...userTags, ...deviceTags];

  return allTags;
}

export function anyTagMatches(tags: string[], loginId?: string): boolean {
  // we always match if there are no tags
  if (!tags || tags.length === 0) return true;

  const loginName = loginId || currentLogin() || '';
  const allTags = getMyTags(loginName);

  return tags.some((t) => allTags.includes(t));
}