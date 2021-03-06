import * as MonoUtils from "@fermuch/monoutils";

type Activity = {
  activity: 'IN_VEHICLE' | 'ON_BICYCLE' | 'ON_FOOT' | 'RUNNING' | 'STILL' | 'TILTING' | 'UNKNOWN' | 'WALKING';
  confidence: number; // 0-100%
}

type MonoflowRule = {
  rule: number;
  state: 'enabled' | 'disabled';
}

// based on settingsSchema @ package.json
type Config = Record<string, unknown> & {
  enableActivityLogout: boolean;
  activities: Activity[];

  enableMonoflowLogout: boolean;
  monoflowRules: MonoflowRule[];

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

messages.on('onInit', function() {
  platform.log('autologout script started');

  if (conf.get('enableActivityLogout', false)) {
    platform.log('activity logout enabled');
    MonoUtils.wk.event.subscribe<ActivityRecognitionEvent>('activity-recognition', (ev) => {
      onActivityRecognition(ev.getData()?.data?.activityType, ev.getData()?.data?.confidence);
    });
  }

  if (conf.get('enableMonoflowLogout', false)) {
    platform.log('monoflow logout enabled');
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
    platform.log('should auto logout but is in submit view');
    return;
  }

  const rules = conf.get('monoflowRules', []);
  for (const r of rules) {
    const ruleStatus = r.state === 'enabled' ? true : false;
    if (r.rule === Math.floor(rule) && ruleStatus === status) {
      platform.log('logging out due to monoflow IO', rule, status);
      env.project?.logout();
      return;
    }
  }
}


let shouldLogoutAt: number | null = null;

function onActivityRecognition(activityType: string, confidence: number) {
  // platform.log(`onActivityRecognition ${activityType}=${confidence}%`);

  if (!conf.get('enableActivityLogout', false)) {
    return;
  }

  if (!env.project?.currentLogin.maybeCurrent) {
    return;
  }

  const rules = conf.get('activities', []);
  for (const rule of rules) {
    if (rule.activity === activityType && confidence >= rule.confidence && shouldLogoutAt === null) {
      const time = conf.get('minTimeForLogout', 1); // in minutes
      shouldLogoutAt = Date.now() + (time * 60 * 1000);
      platform.log(`logging out in ${time} minutes due to activity recognition [${rule.activity}]=${confidence}%`);
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
    // platform.log('should auto logout but is in submit view');
    return;
  }

  if (Date.now() >= shouldLogoutAt) {
    platform.log('logging out due to inactivity');
    env.project?.logout();
    shouldLogoutAt = null;
  }
})