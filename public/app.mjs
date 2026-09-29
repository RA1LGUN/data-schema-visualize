import { schemaGroups, profiles, invariants } from './schema-data.mjs';
import { caseStudy } from './case-data.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const json = value => JSON.stringify(value, null, 2);
const pad = number => String(number).padStart(2, '0');
const short = (text, length = 16) => [...String(text)].length > length ? [...String(text)].slice(0, length - 1).join('') + '…' : text;
const labels = {asset:'ASSET · 内容',activity:'ACTIVITY · 过程',assessment:'ASSESSMENT · 判断',collection:'COLLECTION · 集合'};
const requirements = {required:'必选',conditional:'条件必选',optional:'可选'};
const records = new Map(caseStudy.records.map(record => [record.id, record]));
const state = {group:'asset',field:'data.input.messages',profile:'qa',stage:0,stress:0,record:null};

const concepts = {
  asset:{title:'保存当时的内容，而不是覆盖后的“最新版”。',body:'题干、答案与解析放在一个可读的 Task 快照中。环境、模型、轨迹也是内容，但使用各自的类型契约。',example:'task/Q1@v2 → input + references + environment',note:'答案“42”是一份参考内容；它是否正确，由独立的判断说明。'},
  activity:{title:'让每一次处理，都有主体、方法和时间。',body:'同一套结构记录人工构造、标注审核、模型运行与训练导出。一个人的角色跟随具体活动，而不是永久固定。',example:'review/R2 → inputs + participants + method + time',note:'活动 completed 表示执行结束；审核否决、模型答错也可以正常结束。'},
  assessment:{title:'把结论与内容分开，保留分歧与依据。',body:'标签、偏好、审核结论和测试分数都绑定具体对象、版本与 criterion。新的判断不会静默抹掉旧的判断。',example:'J2 → subject: Q1@v2 / answer → correctness: true',note:'相同轨迹可以被不同评测器评价；不同指标即使都是数字，也不能随意平均。'},
  collection:{title:'冻结选择，才能复原一次发布或实验。',body:'集合保存成员的精确版本、用途、split 和权重。train/test 属于成员关系；任务本身不带永久的训练或评测身份。',example:'expert-eval@r2 → [Q1@v2, Q2@v1, …]',note:'进入一个集合不自动获得训练权限；用途许可与污染隔离由明确规则判定。'}
};

function selectConcept(id) {
  if (!concepts[id]) return;
  $$('.concept-card').forEach(button => {
    const selected = button.dataset.concept === id;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const concept = concepts[id];
  const panel = $('#concept-detail');
  panel.className = `concept-detail ${id}`;
  panel.innerHTML = `<div><h3>${escape(concept.title)}</h3><p>${escape(concept.body)}</p></div><div class="example-code"><code>${escape(concept.example)}</code><small>${escape(concept.note)}</small></div>`;
}
$$('[data-concept]').forEach(button => button.addEventListener('click', () => selectConcept(button.dataset.concept)));
selectConcept('asset');

function renderFields() {
  const group = schemaGroups.find(item => item.id === state.group);
  const query = $('#field-search').value.trim().toLowerCase();
  const requirement = $('#required-filter').value;
  const aliases = {reviewer:'审核',annotator:'标注',score:'评分',time:'时间',model:'模型',dependency:'依赖'};
  const alternative = aliases[query];
  const fields = group.fields.filter(field => {
    const text = `${field.path} ${field.type} ${field.description} ${field.condition ?? ''}`.toLowerCase();
    return (!query || text.includes(query) || (alternative && text.includes(alternative))) && (requirement === 'all' || field.required === requirement);
  });
  if (!fields.some(field => field.path === state.field)) state.field = fields[0]?.path ?? null;
  $('#schema-tabs').innerHTML = schemaGroups.map(item => `<button class="tab" data-group="${item.id}" aria-pressed="${item.id === state.group}">${escape(item.english)} <span>${escape(item.name)}</span></button>`).join('');
  $('#field-tree').innerHTML = `<div class="tree-root">${escape(group.english)}<span class="mono">{ }</span></div>` + (fields.length ? fields.map(field => {
    const depth = Math.min(field.path.split('.').length - 1, 2);
    return `<button class="field-row ${field.path === state.field ? 'selected' : ''}" data-field="${escape(field.path)}" aria-pressed="${field.path === state.field}"><span class="field-branch">${'  '.repeat(depth)}├</span><span class="req-dot ${field.required}" aria-hidden="true"></span><span class="sr-only">${requirements[field.required]}</span><span class="field-name">${escape(field.path)}</span><span class="field-type">${escape(field.type)}</span></button>`;
  }).join('') : '<div class="empty-state">没有匹配字段。试试“时间”“审核”或切换对象类型。</div>');
  $('#schema-counter').textContent = `${fields.length} / ${group.fields.length} 字段`;
  renderFieldDetail(group.fields.find(field => field.path === state.field), group);
}
function renderFieldDetail(field, group) {
  if (!field) {
    $('#field-inspector').innerHTML = `<div class="eyebrow">${escape(group.english.toUpperCase())}</div><h3 class="field-path">${escape(group.question)}</h3><p>${escape(group.summary)}</p>`;
    return;
  }
  $('#field-inspector').innerHTML = `<div class="eyebrow">${escape(group.english.toUpperCase())} / ${requirements[field.required]}</div><h3 class="field-path">${escape(field.path)}</h3><span class="type-label">${escape(field.type)}</span><p>${escape(field.description)}</p>${field.condition ? `<div class="field-condition"><strong>触发条件</strong><br>${escape(field.condition)}</div>` : ''}${field.example ? `<pre aria-label="字段示例">${escape(typeof field.example === 'object' ? json(field.example) : field.example)}</pre>` : ''}`;
}
$('#schema-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-group]');
  if (!button) return;
  state.group = button.dataset.group;
  state.field = null;
  renderFields();
});
$('#field-tree').addEventListener('click', event => {
  const button = event.target.closest('[data-field]');
  if (!button) return;
  state.field = button.dataset.field;
  $$('.field-row').forEach(item => {
    item.classList.toggle('selected', item.dataset.field === state.field);
    item.setAttribute('aria-pressed', String(item.dataset.field === state.field));
  });
  const group = schemaGroups.find(item => item.id === state.group);
  renderFieldDetail(group.fields.find(item => item.path === state.field), group);
});
$('#field-search').addEventListener('input', renderFields);
$('#required-filter').addEventListener('change', renderFields);
renderFields();

function renderProfile() {
  const profile = profiles.find(item => item.id === state.profile) ?? profiles[0];
  $('#profile-tabs').innerHTML = profiles.map(item => `<button class="chip" data-profile="${item.id}" aria-pressed="${item.id === profile.id}">${escape(item.name)}</button>`).join('');
  $('#profile-detail').innerHTML = `<p class="profile-description">${escape(profile.summary)}</p><div class="profile-lists"><div><span class="profile-list-title">该场景需要</span><ul>${profile.required.map(item => `<li>${escape(item)}</li>`).join('')}</ul></div><div><span class="profile-list-title">可以省略 / 明确未知</span><ul>${profile.optional.map(item => `<li>${escape(item)}</li>`).join('')}</ul></div></div><div class="profile-example">${escape(profile.example)}</div>`;
}
$('#profile-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-profile]');
  if (!button) return;
  state.profile = button.dataset.profile;
  renderProfile();
});
renderProfile();

function renderGraph(links) {
  const ids = [...new Set(links.flatMap(link => [link.from, link.to]))];
  if (!ids.length) { $('#case-graph').innerHTML = '<p class="graph-empty">此阶段没有新增关系。</p>'; return; }
  const depths = new Map(ids.map(id => [id, 0]));
  for (let i = 0; i < ids.length; i++) {
    let changed = false;
    for (const {from,to} of links) {
      if (depths.get(to) <= depths.get(from)) { depths.set(to, Math.min(ids.length - 1, depths.get(from) + 1)); changed = true; }
    }
    if (!changed) break;
  }
  // Stage links are a small, acyclic explanation slice, not the entire reference graph.
  const levels = [...new Set(depths.values())].sort((a,b) => a-b);
  const columns = levels.map(depth => ids.filter(id => depths.get(id) === depth));
  const width = columns.length * 267 + 18;
  const height = Math.max(1, ...columns.map(column => column.length)) * 107 + 18;
  const positions = new Map();
  columns.forEach((column, x) => column.forEach((id,y) => positions.set(id,{x:x*267+13,y:y*107+(height-column.length*107)/2+7})));
  const paths = links.map(link => {
    const a = positions.get(link.from), b = positions.get(link.to);
    const startX = a.x+199, startY = a.y+39, endX=b.x, endY=b.y+39;
    const bend = Math.max(24, (endX-startX)*.5);
    return `<path class="edge" d="M ${startX} ${startY} C ${startX+bend} ${startY}, ${endX-bend} ${endY}, ${endX-5} ${endY}" marker-end="url(#case-arrow)"/><text class="edge-label" x="${(startX+endX)/2}" y="${(startY+endY)/2-8}" text-anchor="middle">${escape(short(link.label,10))}</text>`;
  }).join('');
  const nodes = ids.map(id => {
    const record = records.get(id), position = positions.get(id);
    if (!record) throw new Error(`Unresolved case graph record: ${id}`);
    return `<g class="graph-node ${record.kind}" data-record="${escape(id)}" tabindex="0" role="button" aria-label="查看记录：${escape(record.title)}" transform="translate(${position.x},${position.y})"><title>${escape(record.title)} · ${escape(record.data.id)}@${escape(record.revision)}</title><rect width="199" height="78" rx="6"/><text x="13" y="20" class="node-type">${escape(record.kind.toUpperCase())} / ${escape(record.revision)}</text><text x="13" y="41" class="node-title">${escape(short(record.title,14))}</text><text x="13" y="62" class="node-id">${escape(short(record.data.id,29))}</text></g>`;
  }).join('');
  $('#case-graph').innerHTML = `<svg class="graph-svg" style="min-width:${Math.min(width,850)}px" viewBox="0 0 ${width} ${height}" role="group" aria-label="当前阶段的记录关系图，可点选节点"><defs><marker id="case-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 7 4 L 1 7" fill="none" stroke="#9aa9bb" stroke-width="1.3"/></marker></defs>${paths}${nodes}</svg>`;
}

function renderStage({scrollStep=false}={}) {
  const stage = caseStudy.stages[state.stage];
  $('#stage-count').textContent = `${pad(state.stage+1)} / ${caseStudy.stages.length}`;
  $('#stage-eyebrow').textContent = stage.eyebrow.replace(/^\d+\s*\/\s*/, '');
  $('#stage-progress-fill').style.width = `${(state.stage+1)/caseStudy.stages.length*100}%`;
  $('#stage-prev').disabled = state.stage === 0;
  $('#stage-next').disabled = state.stage === caseStudy.stages.length-1;
  $('#stage-steps').innerHTML = caseStudy.stages.map((item,index) => `<button class="stage-step" data-stage="${index}" aria-pressed="${index === state.stage}" aria-label="阶段 ${index+1}：${escape(item.title)}"><span>${pad(index+1)}</span>${escape(short(item.title,9))}</button>`).join('');
  $('#stage-title').textContent = stage.title;
  $('#stage-summary').textContent = stage.summary;
  $('#stage-participants').innerHTML = stage.participants.map(person => `<span class="person"><b>${escape(person.name)}</b><span>${escape(person.role)}</span></span>`).join('');
  $('#stage-facts').innerHTML = stage.facts.map(fact => `<li>${escape(fact)}</li>`).join('');
  $('#stage-objects').innerHTML = ['asset','activity','assessment','collection'].map(kind => `<div class="stage-object ${kind}"><span class="mono">${labels[kind]}</span><p>${escape(stage[kind])}</p></div>`).join('');
  $('#stage-json').textContent = json(stage.record);
  renderGraph(stage.links);
  if (scrollStep) {
    const scroller=$('#stage-steps'), active=scroller.querySelector('[aria-pressed=true]');
    scroller.scrollTo({left:Math.max(0,active.offsetLeft-scroller.offsetLeft-scroller.clientWidth/2+active.clientWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
}
$('#case-title').textContent = '复现一项材料实验，并交付可验证结果。';
$('#case-description').textContent = caseStudy.subtitle || '从图像、计数表和方法说明出发，完成数值分析、代码实现与实验解释。每次修订、审核和执行都留下可定位的记录。';
const requestedStage = Number(new URL(location.href).searchParams.get('stage'));
if (Number.isInteger(requestedStage) && requestedStage >= 1 && requestedStage <= caseStudy.stages.length) state.stage = requestedStage - 1;
$('#stage-prev').addEventListener('click', () => {if(state.stage>0){state.stage--;renderStage({scrollStep:true});}});
$('#stage-next').addEventListener('click', () => {if(state.stage<caseStudy.stages.length-1){state.stage++;renderStage({scrollStep:true});}});
$('#stage-steps').addEventListener('click',event => {const button=event.target.closest('[data-stage]');if(button){state.stage=Number(button.dataset.stage);renderStage({scrollStep:true});}});
renderStage();

function openRecord(id) {
  const record=records.get(id);
  if(!record) return;
  state.record=record;
  $('#dialog-kind').textContent=labels[record.kind];
  $('#dialog-title').textContent=record.title;
  $('#dialog-description').textContent=record.description;
  $('#dialog-json').textContent=json(record.data);
  $('#record-dialog').showModal();
}
$('#case-graph').addEventListener('click',event => {const node=event.target.closest('[data-record]');if(node)openRecord(node.dataset.record);});
$('#case-graph').addEventListener('keydown',event => {if(event.key==='Enter'||event.key===' '){const node=event.target.closest('[data-record]');if(node){event.preventDefault();openRecord(node.dataset.record);}}});
$('#close-dialog').addEventListener('click',()=>$('#record-dialog').close());
$('#record-dialog').addEventListener('click',event=>{if(event.target===$('#record-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2500);}
$('#copy-record').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(json(state.record.data));toast('记录已复制');}catch{toast('浏览器未开放剪贴板，可直接选择记录文本复制。');}});

$('#audit-questions').innerHTML=caseStudy.questions.map((item,index)=>`<details class="qa-item" ${index===0?'open':''}><summary>${escape(item.question)}</summary><p>${escape(item.answer)}</p><div class="evidence-links">${item.evidence.map(id=>`<button class="evidence-link" data-record="${escape(id)}">${escape(id)} ↗</button>`).join('')}</div></details>`).join('');
$('#audit-questions').addEventListener('click',event=>{const button=event.target.closest('[data-record]');if(button)openRecord(button.dataset.record);});

function renderStress(){
  const test=caseStudy.stressTests[state.stress];
  $('#stress-options').innerHTML=caseStudy.stressTests.map((item,index)=>`<button class="stress-option" data-stress="${index}" aria-pressed="${index===state.stress}"><span class="mono">${pad(index+1)}</span>${escape(item.label)}</button>`).join('');
  $('#stress-detail').innerHTML=`<div class="eyebrow">SCENARIO ${pad(state.stress+1)} / ${caseStudy.stressTests.length}</div><h3>${escape(test.label)}</h3><p>${escape(test.trigger)}</p><div class="before-after"><div><span class="mono">常见失效方式</span><p>${escape(test.before)}</p></div><div><span class="mono">本模型的表达方式</span><p>${escape(test.after)}</p></div></div><div class="stress-rule">${escape(test.rule)}</div><div class="affected">${test.affected.map(item=>`<span>${escape(item)}</span>`).join('')}</div>`;
}
$('#stress-options').addEventListener('click',event=>{const button=event.target.closest('[data-stress]');if(button){state.stress=Number(button.dataset.stress);renderStress();}});
renderStress();
$('#invariant-grid').innerHTML=invariants.map((item,index)=>`<article class="invariant"><span class="mono">${pad(index+1)}</span><h4>${escape(item.title)}</h4><p>${escape(item.why)}</p><details><summary>检查方法与代价</summary><p><strong>检查：</strong>${escape(item.check)}</p><p><strong>代价：</strong>${escape(item.tradeoff)}</p></details></article>`).join('');

const navLinks=$$('.header nav a');
const observedSections=navLinks.map(link=>$(link.getAttribute('href')));
function highlightChapter(){
  const active=observedSections.filter(section=>section.getBoundingClientRect().top<190).at(-1);
  navLinks.forEach(link=>{const selected=active&&link.getAttribute('href')===`#${active.id}`;link.classList.toggle('active',Boolean(selected));if(selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
}
let scrollPending=false;
document.addEventListener('scroll',()=>{if(scrollPending)return;scrollPending=true;requestAnimationFrame(()=>{highlightChapter();scrollPending=false;});},{passive:true});
highlightChapter();
