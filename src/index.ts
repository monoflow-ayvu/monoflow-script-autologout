import * as MonoUtils from "@fermuch/monoutils";
import { anyTagMatches } from "./utils";

type Activity = {
  activity: 'IN_VEHICLE' | 'ON_BICYCLE' | 'ON_FOOT' | 'RUNNING' | 'STILL' | 'TILTING' | 'UNKNOWN' | 'WALKING';
  confidence: number; // 0-100%
}

type MonoflowRule = {
  rule: number;
  state: 'enabled' | 'disabled';
}

type SpecialRule = {
  tag: string;
  action: 'customTimeLimit' | 'disableAutoLogout';
  minutes?: number;
}

// based on settingsSchema @ package.json
type Config = Record<string, unknown> & {
  enableActivityLogout: boolean;
  activities: Activity[];

  enableMonoflowLogout: boolean;
  monoflowRules: MonoflowRule[];

  specialRules: SpecialRule[];

  minTimeForLogout: number;
}

const conf = new MonoUtils.config.Config<Config>();

class ActivityRecognitionEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'activity-recognition' as const;

  constructor(public activityType: string, public confidence: number) {
    super();
  }

  getData(): {kind: string; data: {activityType: string; confidence: number}} {
    return {
      kind: this.kind,
      data: {
        activityType: this.activityType,
        confidence: this.confidence,
      },
    };
  }
}

class MonoflowIOEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'generic' as const;
  getData() {
    return {
      type: 'monoflow-io' as const,
      metadata: {
        creator: 'monoflow-v1',
      },
      payload: {
        rule: 0,
        status: true,
      },
    }
  };
}

function log(...msgs: any[]) {
  platform.log('[autologout]', ...msgs);
}

messages.on('onInit', function() {
  log('autologout script started');

  if (conf.get('enableActivityLogout', false)) {
    log('activity logout enabled');
    MonoUtils.wk.event.subscribe<ActivityRecognitionEvent>('activity-recognition', (ev) => {
      onActivityRecognition(ev.getData()?.data?.activityType, ev.getData()?.data?.confidence);
    });
  }

  if (conf.get('enableMonoflowLogout', false)) {
    log('monoflow logout enabled');
    MonoUtils.wk.event.subscribe<MonoflowIOEvent>('generic', (ev) => {
      const data = ev.getData();
      if (data?.type === 'monoflow-io') {
        onMonoflowIO(data?.payload?.rule, data?.payload?.status);
      }
    });
  }
});

function onMonoflowIO(rule: number, status: boolean) {
  if (!conf.get('enableMonoflowLogout', false)) {
    return;
  }

  if (!env.project?.currentLogin.maybeCurrent) {
    return;
  }

  if (env.data.CURRENT_PAGE === 'Submit') {
    log('should auto logout but is in submit view');
    return;
  }

  const rules = conf.get('monoflowRules', []);
  for (const r of rules) {
    const ruleStatus = r.state === 'enabled' ? true : false;
    if (r.rule === Math.floor(rule) && ruleStatus === status) {
      log('logging out due to monoflow IO', rule, status);
      logout();
      return;
    }
  }
}

function getMinutesToLogout(): number {
  const _default = conf.get('minTimeForLogout', 1); // in minutes

  for (const rule of conf.get('specialRules', [])) {
    if (rule.action === 'customTimeLimit' && anyTagMatches([rule.tag])) {
      return rule.minutes || _default;
    }
  }

  return _default;
}

function logout() {
  for (const rule of conf.get('specialRules', [])) {
    if (rule.action === 'disableAutoLogout' && anyTagMatches([rule.tag])) {
      return; // auto-logout is disabled for this user
    }
  }

  env.project?.logout();
}

let shouldLogoutAt: number | null = null;
function onActivityRecognition(activityType: string, confidence: number) {
  log(`onActivityRecognition ${activityType}=${confidence}%`);

  if (!conf.get('enableActivityLogout', false)) {
    return;
  }

  if (!env.project?.currentLogin?.maybeCurrent) {
    log('user is not logged in');
    return;
  }

  const rules = conf.get('activities', []);
  for (const rule of rules) {
    if (rule.activity === activityType && confidence >= rule.confidence) {
      if (shouldLogoutAt === null) {
        const time = getMinutesToLogout();
        shouldLogoutAt = Date.now() + (time * 60 * 1000);
        log(`logging out in ${time} minutes due to activity recognition [${rule.activity}]=${confidence}%`);
      } else {
        log(`rule matches but already has another counter running, so waiting for that one to stop first. It'll execute at: ${new Date(shouldLogoutAt).toISOString()}`)
      }
      return;
    }
  }

  // if we reach here means the current activity overrides the previous one
  // so we cancel logout
  shouldLogoutAt = null;
}

messages.on('onPeriodic', () => {
  if (shouldLogoutAt === null) return;

  if (env.data.CURRENT_PAGE === 'Submit') {
    // log('should auto logout but is in submit view');
    return;
  }

  if (Date.now() >= shouldLogoutAt) {
    log('logging out due to inactivity');
    logout();
    shouldLogoutAt = null;
  }
})