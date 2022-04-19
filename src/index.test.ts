import * as MonoUtils from '@fermuch/monoutils';
// import { ActivityRecognitionEvent } from './index';
const read = require('fs').readFileSync;
const join = require('path').join;

function loadScript() {
  // import global script
  const script = read(join(__dirname, '..', 'dist', 'bundle.js')).toString('utf-8');
  eval(script);
}

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

  constructor(private rule: number, private status: boolean) {
    super();
  }

  getData() {
    return {
      type: 'monoflow-io' as const,
      metadata: {
        creator: 'monoflow-v1',
      },
      payload: {
        rule: this.rule,
        status: this.status,
      },
    }
  };
}

jest.useFakeTimers('modern');
describe("onInit", () => {
  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
  });

  beforeEach(() => {
    jest.setSystemTime(0);
  });

  it('runs without errors', () => {
    loadScript();
    messages.emit('onInit');
  });

  it('logs out when activity is matched by config', () => {
    getSettings = () => ({
      enableActivityLogout: true,
      activities: [{
        activity: 'STILL',
        confidence: 100,
      }]
    })
    ;(env.project as any) = {
      logout: jest.fn(),
      currentLogin: {
        maybeCurrent: {},
      }
    }

    loadScript();
    messages.emit('onInit');

    // should not trigger logout
    messages.emit('onPeriodic');
    messages.emit('onEvent', new ActivityRecognitionEvent(
      'IN_VEHICLE',
      99,
    ));
    messages.emit('onPeriodic');
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).not.toHaveBeenCalled();

    // should not trigger logout
    jest.setSystemTime(0);
    messages.emit('onPeriodic');
    messages.emit('onEvent', new ActivityRecognitionEvent(
      'STILL',
      99,
    ));
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).not.toHaveBeenCalled();

    // should trigger logout
    jest.setSystemTime(0);
    messages.emit('onPeriodic');
    messages.emit('onEvent', new ActivityRecognitionEvent(
      'STILL',
      100,
    ));
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).toHaveBeenCalledTimes(1);
  });
  
  it('logs out with monoflow IO if enabled', () => {
    getSettings = () => ({
      enableMonoflowLogout: true,
      monoflowRules: [{
        rule: 0,
        state: 'enabled',
      }]
    })
    ;(env.project as any) = {
      logout: jest.fn(),
      currentLogin: {
        maybeCurrent: {},
      }
    }

    loadScript();
    messages.emit('onInit');

    // should not trigger logout
    messages.emit('onEvent', new MonoflowIOEvent(
      2,
      true,
    ));
    expect(env.project.logout).not.toHaveBeenCalled();

    // should not trigger logout
    messages.emit('onEvent', new MonoflowIOEvent(
      0,
      false,
    ));
    expect(env.project.logout).not.toHaveBeenCalled();

    // should trigger logout
    messages.emit('onEvent', new MonoflowIOEvent(
      0,
      true,
    ));
    expect(env.project.logout).toHaveBeenCalledTimes(1);
  });

  it('does not log out when CURRENT_PAGE is Submit', () => {
    getSettings = () => ({
      enableActivityLogout: true,
      activities: [{
        activity: 'STILL',
        confidence: 100,
      }],
      enableMonoflowLogout: true,
      monoflowRules: [{
        rule: 0,
        state: 'enabled',
      }]
    })
    ;(env.project as any) = {
      logout: jest.fn(),
      currentLogin: {
        maybeCurrent: {},
      }
    }

    loadScript();
    messages.emit('onInit');

    env.setData('CURRENT_PAGE', 'Submit');

    // should not trigger logout
    messages.emit('onPeriodic');
    messages.emit('onEvent', new ActivityRecognitionEvent(
      'IN_VEHICLE',
      99,
    ));
    messages.emit('onPeriodic');
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).not.toHaveBeenCalled();

    // should not trigger logout
    jest.setSystemTime(0);
    messages.emit('onPeriodic');
    messages.emit('onEvent', new ActivityRecognitionEvent(
      'STILL',
      99,
    ));
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).not.toHaveBeenCalled();

    // should trigger logout
    jest.setSystemTime(0);
    messages.emit('onPeriodic');
    messages.emit('onEvent', new ActivityRecognitionEvent(
      'STILL',
      100,
    ));
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).not.toHaveBeenCalled();

    // should not trigger logout
    jest.setSystemTime(0);
    messages.emit('onPeriodic');
    messages.emit('onEvent', new MonoflowIOEvent(
      2,
      true,
    ));
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).not.toHaveBeenCalled();

    // should not trigger logout
    jest.setSystemTime(0);
    messages.emit('onPeriodic');
    messages.emit('onEvent', new MonoflowIOEvent(
      0,
      false,
    ));
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).not.toHaveBeenCalled();

    // should trigger logout
    jest.setSystemTime(0);
    messages.emit('onPeriodic');
    messages.emit('onEvent', new MonoflowIOEvent(
      0,
      true,
    ));
    jest.setSystemTime(99999999);
    messages.emit('onPeriodic');
    expect(env.project.logout).not.toHaveBeenCalled();
  });
});