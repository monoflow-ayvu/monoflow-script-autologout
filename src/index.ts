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
}

const conf = new MonoUtils.config.Config<Config>();

class ActivityRecognitionEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'activity-recognition' as const;

  constructor(public activityType: string, public confidence: number) {
    super();
  }

  getData(): {kind: string; data: unknown} {
    return {
      kind: this.kind,
      data: {
        activityType: this.activityType,
        confidence: this.confidence,
      },
    };
  }
}

function onActivityRecognition(activityType: string, confidence: number) {
  if (!conf.get('enableActivityLogout', false)) {
    return;
  }

  if (!env.isLoggedIn) {
    return;
  }

  const rules = conf.get('activities', []);
  for (const rule of rules) {
    if (rule.activity === activityType && confidence >= rule.confidence) {
      platform.log('logging out due to activity recognition', rule.activity, confidence);
      env.project?.logout();
      return;
    }
  }
}

class MonoflowIOEvent extends MonoUtils.wk.event.BaseEvent {
  kind: 'generic';
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

function onMonoflowIO(rule: number, status: boolean) {
  if (!conf.get('enableMonoflowLogout', false)) {
    return;
  }

  if (!env.isLoggedIn) {
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

messages.on('onInit', function() {
  platform.log('autologout script started');

  if (conf.get('enableActivityLogout', false)) {
    platform.log('activity logout enabled');
    MonoUtils.wk.event.subscribe<ActivityRecognitionEvent>('activity-recognition', (ev) => {
      onActivityRecognition(ev.activityType, ev.confidence);
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