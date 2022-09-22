const read = require('fs').readFileSync;
const join = require('path').join;

function loadScript() {
  // import global script
  const script = read(join(__dirname, '..', 'dist', 'bundle.js')).toString('utf-8');
  eval(script);
}

describe("onInit", () => {
  beforeEach(() => {
    getSettings = () => ({
      generators: [{
        triggers: [{
          when: 'TASK_SUBMIT',
          id: 'task-id',
        }, {
          when: 'FORM_SUBMIT',
          id: 'form-id',
        }, {
          when: 'TAG_FOUND',
          tag: 'tag-id',
        }],
        tpl: {
          name: 'Test Task (<%= it.submit.data.name %>)',
          show: true,
          assignedTo: '<%= it.data.DEVICE_ID %>',
          description: '<%= it.task && it.task.name %>',
          formId: '<%= it.data.DOES_NOT_EXIST || "" %>',
          order: 1000,
          icon: '',
          iconType: 'material',
          tags: [],
          webhooks: [],
          metadata: {},
        }
      }],
    })
  })

  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
  });

  it('runs without errors', () => {
    loadScript();
    messages.emit('onInit');
  });

  it('triggers on tag', () => {
    env.project = {
      tasksManager: {
        tasks: [{
          $modelId: 'task-zaz',
          name: 'Test Task From tasksManager with tags',
          tags: ['tag-id'],
        }],
        create: jest.fn(),
      }
    } as never
    loadScript();

    messages.emit('onSubmit', {data: {}} as never, 'task-zaz', undefined);
    expect(env.project.tasksManager.create).toHaveBeenCalled();
  });

  it('triggers on taskId', () => {
    env.project = {
      tasksManager: {
        tasks: [{
          $modelId: 'task-id',
          name: 'Test Task From tasksManager',
        }],
        create: jest.fn(),
      }
    } as never
    loadScript();

    messages.emit('onSubmit', {data: {}} as never, 'task-id', undefined);
    expect(env.project.tasksManager.create).toHaveBeenCalled();
  });

  it('triggers on formId', () => {
    env.project = {
      tasksManager: {
        tasks: [{
          $modelId: 'task-id',
          name: 'Test Task From tasksManager',
        }],
        create: jest.fn(),
      },
      formsManager: {
        forms: [{
          $modelId: 'form-id',
          name: 'Test Task From formsManager',
        }],
      }
    } as never
    loadScript();

    messages.emit('onSubmit', {data: {}} as never, undefined, 'form-id');
    expect(env.project.tasksManager.create).toHaveBeenCalled();
  });

  it('triggers on formId from task', () => {
    env.project = {
      tasksManager: {
        tasks: [{
          $modelId: 'foo-id',
          name: 'Test Task From tasksManager',
          formId: 'form-id'
        }],
        create: jest.fn(),
      },
      formsManager: {
        forms: [{
          $modelId: 'form-id',
          name: 'Test Task From formsManager',
        }],
      }
    } as never
    loadScript();

    messages.emit('onSubmit', {data: {}} as never, 'foo-id', undefined);
    expect(env.project.tasksManager.create).toHaveBeenCalled();
  });

  xit('triggers on form with questions/answers', () => {})

  it('does not trigger if there is no match', () => {
    env.project = {
      tasksManager: {
        tasks: [{
          $modelId: 'task-id',
          name: 'Test Task From tasksManager',
        }],
        create: jest.fn(),
      }
    } as never
    loadScript();

    messages.emit('onSubmit', {data: {}} as never, 'not-a-task-id', 'not-a-form-id');
    expect(env.project.tasksManager.create).not.toHaveBeenCalled();
  });

  it('renders template', () => {
    env.project = {
      tasksManager: {
        tasks: [{
          $modelId: 'task-id',
          name: 'Test Task From tasksManager',
        }],
        create: jest.fn(),
      }
    } as never
    loadScript();

    messages.emit('onSubmit', {data: {name: 'Submit Name'}} as never, 'task-id', undefined);
    
    expect(env.project.tasksManager.create).toHaveBeenCalled();
    const call = (env.project.tasksManager.create as jest.Mock).mock.calls[0];
    expect(call[0].name).toBe('Test Task (Submit Name)');
    expect(call[0].description).toBe('Test Task From tasksManager');
    expect(call[0].assignedTo).toBe('TEST');
    expect(call[0].formId).toBe('');
  });
});