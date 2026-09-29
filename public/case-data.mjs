// Entirely synthetic teaching case. This is a compact presentation model,
// not an executable instance of the complete v3 validation contract.
const ref = (id, revision = 'v1') => ({ id, revision });
const target = (id, revision = 'v1', path) => ({ ref: ref(id, revision), ...(path ? { path } : {}) });
const records = [];
let activityOrdinal = 0;
const add = (key, kind, title, id, revision, description, data) => {
  const row = { id: key, kind, title, revision, description, data: {
    schema: 'https://schema.example.invalid/demo/compact-v1',
    id, revision, recorded_at: '2026-08-20T12:00:00Z', ...data
  } };
  records.push(row);
  return row;
};
const asset = (key, title, id, revision, description, kind, data, producedBy = 'activity/register') =>
  add(key, 'asset', title, id, revision, description, {
    kind, produced_by: ref(producedBy, 'done'), access: { visibility: 'internal' }, data
  });
const activity = (key, title, id, kind, inputs, participants, extra = {}) => {
  const start = Date.parse('2026-08-20T09:00:00Z') + activityOrdinal++ * 120000;
  return add(key, 'activity', title, id, 'done', title, {
    kind, state: 'completed', inputs: inputs.map(([role, id, revision = 'v1', path]) => ({ role, target: target(id, revision, path) })),
    participants: participants.map(([id, role]) => ({ actor: ref(`actor/${id}`), role })),
    time: { started_at: new Date(start).toISOString(), finished_at: new Date(start + 60000).toISOString() }, ...extra
  });
};
const assessment = (key, title, id, subjects, criterion, result, producedBy, extra = {}) =>
  add(key, 'assessment', title, id, 'v1', title, {
    subjects: subjects.map(([id, revision = 'v1', path]) => target(id, revision, path)),
    criterion: { evaluator: ref(criterion[0], criterion[1]), key: criterion[2] },
    result, produced_by: ref(producedBy, 'done'), evidence: [], ...extra
  });
const value = value => ({ status: 'value', value });
const method = (procedure, config = {}, more = {}) => ({ procedure: ref(procedure), config, ...more });

activity('register', '登记虚构参与者、规则与模型', 'activity/register', 'import', [], [['service', 'registrar']], {
  diagnostics: { format: 'text/plain', inline: '所有身份、时间、数据、分数均为人工构造的展示资料；未运行真实模型或容器。登记事件只代表本演示导入，不冒充原始创作。' }
});
[
  ['service', '流程服务', 'service'], ['author', '林：领域作者', 'person'],
  ['annotator', '周：数值标注员', 'person'], ['expert', '陈：解析专家', 'person'],
  ['reviewer-a', '沈：衍射审核员', 'person'], ['reviewer-b', '顾：计算审核员', 'person'],
  ['statistician', '许：统计审核员', 'person'], ['adjudicator', '唐：裁决专家', 'person']
].forEach(([id, title, type]) => asset(`actor-${id}`, title, `actor/${id}`, 'v1', '虚构角色；角色职责随具体 Activity 记录。', 'actor', { type, display_name: title }));
[
  ['annotation', '构造与标注规范'], ['review', '独立审核与裁决规范'], ['execute', '终端 Agent 执行协议'],
  ['verify', '科学任务判分程序'], ['release', '冻结发布与聚合协议'], ['rescore', '重评分与输入等价审查'],
  ['generate', '独立训练题生成器'], ['export', 'SFT / DPO 导出配方'], ['eligibility', '用途与污染隔离审查']
].forEach(([id, title]) => asset(`procedure-${id}`, title, `procedure/${id}`, 'v1', '展示用版本化方法定义。', 'procedure', {
  name: title, definition: { format: 'text/plain', inline: `${title}的简化示意；实际系统须保存完整规则和代码。` },
  config_schema: `https://schema.example.invalid/demo/${id}-config-v1`
}));
asset('policy-eval', '评测隔离策略', 'policy/eval-only', 'v1', '限制来自用途规则，不能从 test 字符串推断。', 'policy', {
  rules: { format: 'https://schema.example.invalid/demo/policy-v1', inline: {
    allowed_purposes: ['evaluation', 'audit'], denied_purposes: ['training'],
    propagate_to: ['task derivatives', 'responses', 'trajectories', 'reference solutions'],
    enforcement: '导出端逐项检查；UI 隐藏不构成隔离。'
  } }
});
asset('policy-train', '训练来源策略', 'policy/training', 'v1', '独立来源、单独授权、去重通过后才允许导出。', 'policy', {
  rules: { format: 'https://schema.example.invalid/demo/policy-v1', inline: {
    allowed_purposes: ['training'], required_checks: ['source permission', 'lineage separation', 'content similarity', 'evaluation exposure']
  } }
});
asset('evaluator-review', '领域审核准则', 'evaluator/review', 'v1', '每一种判断独立定义值域。', 'evaluator', {
  method: ref('procedure/review'), criteria: [
    { key: 'review_decision', value_schema: 'https://schema.example.invalid/demo/accept-revise-v1' },
    { key: 'input_equivalence', value_schema: 'https://schema.example.invalid/demo/boolean-v1' }
  ]
});
asset('evaluator-policy', '训练资格判定器', 'evaluator/policy', 'v1', '权限与污染筛查是独立证据。', 'evaluator', {
  method: ref('procedure/eligibility'), criteria: [{ key: 'training_eligibility', value_schema: 'https://schema.example.invalid/demo/allow-block-v1' }]
});
asset('evaluator-preference', '训练候选比较准则', 'evaluator/preference', 'v1', '偏好和正确性是两个 criterion。', 'evaluator', {
  method: ref('procedure/review'), criteria: [
    { key: 'preference', value_schema: 'https://schema.example.invalid/demo/winner-v1' },
    { key: 'answer_correctness', value_schema: 'https://schema.example.invalid/demo/boolean-v1' }
  ]
});

activity('import', '导入三种合成来源', 'activity/import', 'import', [], [['service', 'importer']]);
[
  ['source-spectrum', 'artifact/spectrum', '合成衍射曲线 PNG', 'image/png', '模拟光谱可视图；无需声称来自真实实验。'],
  ['source-data', 'artifact/counts', '合成计数 CSV', 'text/csv', '2θ、计数、逐点噪声，附生成参数。'],
  ['source-method', 'artifact/method-note', '合成实验条件与模型说明', 'text/plain', '仪器响应、相模板、误差假设与单位。']
].forEach(([key, id, title, media_type, note]) => asset(key, title, id, 'v1', note, 'artifact', {
  media_type, storage: { uri: `demo://${id}`, availability: 'unavailable' },
  source: { uri: 'https://example.invalid/synthetic-materials-case', revision: 'demo-v1', locator: key },
  note: '展示占位记录，没有对应可下载实验文件，也没有伪造文件 hash。'
}, 'activity/import'));
asset('environment', '固定终端与 verifier 环境', 'environment/materials', 'v1', '固定依赖结构示意，未构建或执行镜像。', 'environment', {
  runtime: { kind: 'container', locator: 'demo://materials-container', revision: 'illustrative-image-revision-v1' },
  initialization: { format: 'application/json', inline: { agent_mounts: ['spectrum.png', 'counts.csv', 'method.txt'], hidden_mounts: ['verifier fixtures'], network: 'disabled' } },
  dependencies: [{ name: 'numpy', scope: 'agent', source: 'demo-lockfile', version: 'illustrative-pinned-version' }, { name: 'pytest', scope: 'verifier', source: 'demo-lockfile', version: 'illustrative-pinned-version' }],
  limits: { cpu: 4, memory_mb: 8192, timeout_seconds: 900 }, reproducibility: 'pinned',
  note: 'pinned 表示该设计要求；这里的 locator/revision 是教学占位符，不是已验证的可重放环境。'
});
asset('verifier-v1', '隐藏 verifier v1', 'evaluator/materials', 'v1', '含一个尚未发现的数组顺序缺陷。', 'evaluator', {
  method: ref('procedure/verify'), environment: ref('environment/materials'),
  criteria: [{ key: 'task_pass', description: '格式、物理约束、数值容差与误差解释全部通过', value_schema: 'https://schema.example.invalid/demo/boolean-v1' }],
  hidden_test_groups: ['输出 JSON 合同', '相比例归一化', '解析合成基准容差', '误差模型引用'],
  known_later_defect: '用数组位置比较相名；应按 phase_id 对齐。'
});
const taskData = (version, evaluatorVersion = 'v1') => ({
  profile: 'https://schema.example.invalid/demo/materials-terminal-v1',
  input: { messages: [{ role: 'user', content: { format: 'text/plain', inline: version === 1
    ? '根据图像、计数与实验说明估计两相比例及区间，生成 answer.json 和方法报告。误差相关性尚未明确。'
    : '按给定的两相线性混合模型估计相比例；显式采用计数噪声与共享校准偏移，输出 phase_id 标识的比例、区间与假设。相的排列顺序不影响语义。' } }],
    files: [{ name: '/input/spectrum.png', artifact: ref('artifact/spectrum') }, { name: '/input/counts.csv', artifact: ref('artifact/counts') }, { name: '/input/method.txt', artifact: ref('artifact/method-note') }] },
  references: [{ key: 'answer', role: 'answer', audience: 'evaluator', value: { format: 'application/json', inline: { phase_A: 0.63, phase_B: 0.37, illustrative_interval_A: [0.58, 0.68] } } },
    { key: 'rationale', role: 'rationale', audience: 'curator', value: { format: 'text/plain', inline: version === 1 ? '原始推导未区分逐点噪声与共享校准误差。' : '说明校准偏移作为共享 nuisance variable 的处理及区间计算约定；这些数值仅用于示意。' } }],
  environment: ref('environment/materials'), evaluation: ref('evaluator/materials', evaluatorVersion),
  attributes: { domain: 'materials-science', tags: ['synthetic', 'multimodal', 'terminal', 'uncertainty'] }, lineage_key: 'eval-materials-family-017'
});
activity('author', '三人分工构造 v1', 'activity/author', 'author', [['source', 'artifact/spectrum'], ['source', 'artifact/counts'], ['source', 'artifact/method-note']], [['author', 'author'], ['annotator', 'annotator'], ['expert', 'rationale_author']], {
  method: method('procedure/annotation'), workflow: { run_id: 'production-017', stage: 'author', round: 1 },
  mappings: [
    { output: target('task/material-017', 'v1', '/data/input'), inputs: [target('artifact/spectrum'), target('artifact/method-note')], contributors: [{ actor: ref('actor/author'), role: 'author' }] },
    { output: target('task/material-017', 'v1', '/data/references/0/value'), inputs: [target('artifact/counts')], contributors: [{ actor: ref('actor/annotator'), role: 'annotator' }] },
    { output: target('task/material-017', 'v1', '/data/references/1/value'), inputs: [target('artifact/method-note')], contributors: [{ actor: ref('actor/expert'), role: 'rationale_author' }] }
  ]
});
asset('task-v1', '评测题目 v1', 'task/material-017', 'v1', '题干、答案、解析在同一个快照中；责任映射定位各字段。', 'task', taskData(1), 'activity/author');
activity('review-1a', '第 1 轮：领域审核要求修改', 'activity/review-1a', 'review', [['task', 'task/material-017'], ['rubric', 'evaluator/review']], [['reviewer-a', 'reviewer']], { method: method('procedure/review'), workflow: { run_id: 'production-017', stage: 'review', round: 1 } });
assessment('judgment-1a', 'v1：误差模型有歧义', 'assessment/review-1a', [['task/material-017', 'v1', '/data/input']], ['evaluator/review', 'v1', 'review_decision'], value('revise'), 'activity/review-1a', { rationale: { format: 'text/plain', inline: '共享校准偏移不可当作逐点独立噪声；当前问题不能唯一约束区间算法。' } });
activity('review-1b', '第 1 轮：计算审核同意', 'activity/review-1b', 'review', [['task', 'task/material-017'], ['rubric', 'evaluator/review']], [['reviewer-b', 'reviewer']], { method: method('procedure/review'), workflow: { run_id: 'production-017', stage: 'review', round: 1 } });
assessment('judgment-1b', 'v1：按现有脚本可计算', 'assessment/review-1b', [['task/material-017']], ['evaluator/review', 'v1', 'review_decision'], value('accept'), 'activity/review-1b', { rationale: { format: 'text/plain', inline: '现有脚本可给出数值；此结论不消除题干歧义。' } });
activity('adjudicate-1', '第 1 轮裁决并修订', 'activity/adjudicate-1', 'adjudicate', [['task', 'task/material-017'], ['opinion', 'assessment/review-1a'], ['opinion', 'assessment/review-1b']], [['adjudicator', 'adjudicator'], ['author', 'author']], {
  method: method('procedure/review'), workflow: { run_id: 'production-017', stage: 'adjudication', round: 1 },
  mappings: ['/data/input', '/data/references/1/value'].map(path => ({
    output: target('task/material-017', 'v2', path), inputs: [target('task/material-017', 'v1', path), target('assessment/review-1a')],
    contributors: [{ actor: ref('actor/author'), role: 'reviser' }]
  }))
});
assessment('decision-1', '裁决：补全生成与误差假设', 'assessment/decision-1', [['task/material-017']], ['evaluator/review', 'v1', 'review_decision'], value('revise'), 'activity/adjudicate-1');
const taskV2 = asset('task-v2', '评测题目 v2', 'task/material-017', 'v2', '修改题干与解析；旧审核依旧针对 v1。', 'task', taskData(2), 'activity/adjudicate-1');
taskV2.data.parents = [ref('task/material-017')];
for (const [suffix, person, verdict, reason] of [
  ['2a', 'reviewer-a', 'accept', '生成模型和共享校准误差已明确，题目语义可判定。'],
  ['2b', 'statistician', 'revise', '审核原计划把某一种区间算法的输出当唯一答案；应允许等价算法。']
]) {
  activity(`review-${suffix}`, `第 2 轮独立审核 ${suffix}`, `activity/review-${suffix}`, 'review', [['task', 'task/material-017', 'v2'], ['rubric', 'evaluator/review']], [[person, 'reviewer']], { method: method('procedure/review'), workflow: { run_id: 'production-017', stage: 'review', round: 2 } });
  assessment(`judgment-${suffix}`, `第 2 轮：${verdict === 'accept' ? '通过' : '质疑判分边界'}`, `assessment/review-${suffix}`, [['task/material-017', 'v2']], ['evaluator/review', 'v1', 'review_decision'], value(verdict), `activity/review-${suffix}`, { rationale: { format: 'text/plain', inline: reason } });
}
activity('adjudicate-2', '第 2 轮裁决：按明确容差验收', 'activity/adjudicate-2', 'adjudicate', [['task', 'task/material-017', 'v2'], ['opinion', 'assessment/review-2a'], ['opinion', 'assessment/review-2b'], ['verifier', 'evaluator/materials']], [['adjudicator', 'adjudicator']], { method: method('procedure/review', { accept_equivalent_algorithms: true }), workflow: { run_id: 'production-017', stage: 'adjudication', round: 2 } });
assessment('decision-2', 'v2 发布审查通过', 'assessment/decision-2', [['task/material-017', 'v2']], ['evaluator/review', 'v1', 'review_decision'], value('accept'), 'activity/adjudicate-2', { evidence: [{ target: target('assessment/review-2a') }, { target: target('assessment/review-2b') }], rationale: { format: 'text/plain', inline: '采用声明的解析基准与数值容差，允许等价算法；这是一项审核结论，不能保证 verifier 没有实现缺陷。' } });
activity('release-1', '冻结原评测发布', 'activity/release-1', 'release', [['task', 'task/material-017', 'v2'], ['approval', 'assessment/decision-2'], ['policy', 'policy/eval-only']], [['service', 'publisher']], { method: method('procedure/release', { revision_policy: 'immutable', repeat_policy: 'retain every attempt' }) });
add('eval-release-1', 'collection', '评测发布 r1', 'collection/materials-eval', 'r1', '冻结 task@v2、执行协议、隔离规则与审核证据。', {
  name: 'Synthetic Materials Eval', purpose: 'eval', members: [{ key: 'M017', target: ref('task/material-017', 'v2'), split: 'test' }],
  produced_by: ref('activity/release-1', 'done'), protocol: ref('procedure/execute'), policy: ref('policy/eval-only'), release_evidence: [ref('assessment/decision-2')]
});
['A', 'B'].forEach(name => asset(`model-${name.toLowerCase()}`, `虚构模型 ${name}`, `model/${name}`, 'v1', 'API 模型快照不能确认，明确标记 opaque。', 'model', { provider: 'fictional-provider', name: `Synthetic-${name}`, resolution: 'opaque' }));
for (const [key, model, state, answer] of [
  ['a1', 'A', 'failed', null], ['a2', 'A', 'completed', [{ phase_id: 'B', fraction: 0.37 }, { phase_id: 'A', fraction: 0.63 }]],
  ['b1', 'B', 'completed', [{ phase_id: 'A', fraction: 0.63 }, { phase_id: 'B', fraction: 0.37 }]]
]) {
  activity(`run-${key}`, `模型 ${model} 尝试 ${key}`, `activity/run-${key}`, 'rollout', [['task', 'task/material-017', 'v2'], ['release', 'collection/materials-eval', 'r1']], [['service', 'runner']], {
    state, method: method('procedure/execute', { temperature: 0.2, max_tool_steps: 80, seed: 17 }, { models: [{ role: 'candidate', model: ref(`model/${model}`) }], environments: [ref('environment/materials')] }),
    ...(key === 'a2' ? { retry_of: ref('activity/run-a1', 'done') } : {}),
    diagnostics: { format: 'application/json', inline: state === 'failed' ? { category: 'infra_error', reason: '容器磁盘挂载失败，模型尚未接收输入。' } : { completed: true, environment_observation: 'synthetic demonstration only' } }
  });
  if (answer) {
    asset(`response-${key}`, `候选结果 ${key}`, `response/${key}`, 'v1', '两个结果相比例相同，仅相顺序不同。', 'response', { context: target('task/material-017', 'v2'), content: { format: 'application/json', inline: { phases: answer, assumptions: ['shared calibration offset'], interval_A: [0.58, 0.68] } } }, `activity/run-${key}`);
    asset(`trace-${key}`, `执行轨迹 ${key}`, `trajectory/${key}`, 'v1', '只展示事件结构，未实际执行工具。', 'trajectory', { context: target('task/material-017', 'v2'), format: 'https://schema.example.invalid/demo/events-v1', events: { format: 'application/json', inline: [{ event_id: 'e1', type: 'observation', content: '读取输入' }, { event_id: 'e2', parent_event_id: 'e1', type: 'action', tool: 'terminal', content: '拟合并写出 answer.json' }, { event_id: 'e3', parent_event_id: 'e2', type: 'observation', content: '进程退出码 0' }] }, termination: { kind: 'terminated', reason: 'agent_finished' } }, `activity/run-${key}`);
  }
}
for (const [key, pass] of [['a1', null], ['a2', false], ['b1', true]]) {
  activity(`score-activity-${key}-v1`, `原 verifier 判分 ${key}`, `activity/score-${key}-v1`, 'score', [[key === 'a1' ? 'attempt' : 'response', key === 'a1' ? 'activity/run-a1' : `response/${key}`, key === 'a1' ? 'done' : 'v1'], ['task', 'task/material-017', 'v2'], ['evaluator', 'evaluator/materials']], [['service', 'evaluator']], { method: method('procedure/verify', { evaluator_revision: 'v1' }, { environments: [ref('environment/materials')] }) });
  assessment(`score-${key}-v1`, key === 'a1' ? 'a1：不可评分' : `${key}：原判分 ${pass ? '通过' : '未通过'}`, `assessment/score-${key}-v1`, [[key === 'a1' ? 'activity/run-a1' : `response/${key}`, key === 'a1' ? 'done' : 'v1']], ['evaluator/materials', 'v1', 'task_pass'], key === 'a1' ? { status: 'unavailable', reason: 'infra_error_before_model_input' } : value(pass), `activity/score-${key}-v1`);
}
activity('repair', '修复 verifier 的相顺序缺陷', 'activity/repair', 'transform', [['evaluator', 'evaluator/materials'], ['response', 'response/a2'], ['response', 'response/b1']], [['reviewer-b', 'verifier_maintainer']], { method: method('procedure/verify', { fix: 'compare_by_phase_id' }) });
const fixedEvaluator = asset('verifier-v2', '隐藏 verifier v2', 'evaluator/materials', 'v2', '按 phase_id 对齐，接受等价的输出排列；旧版仍保留。', 'evaluator', {
  method: ref('procedure/verify'), environment: ref('environment/materials'),
  criteria: [{ key: 'task_pass', description: '相同科学语义；修复不合理的排列约束', value_schema: 'https://schema.example.invalid/demo/boolean-v1' }],
  regression_cases: ['合法重排通过', '比例求和错误失败', '未知 phase_id 失败', '缺少误差假设失败']
}, 'activity/repair');
fixedEvaluator.data.parents = [ref('evaluator/materials')];
activity('rescore', '仅重评分，复用原始响应', 'activity/rescore', 'score', [['task', 'task/material-017', 'v2'], ['response', 'response/a2'], ['response', 'response/b1'], ['evaluator', 'evaluator/materials', 'v2']], [['service', 'evaluator']], { method: method('procedure/rescore', { rerun_model: false, replace_raw_response: false }, { environments: [ref('environment/materials')] }) });
for (const key of ['a2', 'b1']) assessment(`score-${key}-v2`, `${key}：修复后通过`, `assessment/score-${key}-v2`, [[`response/${key}`]], ['evaluator/materials', 'v2', 'task_pass'], value(true), 'activity/rescore', { evidence: [{ target: target(`response/${key}`) }], supersedes: [ref(`assessment/score-${key}-v1`)] });
activity('release-2', '审查输入等价并发布修复版本', 'activity/release-2', 'release', [['old_task', 'task/material-017', 'v2'], ['new_verifier', 'evaluator/materials', 'v2'], ['old_release', 'collection/materials-eval', 'r1'], ['prior_approval', 'assessment/decision-2']], [['adjudicator', 'reviewer'], ['service', 'publisher']], { method: method('procedure/rescore', { compare_paths: ['/data/input', '/data/environment', '/data/references'], reuse_scope: '历史响应可在新 verifier 下判分；不改写其 context。' }) });
const taskV3 = asset('task-v3', '评测题目 v3：仅更新 verifier 引用', 'task/material-017', 'v3', '题干、输入文件、环境和参考值保持不变。', 'task', taskData(2, 'v2'), 'activity/release-2');
taskV3.data.parents = [ref('task/material-017', 'v2')];
assessment('equivalence', 'v2 / v3 输入等价审查', 'assessment/input-equivalence', [['task/material-017', 'v2'], ['task/material-017', 'v3']], ['evaluator/review', 'v1', 'input_equivalence'], value(true), 'activity/release-2', { rationale: { format: 'text/plain', inline: '示例中比对指定路径相等。历史 response.context 仍然是 v2；如题干或初始状态改变则不可使用此复用规则。' } });
assessment('release-2-approval', 'v3 的显式发布资格判断', 'assessment/release-2-approval', [['task/material-017', 'v3']], ['evaluator/review', 'v1', 'review_decision'], value('accept'), 'activity/release-2', {
  evidence: [{ target: target('assessment/input-equivalence') }, { target: target('assessment/decision-2') }],
  rationale: { format: 'text/plain', inline: '明确复核旧审查适用的题干、参考内容及环境未变，并审查 verifier 修复；这是 v3 的新判断，不是把 v2 的审核引用自动迁移。' }
});
add('eval-release-2', 'collection', '评测发布 r2', 'collection/materials-eval', 'r2', '新冻结版本与旧 r1 并存；修复后的结果必须标注评分协议。', {
  parents: [ref('collection/materials-eval', 'r1')], name: 'Synthetic Materials Eval — repaired verifier', purpose: 'eval', members: [{ key: 'M017', target: ref('task/material-017', 'v3'), split: 'test' }],
  produced_by: ref('activity/release-2', 'done'), protocol: ref('procedure/rescore'), policy: ref('policy/eval-only'), release_evidence: [ref('assessment/input-equivalence'), ref('assessment/release-2-approval')]
});
activity('eligibility', '拒绝将评测族导出训练', 'activity/eligibility', 'review', [['eval_release', 'collection/materials-eval', 'r2'], ['trajectory', 'trajectory/a2'], ['policy', 'policy/eval-only']], [['service', 'policy_enforcer']], { method: method('procedure/eligibility', { propagate_restrictions: true }) });
assessment('train-block', '评测任务及其轨迹：禁止训练', 'assessment/train-block', [['task/material-017', 'v3'], ['trajectory/a2']], ['evaluator/policy', 'v1', 'training_eligibility'], value('blocked'), 'activity/eligibility', { rationale: { format: 'text/plain', inline: '评测来源的用途规则禁止训练；改名、换 split、改写提示词均不能解除来源约束。' } });
activity('generate-train', '生成独立训练 sibling', 'activity/generate-train', 'author', [['generator', 'procedure/generate'], ['policy', 'policy/training']], [['author', 'author'], ['service', 'generator']], { method: method('procedure/generate', { independent_parameters: { mixture: [0.28, 0.72], calibration_offset: 0.015, seed: 9131 }, source_family: 'train-materials-family-204', receives_eval_answers: false }) });
asset('training-task', '独立训练题 T204', 'task/train-204', 'v1', '共享能力类别，使用独立合成输入与独立来源族；没有引用评测题内容。', 'task', {
  profile: 'https://schema.example.invalid/demo/materials-terminal-v1', input: { messages: [{ role: 'user', content: { format: 'text/plain', inline: '分析独立合成批次 T204；两相混合、独立生成参数和计数，输出比例与模型假设。' } }] },
  references: [{ key: 'answer', role: 'answer', audience: 'curator', value: { format: 'application/json', inline: { phase_A: 0.28, phase_B: 0.72 } } }],
  environment: ref('environment/materials'), lineage_key: 'train-materials-family-204'
}, 'activity/generate-train');
activity('train-review', '审查独立来源与候选', 'activity/train-review', 'review', [['task', 'task/train-204'], ['policy', 'policy/training'], ['eval_members', 'collection/materials-eval', 'r2']], [['reviewer-a', 'reviewer']], { method: method('procedure/eligibility', { checks: ['source authorization', 'separate lineage', 'near duplicate screen', 'evaluation exposure audit'], demonstration_results: 'all accepted; synthetic scenario only' }) });
assessment('train-allow', 'T204：训练导出资格通过', 'assessment/train-allow', [['task/train-204']], ['evaluator/policy', 'v1', 'training_eligibility'], value('allowed'), 'activity/train-review', { rationale: { format: 'text/plain', inline: '合成案例设定审查通过。实际应用需要具体检测证据；不同 seed 或不同 lineage_key 本身不能证明无污染。' } });
activity('train-rollout', '生成训练题的两个候选', 'activity/train-rollout', 'rollout', [['task', 'task/train-204']], [['service', 'runner']], { method: method('procedure/execute', { candidates: 2 }, { models: [{ role: 'candidate', model: ref('model/A') }], environments: [ref('environment/materials')] }) });
for (const [key, text] of [['good', 'phase_A=0.28；phase_B=0.72。说明共享校准误差和归一化步骤。'], ['bad', 'phase_A=0.28；phase_B=0.82。两相比例之和为 1.10。']]) asset(`train-${key}`, `T204 候选：${key}`, `response/train-${key}`, 'v1', '两个候选共享同一具体上下文。', 'response', { context: target('task/train-204'), content: { format: 'text/plain', inline: text } }, 'activity/train-rollout');
activity('compare', '人工判定正确性与偏好', 'activity/compare', 'annotate', [['task', 'task/train-204'], ['candidate', 'response/train-good'], ['candidate', 'response/train-bad'], ['rubric', 'evaluator/preference']], [['expert', 'annotator']], { method: method('procedure/review', { preference_rule: '先比较物理约束与正确性，再比较解释完整度' }) });
assessment('train-correct', 'good 候选的独立正确性判断', 'assessment/train-correct', [['task/train-204'], ['response/train-good']], ['evaluator/preference', 'v1', 'answer_correctness'], value(true), 'activity/compare');
assessment('preference', 'T204 偏好：good 优于 bad', 'assessment/preference', [['task/train-204'], ['response/train-good'], ['response/train-bad']], ['evaluator/preference', 'v1', 'preference'], value({ winner: ref('response/train-good') }), 'activity/compare', { evidence: [{ target: target('assessment/train-correct') }], rationale: { format: 'text/plain', inline: '被拒候选违反归一化条件。chosen 的正确性来自单独判断，不从偏好标签推断。' } });
activity('export', '导出 SFT 与 DPO 视图', 'activity/export', 'export', [['task', 'task/train-204'], ['eligibility', 'assessment/train-allow'], ['correctness', 'assessment/train-correct'], ['preference', 'assessment/preference'], ['chosen', 'response/train-good'], ['rejected', 'response/train-bad']], [['service', 'exporter']], { method: method('procedure/export', { sft_loss: 'completion_only', dpo_context: 'identical', include_hidden_eval_materials: false, tokenizer: 'illustrative-tokenizer-contract-v1' }) });
asset('sft', 'T204 的 SFT 样本', 'training/sft-204', 'v1', '训练格式是可重建投影，保留源与选择依据。', 'training_example', {
  format: 'https://schema.example.invalid/demo/sft-v1', record: { format: 'application/json', inline: { prompt: 'T204 input', completion: '0.28 / 0.72 + explanation', loss_mask: 'completion_only' } },
  sources: [target('task/train-204'), target('response/train-good')], selection_evidence: [ref('assessment/train-allow'), ref('assessment/train-correct')]
}, 'activity/export');
asset('dpo', 'T204 的 DPO 样本', 'training/dpo-204', 'v1', '共同上下文、原始两个候选和偏好判断均保留。', 'training_example', {
  format: 'https://schema.example.invalid/demo/dpo-v1', record: { format: 'application/json', inline: { prompt: 'T204 input', chosen: '0.28 / 0.72 + explanation', rejected: '0.28 / 0.82' } },
  sources: [target('task/train-204'), target('response/train-good'), target('response/train-bad')], selection_evidence: [ref('assessment/train-allow'), ref('assessment/preference')]
}, 'activity/export');
add('train-release', 'collection', '训练发布 r1', 'collection/materials-train', 'r1', '两种派生训练视图纳入版本化集合；没有 eval 族成员。', {
  name: 'Synthetic Materials Training Views', purpose: 'train', members: [{ key: 'T204-sft', target: ref('training/sft-204'), split: 'train' }, { key: 'T204-dpo', target: ref('training/dpo-204'), split: 'train' }],
  produced_by: ref('activity/export', 'done'), protocol: ref('procedure/export'), policy: ref('policy/training'), release_evidence: [ref('assessment/train-allow')]
});

// Access rules are explicit in the data. The public page contains only this
// invented case, not genuine sealed benchmark answers or verifier files.
for (const row of records) {
  if (row.kind !== 'asset') continue;
  if (['task-v1', 'task-v2', 'task-v3', 'verifier-v1', 'verifier-v2', 'response-a2', 'response-b1', 'trace-a2', 'trace-b1'].includes(row.id)) {
    row.data.access = { visibility: 'restricted', policy: ref('policy/eval-only') };
  } else if (['training-task', 'train-good', 'train-bad', 'sft', 'dpo'].includes(row.id)) {
    row.data.access = { visibility: 'restricted', policy: ref('policy/training') };
  }
}

const stage = (id, title, eyebrow, summary, activity, asset, assessment, collection, participants, facts, links, recordKey) => ({
  id, title, eyebrow, summary, activity, asset, assessment, collection,
  participants: participants.map(([name, role]) => ({ name, role })), facts,
  links: links.map(([from, to, label]) => ({ from, to, label })),
  record: records.find(r => r.id === recordKey)?.data ?? {}
});

export const caseStudy = {
  title: '一题，跨越构造、冲突、失败、修复与两种训练格式',
  subtitle: '材料科学 × 多模态 × 终端 Agent｜12 个阶段的合成压力案例',
  description: '全部人物、数据、时间、分数与执行结果均为虚构。它验证概念能否清楚表达复杂事实，不代表运行过真实实验、模型或容器。JSON 为简化展示记录，不是完整 v3 schema 的可执行样本。',
  stages: [
    stage('sources', '三种来源，一次可追溯导入', '01 / INPUT', '图像、计数表、方法说明分别保留原始身份；不能只留下拼接后的 prompt。', 'import：记录导入者与录入时间', '3 个 source Artifact', '尚无正确性判断', '尚未发布', [['流程服务', 'importer']], ['原始来源定位到具体模态和文件。', '导入时间不冒充实验构造时间。', '展示文件均为占位，不伪造实际 hash。'], [['import', 'source-spectrum', '导入'], ['import', 'source-data', '导入'], ['import', 'source-method', '导入']], 'source-data'),
    stage('author', '三位贡献者，字段级责任', '02 / CONSTRUCT', '领域作者写题干，数值标注员写答案，专家写解析；Task 保持一个可读的内容树。', 'author + FieldMapping', 'task@v1', '尚未审核', '尚未发布', [['林', '题干作者'], ['周', '答案标注员'], ['陈', '解析专家']], ['每个产物路径连接输入片段与实际责任人。', '不用把题干、答案、解析强制拆成三张表。', '参考答案值本身不是正确性证明。'], [['source-data', 'author', '数值来源'], ['source-method', 'author', '方法来源'], ['author', 'task-v1', '构造']], 'author'),
    stage('review-1', '第 1 轮：两种意见发生冲突', '03 / DISAGREE', '领域审核认为误差模型不充分；计算审核认为脚本可运行。两项判断同时保留。', '两次独立 review', '仍为 task@v1', 'revise + accept 并存', '尚未发布', [['沈', '领域审核员'], ['顾', '计算审核员']], ['每条意见绑定自己的作者、时间、准则与精确输入。', '不能用最后写入的 accept 覆盖 revise。', '程序可执行不等于题目无歧义。'], [['task-v1', 'review-1a', '审核输入'], ['task-v1', 'review-1b', '审核输入'], ['review-1a', 'judgment-1a', '要求修改'], ['review-1b', 'judgment-1b', '同意']], 'judgment-1a'),
    stage('revise', '裁决生成 v2，v1 永久保留', '04 / REVISE', '裁决要求明确共享校准偏移，并同步修订题干和解析。新版本重新进入审核。', 'adjudicate：读取两项冲突证据', 'task@v2，parents=[v1]', 'v1 的最终结论：revise', '尚未发布', [['唐', '裁决专家'], ['林', '修订作者']], ['修订理由可追溯到冲突意见。', '旧审核不自动变成 v2 的审核。', '历史查询仍可完整复原 v1。'], [['judgment-1a', 'adjudicate-1', '冲突意见'], ['judgment-1b', 'adjudicate-1', '冲突意见'], ['adjudicate-1', 'task-v2', '新快照']], 'task-v2'),
    stage('review-2', '第 2 轮：对判分边界再裁决', '05 / ADJUDICATE', '领域审核接受新题干；统计审核质疑唯一算法要求。裁决明确允许等价算法，以声明的容差验收。', '两次 review + 一次 adjudicate', 'task@v2 不被拼接或覆盖', '接受意见、修改意见、最终采用结论并存', '形成发布证据', [['沈', '领域审核员'], ['许', '统计审核员'], ['唐', '裁决专家']], ['判断保存不同层次的证据，不能只留 approved=true。', '采用策略声明最终用了哪条结论。', '审核通过也不保证 verifier 的实现无缺陷。'], [['task-v2', 'review-2a', '再次审核'], ['task-v2', 'review-2b', '再次审核'], ['judgment-2a', 'adjudicate-2', '意见 A'], ['judgment-2b', 'adjudicate-2', '意见 B'], ['adjudicate-2', 'decision-2', '裁决']], 'decision-2'),
    stage('freeze', '冻结评测发布与隐藏边界', '06 / FREEZE', '发布固定题目、环境、verifier、执行协议与用途规则。Agent 只接收过滤后的输入投影。', 'release：审查证据与策略', '环境 v1 + verifier v1 + task v2', '采用 decision-2', 'eval release r1', [['流程服务', 'publisher']], ['frozen 成员没有 latest 引用。', '隐藏答案与 verifier 不挂载到 Agent 环境。', 'test split 不代表权限；禁止训练来自明确 policy。'], [['task-v2', 'eval-release-1', '固定成员'], ['environment', 'task-v2', '执行环境'], ['verifier-v1', 'task-v2', '评测引用'], ['decision-2', 'eval-release-1', '发布证据']], 'eval-release-1'),
    stage('attempts', '三个尝试：基础设施失败不是零分', '07 / EXECUTE', '模型 A 的首次运行在输入前挂载失败；重试生成合法但相顺序反转的答案。模型 B 生成同值的另一排列。', 'a1 failed；a2 / b1 completed', '两份 Response + 两份 Trajectory', '尚未判分', '仍固定 eval r1', [['流程服务', 'runner'], ['虚构模型 A / B', 'candidate']], ['重试是新 Activity，保留 retry_of。', '失败尝试保留诊断，不虚构 response。', '模型 revision 不可确认时标记 opaque。'], [['eval-release-1', 'run-a1', '尝试'], ['run-a1', 'run-a2', 'retry_of'], ['run-a2', 'response-a2', '产物'], ['eval-release-1', 'run-b1', '尝试'], ['run-b1', 'response-b1', '产物']], 'run-a1'),
    stage('score', '同一语义，却出现不同分数', '08 / SCORE', 'verifier v1 错把相的数组排列当语义，a2 被判未通过、b1 通过。a1 保留 unavailable。', '各尝试独立 score', '原始 Response 不改写', 'a1 unavailable；a2 false；b1 true', '报告必须声明有效分母与覆盖率', [['流程服务', 'evaluator']], ['completed 和 task_pass 是不同维度。', '无法评分不是 value=0。', '这里只是单题演示，不从 3 次尝试推断模型能力排名。'], [['response-a2', 'score-a2-v1', 'verifier v1'], ['response-b1', 'score-b1-v1', 'verifier v1'], ['run-a1', 'score-a1-v1', '无法评分']], 'score-a1-v1'),
    stage('rescore', '修复评测器，无需重跑模型', '09 / RE-SCORE', '新 verifier 按 phase_id 对齐；重用原始输出得到 a2、b1 均通过。旧判断留存。', 'transform verifier + score', 'evaluator@v2；Response 字节不变', '新 Assessment 显式 supersedes 旧分数', '旧发布内容保持可复原', [['顾', 'verifier maintainer'], ['流程服务', 'evaluator']], ['重评分依赖完整原始响应与输入上下文。', '仅改分数列会丢失当时评分方法。', 'verifier 回归样例在本案例中是设计记录，未声称执行。'], [['verifier-v1', 'repair', '修复'], ['repair', 'verifier-v2', '新版本'], ['response-a2', 'rescore', '原响应'], ['verifier-v2', 'rescore', '新判据'], ['rescore', 'score-a2-v2', '新判断']], 'score-a2-v2'),
    stage('release-2', '新发布保留与旧发布的边界', '10 / VERSION', 'task v3 只更新 verifier 引用。明确审查输入等价后发布 r2；历史 rollout 的 context 仍是 task v2。', 'release + 输入等价审查', 'task@v3；parents=[v2]', 'input_equivalence=true', 'r1 与 r2 同时可查询', [['唐', 'reviewer'], ['流程服务', 'publisher']], ['不得把旧执行的 task_ref 偷换成 v3。', '新报告标注 verifier v2 与历史输出复用规则。', '如果题干、图像或初始状态改变，必须重新判断可复用性。'], [['task-v2', 'task-v3', '只更新评测引用'], ['task-v3', 'eval-release-2', '新冻结成员'], ['equivalence', 'eval-release-2', '复用依据'], ['eval-release-1', 'eval-release-2', '新发布版本']], 'equivalence'),
    stage('isolation', '堵住污染路径，再生成训练 sibling', '11 / GOVERN', '评测题及其轨迹被拒绝训练。另用独立来源与参数生成 T204，通过用途、近重复与暴露检查。', 'eligibility + generate + review', '独立 task/train-204', 'eval blocked；T204 allowed', '评测与训练成员分离', [['流程服务', 'policy enforcer'], ['林', 'author'], ['沈', 'reviewer']], ['换 split、换名字、仅换 seed 都不足以解除污染。', '独立来源族加上检测证据，才支持训练资格判断。', '评测轨迹不能被直接转成训练样本。'], [['eval-release-2', 'train-block', '禁止训练'], ['generate-train', 'training-task', '独立构造'], ['training-task', 'train-review', '隔离审查'], ['train-review', 'train-allow', '允许导出']], 'train-block'),
    stage('export', '一份训练题，两种可追溯视图', '12 / PROJECT', 'T204 产生两个候选：分别记录正确性与偏好，再导出 SFT 和 DPO。原始信息仍然保留。', 'rollout → annotate → export', 'Response → training_example', '正确性与 preference 独立', 'train release r1', [['陈', 'annotator'], ['流程服务', 'exporter']], ['DPO 两个候选共享 task/train-204@v1。', 'SFT 的目标和 loss-mask 来自版本化导出配方。', '训练集合中不含任何 eval 族内容。'], [['training-task', 'train-good', '共同上下文'], ['training-task', 'train-bad', '共同上下文'], ['preference', 'export', '选择依据'], ['export', 'sft', 'SFT 投影'], ['export', 'dpo', 'DPO 投影'], ['sft', 'train-release', '冻结成员'], ['dpo', 'train-release', '冻结成员']], 'dpo')
  ],
  stressTests: [
    { id: 'conflict', label: '审核员意见相反', trigger: '同一个 v1 同时得到 accept 与 revise。', before: '单个 approved 字段只能覆盖或含糊合并。', after: '保留两项独立判断；裁决引用两者并说明采用原因。', rule: 'Assessment 是可争议主张，不是内容自身的属性。', affected: ['Activity', 'Assessment'] },
    { id: 'revision', label: '只改一个关键字段', trigger: '共享校准误差假设被补充。', before: '“最新题干 + 旧审核”可能形成从未审核过的组合。', after: 'Task 产生新 revision；旧意见继续指向旧版本，新版重新审查。', rule: '引用精确快照；不默默继承审核。', affected: ['Asset', 'Activity', 'Assessment'] },
    { id: 'infra', label: '运行失败但模型没答错', trigger: '容器挂载失败发生在模型获得输入之前。', before: '直接写 score=0 会混淆平台可靠性与模型能力。', after: 'Activity=failed；评分 unavailable；重试独立保留。', rule: '运行状态、任务正确性、覆盖率分别表达。', affected: ['Activity', 'Assessment'] },
    { id: 'judge', label: '评测器自身出错', trigger: '合法输出因 phase 数组排列被误拒。', before: '覆盖原 score 后无法解释历史榜单差异。', after: 'verifier 新版本 + 新判断 + supersedes；复用原始响应。', rule: '评分是带判据版本的派生判断。', affected: ['Asset', 'Activity', 'Assessment'] },
    { id: 'freeze', label: '发布后修复一题', trigger: 'Task 更新为 v3，只替换 evaluator 引用。', before: 'latest 成员会让同一发布编号的内容漂移。', after: '新 Collection r2；r1 继续引用 task v2。', rule: '冻结集合固定成员版本与协议。', affected: ['Asset', 'Collection'] },
    { id: 'leakage', label: '把 test 改成 train', trigger: '希望把高分评测轨迹直接用于 SFT。', before: '只检查 split 会允许改名绕过。', after: '用途限制沿来源传播，导出拒绝；独立 sibling 须另审。', rule: 'split 不是权限；lineage_key 不是无污染证明。', affected: ['Asset', 'Assessment', 'Collection'] },
    { id: 'preference', label: '偏好被误当真值', trigger: '候选 A 被选为 chosen。', before: '默认 chosen=correct 混淆两个不同判断。', after: '保存 preference 与 answer_correctness 两个 criterion。', rule: '不同评价目标不共享隐含语义。', affected: ['Assessment'] },
    { id: 'provenance', label: '多人合写同一道题', trigger: '题干、答案、解析分别由不同人员负责。', before: 'authors=[甲,乙,丙] 不能定位各字段责任。', after: '一个 Task 内容树 + mappings 指向字段、来源与责任人。', rule: '按需要追踪字段，不强制把每个字段变成独立实体。', affected: ['Asset', 'Activity'] }
  ],
  questions: [
    { question: '谁写了答案？依据是什么？', answer: 'activity/author 的映射将 answer 字段连接到计数 CSV，贡献者是数值标注员周。题干与解析分别有不同责任人。', evidence: ['author', 'source-data', 'task-v1'] },
    { question: '为什么题目最终被接纳？', answer: '发布 r1 采用第二轮裁决 decision-2。它引用两项冲突意见并声明等价算法的验收边界，未删除反对意见。', evidence: ['judgment-2a', 'judgment-2b', 'decision-2', 'eval-release-1'] },
    { question: '模型 A 有三个结果吗？', answer: 'A 只有两个尝试：a1 为基础设施失败，a2 产生一个响应。a2 的两项分数来自两个 verifier 版本，不是两次模型回答。', evidence: ['run-a1', 'run-a2', 'response-a2', 'score-a2-v1', 'score-a2-v2'] },
    { question: '为什么不能直接比较修复前后的分数？', answer: '判分程序发生变化。比较必须显式固定或分别披露 evaluator revision、尝试选择规则与未评分处理，不能把同名指标当相同测量。', evidence: ['verifier-v1', 'verifier-v2', 'score-a2-v1', 'score-a2-v2'] },
    { question: '新发布是否偷偷换了历史输入？', answer: '没有。历史 response 的 context 仍指向 task v2；新发布引用 v3，并单独保存输入等价审查。若内容变化，此复用结论不成立。', evidence: ['response-a2', 'task-v3', 'equivalence', 'eval-release-2'] },
    { question: '训练题是不是评测题换了名字？', answer: '合成情境中，T204 来自独立生成活动与来源族，不引用评测内容；用途、近重复与暴露审查另行记录。只有换 seed 或 lineage_key 不足以作证。', evidence: ['train-block', 'generate-train', 'training-task', 'train-allow'] },
    { question: '为什么四个主干足够表达这个案例？', answer: '复杂性来自四种关系的组合：内容版本、处理历史、独立判断与冻结成员。案例没有因增加审核轮次、模型或训练格式而增加第五种顶层职责。它仍需要强类型 profile 和关系约束。', evidence: ['task-v2', 'author', 'decision-2', 'eval-release-1'] }
  ],
  records
};

export default caseStudy;
