import * as MonoUtils from "@fermuch/monoutils";
import { currentLogin, myID } from "@fermuch/monoutils";
import { Submission, TaskT } from "@fermuch/telematree";
import * as Eta from "eta";

// based on settingsSchema @ package.json
type Config = {
  generators: {
    triggers: {
      when: 'TASK_SUBMIT' | 'FORM_SUBMIT';
      id: string;
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
  const task = taskId && env.project?.tasksManager?.tasks?.find((task) => task.$modelId === taskId);
  const form = formId && env.project?.formsManager?.forms?.find((form) => form.$modelId === formId);
  return Eta.render(tpl, {
    submit,
    task,
    taskId,
    form,
    formId,
    data: env.data || {},
    device: env.project?.usersManager?.users?.find((u) => u.$modelId === myID()),
    deviceName: env.project?.usersManager?.users?.find((u) => u.$modelId === myID())?.name || env.project?.usersManager?.users?.find((u) => u.$modelId === myID())?.prettyName || env.project?.usersManager?.users?.find((u) => u.$modelId === myID())?.deviceName || env.project?.usersManager?.users?.find((u) => u.$modelId === myID()).$modelId || '',
    login: currentLogin() && env.project?.logins.find((l) => l.$modelId === currentLogin()),
    loginName: env.project?.logins?.find((l) => l.$modelId === currentLogin())?.name || currentLogin() || '',
  }, {async: false, cache: false}) as string;
}

messages.on('onSubmit', function(submit, taskId, formId) {
  const generators = conf.get('generators', []);
  for (const generator of generators) {
    const myTriggers = generator.triggers?.filter(trigger =>
          (trigger.when === 'TASK_SUBMIT' && trigger.id === taskId)
      ||  (trigger.when === 'FORM_SUBMIT' && trigger.id === formId)
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
      tags: generator.tpl.tags,
      webhooks: generator.tpl.webhooks,
      metadata: generator.tpl.metadata,
    };
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
      // tags: taskTpl.tags || [],
      metadata: taskTpl.metadata,
    };

    platform.log('criando tarefa com dados:');
    platform.log(taskData);

    env.project.tasksManager.create(taskData);
  }
});