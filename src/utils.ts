import { currentLogin, myID } from "@fermuch/monoutils";

const MY_TAGS = {
  loginId: '',
  lastUpdate: 0,
  tags: [],
};
const MAX_TAG_TIME = 10_000; // ms
function getMyTags(loginId) {
  if (MY_TAGS.loginId !== loginId || Date.now() - MY_TAGS.lastUpdate >= MAX_TAG_TIME) {
    const loginName = loginId || currentLogin() || '';
    const userTags = env.project?.logins?.find((login) => login.key === loginName || login.$modelId === loginName)?.tags || [];
    const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
    const allTags = [...userTags, ...deviceTags];

    platform.log('[GPS] updating tags store');
    MY_TAGS.loginId = loginId;
    MY_TAGS.lastUpdate = Date.now();
    MY_TAGS.tags = allTags;
  }

  return MY_TAGS.tags;
}

export function anyTagMatches(tags: string[], loginId?: string): boolean {
  // we always match if there are no tags
  if (!tags || tags.length === 0) return true;

  const loginName = loginId || currentLogin() || '';
  const allTags = getMyTags(loginName);

  return tags.some((t) => allTags.includes(t));
}