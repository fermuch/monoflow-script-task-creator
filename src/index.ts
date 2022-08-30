import * as MonoUtils from "@fermuch/monoutils";
import { currentLogin, myID } from "@fermuch/monoutils";
import { Submission, TaskT } from "@fermuch/telematree";
import * as Eta from "eta";

// based on settingsSchema @ package.json
type Config = {
  generators: {
    triggers: {
      when: 'TASK_SUBMIT' | 'FORM_SUBMIT' | 'TAG_FOUND';
      id: string;
      questions?: Record<string, string>;
      tag?: string;
    }[];
    tpl: {
      name: string;
      show: boolean;
      assignedTo: string;
      description: string;
      formId: string;
      order: number;
      icon: TaskT['icon'];
      iconType: TaskT['iconType'];
      tags: string[];
      webhooks: string[];
      metadata: Record<string, string | number | boolean>;
    };
  }[];
}

const conf = new MonoUtils.config.Config<Config>();

function compile(tpl: string, submit: Submission, taskId?: string, formId?: string): string {
  const task = taskId && env.project?.tasksManager?.tasks?.find((t) => t?.$modelId === taskId);
  const form = formId && env.project?.formsManager?.forms?.find((f) => f?.$modelId === formId);
  const device = env.project?.usersManager?.users?.find((u) => u?.$modelId === myID());
  const login = currentLogin() && env.project?.logins?.find((l) => l?.$modelId === currentLogin());
  return Eta.render(tpl, {
    submit,
    task,
    taskId,
    form,
    formId,
    data: env.data || {},
    device,
    deviceName: device?.name || device?.prettyName || device?.deviceName || device?.$modelId || '',
    deviceId: myID() || '',
    login,
    loginId: currentLogin() || '',
    loginName: login?.name || currentLogin() || '',
  }, {async: false, cache: false}) as string;
}

function matchesQuestionAnswers(qa?: Record<string, string>, data?: Record<string, unknown>): boolean {
  if (!qa) return true;
  for (const [key, value] of Object.entries(qa)) {
    if (data[key] !== value) return false;
  }
  return true;
}

messages.on('onSubmit', function(submit, taskId, formId) {
  const task = taskId && env.project?.tasksManager?.tasks?.find((t) => t?.$modelId === taskId);
  const form = formId && env.project?.formsManager?.forms?.find((f) => f?.$modelId === formId);
  const tags = [
    ...(task?.tags || []),
    ...(form?.tags || []),
  ];

  const generators = conf.get('generators', []);
  for (const generator of generators) {
    const myTriggers = generator.triggers?.filter(trigger =>
          (trigger.when === 'TASK_SUBMIT' && trigger.id === taskId)
      ||  (trigger.when === 'FORM_SUBMIT' && trigger.id === formId && matchesQuestionAnswers(trigger.questions || {}, submit.data || {}))
      ||  (trigger.when === 'TAG_FOUND' && trigger.tag && tags.includes(trigger.tag))
    );
    
    // we don't have any trigger
    if (myTriggers.length === 0) {
      continue;
    }

    const taskTpl: Config['generators'][0]['tpl'] = {
      name: compile(generator.tpl.name, submit, taskId, formId) || '',
      show: generator.tpl.show,
      assignedTo: compile(generator.tpl.assignedTo, submit, taskId, formId) || '',
      description: compile(generator.tpl.description, submit, taskId, formId) || '',
      formId: compile(generator.tpl.formId, submit, taskId, formId) || '',
      order: generator.tpl.order,
      icon: compile(generator.tpl.icon, submit, taskId, formId) || '',
      iconType: (compile(generator.tpl.iconType, submit, taskId, formId) || '') as TaskT['iconType'],
      tags: generator.tpl.tags.map(tag => compile(tag, submit, taskId, formId)),
      webhooks: generator.tpl.webhooks.map((wh) => compile(wh, submit, taskId, formId)),
      metadata: Object.keys(generator.tpl.metadata).reduce((acc, key) => {
        acc[key] = compile(String(generator.tpl.metadata[key]), submit, taskId, formId);
        return acc;
      }, {} as Record<string, string | number | boolean>),
    };

    const defaultMetadata = {
      isCreated: true,
      taskId: taskId || '',
      taskName: task?.name || '',
      formId: formId || '',
      formName: form?.name || '',
      originalTags: tags,
      originalLogin: currentLogin() || '',
      // triggers: myTriggers,
    }

    const taskData = {
      name: taskTpl.name,
      show: taskTpl.show,
      description: taskTpl.description,
      formId: taskTpl.formId,
      order: taskTpl.order,
      icon: taskTpl.icon,
      iconType: taskTpl.iconType,
      done: false,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      assignedTo: taskTpl.assignedTo,
      tags: Array.isArray(taskTpl.tags) ? [...taskTpl.tags] : [],
      webhooks: Array.isArray(taskTpl.webhooks) ? [...taskTpl.webhooks] : [],
      metadata: typeof taskTpl.metadata === 'object' ? {...taskTpl.metadata, ...defaultMetadata} : defaultMetadata,
    };

    platform.log('criando tarefa com dados:');
    platform.log(taskData);

    env.project.tasksManager.create(taskData);
  }
});