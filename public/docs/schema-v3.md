# Post-train 数据模型 v3：内容、过程、判断、集合

状态：设计提案，取代前两版的概念组织；不是已实现的数据库或行业标准。

目标：用尽量少的独立概念，清晰表达任务内容、数据构造、模型执行、标注审核、评测、训练导出和集合发布。完备性限定在这些业务场景，不声称覆盖所有未来需求。

## 1. 比较三个候选方案

| 方案 | 形状 | 优点 | 根本问题 | 结论 |
|---|---|---|---|---|
| A. 一题一行的宽表 | question, answer, author, reviewer_1, reviewer_2, model, score, ... | 导入导出方便 | 多答案、多轮审核、多模型、多次评分都变成重复列或重复行；容易覆盖历史 | 用作展示/训练导出视图 |
| B. 每部分一个独立实体 | QuestionRevision、AnswerRevision、RationaleRevision、ReviewRound、Approval、... | 可精细管理独立对象 | 把字段粒度直接变成对象粒度；普通题目读取和修改需要大量联表 | 仅对独立复用的资源这样处理 |
| C. 内容树 + 通用过程记录 | Asset / Activity / Assessment / Collection | 内容直观，过程复用，版本与字段可定位 | 必须为不同 payload 定义强类型 profile，不能只留 metadata:any | 推荐 |

上一版的问题是把“语义层次”“对象类型”“数据库表”和“具体框架术语”混在一起。v3 先确定四种职责，再讨论字段，不要求一开始就建几十张表。

## 2. 四个主干

```text
Catalog
├── assets[]        内容和定义：题目、答案、环境、模型、响应、轨迹等
├── activities[]    过程：谁在什么时候，使用什么方法，处理了什么
├── assessments[]   判断：对哪个版本的哪一部分，给出了什么结论
└── collections[]   集合：哪些对象的哪些版本，构成某个训练/评测发布
```

例如：`答案是 42` 是 Asset 中的内容；`专家写出答案` 是 Activity；`审核员认为答案正确` 是 Assessment；`题目进入 test split` 是 Collection 的成员关系。

树表示记录的内部结构；记录间用精确版本引用形成关系图。一个 reviewer 可以审核很多题，一份环境可以被很多任务复用，一条轨迹可以被多个评测器评分，因此跨记录关系不能强行压成一棵所有权树。

### 记号和基本类型

- `!`：必选。
- `?`：可选；省略表示本记录没有声明该信息。
- `C`：条件必选；触发条件在字段说明或 profile 中给出。
- `T[]`：数组；允许空数组。`T[1+]`：至少一个元素。
- `Ref<T>`：`{ id: string, revision: string }`，指向 T 的不可变精确版本，禁止在冻结记录中使用 `latest`。
- `Target`：`{ ref: Ref, path?: JsonPointer, selector?: ContentSelector }`。没有 path 表示整个对象；有 path 时相对于被引用记录根，例如 `/data/references/0/value`。selector 用于进一步定位 Content/Artifact 内部元素。
- `ContentSelector`：`{format: URI, value: Value}`，例如按固定格式的 event_id 定位轨迹事件、按 JSON Pointer 定位外置 JSON 内容、按固定单位的区间定位文本或媒体。format 必须定义选择器类型、基准与校验方法；不能使用随解析工具变化的自由文本定位。
- `Timestamp`：带时区的 RFC 3339 字符串；系统写入统一 UTC。
- `DurationMs`：非负整数，单位毫秒。
- `Value`：JSON 的 string/number/boolean/object/array/null；实际允许的类型由绑定的 schema 或 criterion 约束，不是自由填充的 any。
- `Content`：`{format: URI, inline: Value}` 或 `{format: URI, artifact: Ref<Artifact>}`，两者恰好选一。format 是版本固定的格式契约。
- `Evidence`：`{target: Target, relation?: string}`。

每个根对象均有公共身份字段：

```text
Identity
├── schema       ! URI              本记录的版本化 schema/profile
├── id           ! string           逻辑对象 ID，跨修订稳定
├── revision     ! string           本次快照唯一 ID，不要求是内容 hash
├── recorded_at  ! Timestamp        本次快照写入系统的时间
└── parents      ? Ref<same_type>[] 本次修订继承的旧快照；支持合并
```

所有快照不可变。Activity 从 running 到 completed 也产生新 revision；活跃对象的 current 指针是可变索引，不是历史事实。可用事件日志优化状态写入，但不是核心 schema 的额外第五类对象。

revision ID 与内容 digest 分开：相同字节可能有不同来源/权限；仅靠内容 hash 不能区分身份。Artifact 的 digest 用于字节完整性，revision 用于身份与历史。相互引用对象不能递归互算 hash。

### 未知与缺失

```text
missing ? Map<JsonPointer, MissingReason>
MissingReason = unknown | not_collected | withheld | not_applicable
```

只有需要明确区分缺失原因的字段才使用 missing。被标记路径必须实际缺失；不能同时有值和 missing。missing 不能豁免 `!` 字段或发布 profile 的条件约束。空数组表示明确没有；null 只有在字段自身的语义允许时才使用。

本系统知道的 recorded_at 不能省略。外部原作者、原构造时间不知道时，应记录缺口，不能用导入者和导入时间代替。

## 3. Asset：保存内容

```text
Asset = Identity +
├── kind         ! AssetKind
├── data         ! Payload(kind)       由 kind 决定强类型内容
├── produced_by  ! Ref<Activity>       本快照由哪个活动写入/生成
├── access       ! Access
├── missing      ? Map<JsonPointer, MissingReason>
└── extensions   ? Map<URI, Value>     URI 必须指向注册且版本化的扩展 schema

Access
├── visibility   ! public | internal | restricted
└── policy       C Ref<Policy>         restricted 或有特殊使用限制时必选
```

AssetKind 是类型联合，而不是让所有类型共用一张稀疏宽表：

```text
AssetKind
├── task                  题目/任务
├── response              候选答案或交付物
├── trajectory            交互轨迹
├── training_example      某种训练格式的派生样本
├── environment           环境和分阶段依赖
├── evaluator             测试、rubric、判分方法及指标定义
├── procedure             标注指南、流程、生成方法、执行协议、导出配方
├── model                 模型快照及其可确认的信息
├── actor                 人、组织、服务的身份
├── artifact              文件、图片、代码包、原始数据包、日志
└── policy                访问和用途规则
```

这里列出 11 个 payload 类型不意味着要求每条样本创建 11 个对象。简单 QA 可以只有一个 task；多人审核、模型执行或环境任务才创建相关记录。新增任务领域通常只新增 payload profile，不新增主干。

### 3.1 Task 的内容树

```text
Task.data
├── profile      ! URI                    例如 qa-v1 / terminal-v1，确定验证规则
├── input        ! Input
│   ├── messages ! Message[1+]            任务固有的指令/对话上下文
│   └── files    ? Attachment[]           题目给定的文件、图片、数据
├── references   ? Reference[]            参考答案/解法/解析，允许零个或多个
├── environment  C Ref<Environment>       需要外部状态或执行环境时必选
├── evaluation   C Ref<Evaluator>         进入可执行 eval release 时必选
├── attributes   ? Attributes             描述性分类字段
└── lineage_key  ? string                 派生/去重分组；不能替代去重检测

Message
├── role         ! system | developer | user | assistant | tool
├── content      ! Content
├── tool_call_id C string                 tool 结果消息必选
└── tool_calls   ? ToolCall[]             assistant 发起的调用

Attachment
├── name         ! string                 逻辑文件名/挂载路径
└── artifact     ! Ref<Artifact>

Reference
├── key          ! string                 同一任务内稳定且唯一，修订时不复用
├── role         ! answer | solution | rationale | rubric | demonstration
├── value        ! Content
└── audience     ! agent | evaluator | curator

Attributes
├── language     ? string                 语言代码
├── domain       ? string                 使用已注册 taxonomy
├── subject      ? string
├── skills       ? string[]
└── tags         ? string[]
```

`Reference.role=answer` 表示该内容承担参考答案角色，不自动证明正确。正确性来自 Assessment。人工主观难度、模型测得难度、verified 等不放进没有来源的静态数值字段，作为带方法和证据的判断保存；展示视图可以把它们合并成列。

references 里的 audience 是消费边界，导出器必须按它过滤；同一 Asset 内有隐藏答案时原始 Asset 应为受限访问，另生成去掉答案的 agent 输入投影。不能仅靠 UI 隐藏字段防止泄漏。

Task 不保存 reviewer_1、reviewer_2、model、score 或 train/test。它们分别归属 Activity、Assessment、Collection。

默认 question、answer、rationale 同属一个 Task 快照；变更答案会生成新的 Task revision，沿 parents 查差异。活动可用 Target 定位局部字段。只有确实需要独立复用/独立交付时，才把局部内容提升成独立引用资源。

### 3.2 Environment 与 Evaluator

```text
Environment.data
├── runtime      ! RuntimeSpec
│   ├── kind     ! container | vm | service | simulator | local
│   ├── locator  ! string                 image/service/snapshot/runtime 标识
│   └── revision C string                 可冻结资源必须提供 digest/commit/version
├── initialization ? Content             初始数据、reset/setup/teardown 的声明
├── dependencies ? Dependency[]
├── tools          ? Content             工具接口及各版本
├── limits         ? ResourceLimits      CPU/GPU/RAM/存储/网络/时间，单位由 schema 固定
└── reproducibility ! pinned | partial | live

Dependency
├── name          ! string
├── scope         ! build | agent | verifier
├── source        ! string
├── version       C string               可 pin 时必选；否则 missing + partial/live
└── digest        ? string

Evaluator.data
├── method        ! Ref<Procedure>        exact-match / program / model / human 等方法
├── criteria      ! Criterion[1+]
├── materials     ? Attachment[]         tests、rubric、fixtures、参考资源
├── environment   C Ref<Environment>      verifier 需要独立环境时必选
└── aggregation   ? Content              聚合公式、权重、缺失处理、CI 方法

Criterion
├── key           ! string               本 evaluator 版本内唯一
├── description   ! string               被判断的具体含义
├── value_schema  ! URI                  boolean/number/enum/结构化结果及值域
├── direction     ? higher | lower | none
├── unit          ? string               例如 ratio/ms/USD，数量型指标应给出
└── rule          ? Content              阈值、容差、通过条件
```

Test suite 是 Evaluator 的 materials 和执行方法。依赖属于具体环境且有 scope；无需为每个任务强制创建单独 DependencyLock 实体，可以直接引用锁文件 Artifact。

pin 住镜像不意味着外部网站、API 模型和 GPU 数值行为可完全复现。必须保存实际环境观测与执行输出；reproducibility 是声明范围，不是成功重放的证据。

### 3.3 其余 payload 的最小契约

| kind | 必选 data 字段 | 条件必选/可选字段 |
|---|---|---|
| response | `context: Target`, `content: Content` | `artifacts?: Attachment[]`；它是候选输出，不因被选中成为客观正确答案 |
| trajectory | `context: Target`, `format: URI`, `events: Content` | `raw?: Ref<Artifact>`, `termination?: {kind, reason}`；RL 导出必须区分 terminated/truncated/unfinished |
| training_example | `format: URI`, `record: Content`, `sources: Target[1+]` | `selection_evidence?: Ref<Assessment>[]`；偏好样本必须有比较依据；mask、tokenizer、reward 来源由训练 profile 约束 |
| procedure | `name: string`, `definition: Content`, `config_schema: URI` | `code?: Ref<Artifact>`, `dependencies?: Ref[]`；可表达人工指南或程序代码，版本由 Asset revision 固定 |
| model | `provider: string`, `name: string`, `resolution: pinned/opaque/live` | `provider_revision?: string`, `checkpoint?: Ref<Artifact>`, `tokenizer?: Ref<Artifact>`；pinned 时须有可验证 revision/checkpoint |
| actor | `type: person/organization/service` | `display_name?: string`, `organization?: Ref<Actor>`, `qualification?: Content`；角色属于活动参与关系；真实身份可单独受限存储 |
| artifact | `media_type: string`, `storage: {uri: string, availability: available/external/unavailable}` | 本地/受控存储字节必须有 `sha256: string`, `bytes: integer>=0`；原始来源用 `source?: {uri, revision?, locator?, retrieved_at?}` |
| policy | `rules: Content` | `license?: Content`；rules 的 profile 约束可访问主体与 train/eval/redistribute 等用途 |

Trajectory 的 events profile 至少能表达 event_id、顺序/因果关联、actor、message/action/observation、tool call/result 对应、时间和原始 payload。RL profile 进一步要求 observation/action/reward 对齐和终止语义；多 agent profile 要求 actor/session/parent-cause。不要将分布式时间戳排序冒充因果顺序。

## 4. Activity：记录构造、审核与执行

```text
Activity = Identity +
├── kind          ! import | author | transform | annotate | review | adjudicate
│                    | rollout | score | aggregate | export | release
├── inputs        ! InputUse[]           可空；每个输入固定版本和用途
├── participants  ! Participation[1+]    记录实际参与者；导入者不冒充原作者
├── method        C Method               执行/评分/变换/规范标注审核必选
├── state         ! queued | running | completed | failed | cancelled
├── time          ! ActivityTime
├── workflow      ? WorkflowPosition     组织批次、阶段、轮次
├── depends_on    ? Ref<Activity>[]      控制依赖；语义输入仍要放 inputs
├── retry_of      ? Ref<Activity>        重试是新 id；不覆盖失败尝试
├── mappings      C FieldMapping[]       一次产物合并不同来源/不同字段责任人时必选
├── diagnostics   ? Content              错误/运行日志/实际配置观测
├── usage         ? Usage                token/耗时/费用等观测量
└── missing       ? Map<JsonPointer, MissingReason>

InputUse
├── role          ! string               task/question/answer/rubric/evidence/model 等
└── target        ! Target

Participation
├── actor         ! Ref<Actor>
└── role          ! string               author/annotator/reviewer/adjudicator/runner 等

FieldMapping
├── output        ! Target               指向产物的具体字段/内容片段
├── inputs        ! Target[]             该部分来自哪些原始内容；原创可为空
├── contributors  C Participation[1+]    当前活动多人分工时，列该字段实际责任人
└── origin_activities ? Ref<Activity>[]  保留上游构造活动；不冒充当前活动参与者

Method
├── procedure     ! Ref<Procedure>
├── config        ! object               必须通过该 procedure.config_schema；允许 {}
├── models        C ModelUse[1+]         使用模型生成/评分时必选；纯程序生成可省略
└── environments  C Ref<Environment>[1+] 执行需要环境时必选

ModelUse
├── role          ! candidate | generator | judge | helper
└── model         ! Ref<Model>

ActivityTime
├── started_at    C Timestamp            本系统观测到实际启动时必选
├── finished_at   C Timestamp            本系统观测到终态时必选
└── active_ms     ? DurationMs           人工实际工作时长；不等同于墙钟等待时间

WorkflowPosition
├── run_id        ! string               一次生产流程/批次的实例 ID
├── stage         ! string               例如 draft/review/adjudication
└── round         ? integer>=1

Usage
├── input_tokens  ? integer>=0
├── output_tokens ? integer>=0
├── duration_ms   ? DurationMs
└── cost          ? {amount: decimal_string, currency: string}
```

活动输出通过 `Asset/Assessment/Collection.produced_by` 反向查得，核心记录不再重复保存一份 outputs 列表。API 可以提供 outputs 只读视图。完成活动若没有输出也有效，例如失败前已启动的尝试。模型原始响应是 Asset，诊断日志是 Artifact。

流式输出引用其实际产生时的 Activity revision。查询“截至 run@done 的所有产物”，按该逻辑 activity ID 及 run@done 的祖先快照闭包反查 produced_by，不能只匹配最后 revision，也不能混入分叉历史。FieldMapping 虽引用局部产物，但它是来源/责任映射，不是另一份完整输出清单；两者必须一致。

对导入的外部历史活动，started_at/finished_at 只在源记录给出时填写，否则以 missing 说明；它们不触发“本系统观测执行”的时间必选条件。recorded_at 始终必选且只表示本系统录入时间。

每个独立审核意见使用独立 Activity + Assessment；即使两人同属一个 review round，也不能压成一个不知是谁提出的意见。共同署名生成一个产物时则可列出多个 participants。

自动生成时 procedure 固定 prompt template/agent scaffold/程序版本，config 保存实际参数，models 固定能确认的模型信息；seed 无法取得就标记，不能声称 seed 能保证确定性。

执行 `completed` 仅表示过程结束。模型答错仍然可以 completed；是否正确由 Assessment 表达。timeout 可以作为 failed 的 diagnostics 原因，或按注册 profile 扩展过程枚举，不能当分数 0 的同义词。

## 5. Assessment：统一标注判断、审核和分数

```text
Assessment = Identity +
├── subjects      ! Target[1+]            可评单字段/整题/候选对/整个集合
├── criterion     ! CriterionRef          精确的评判定义
├── result        ! Result
├── produced_by   ! Ref<Activity>         谁/模型/方法/时间统一从这里查
├── evidence      ! Evidence[]            可空；高质量发布 profile 可要求非空
├── rationale     ? Content
├── confidence    ? number[0,1]           仅在评判协议定义其语义时使用
└── supersedes    ? Ref<Assessment>[]     显式更正旧判断；不同审核者意见并存

CriterionRef
├── evaluator     ! Ref<Evaluator>
└── key           ! string                evaluator.criteria 中存在的 key

Result = 下列二者之一
├── {status: value, value: Value}         value 必须满足 criterion.value_schema
└── {status: unavailable, reason: string} 没评出结果；不是 value=0
```

同一个结构可保存：answer_correctness=true、ambiguity=high、review_decision=request_changes、preference={winner:response-A}、tests_passed=17、accuracy=0.63、training_eligibility=blocked。它们必须具有不同 criterion；同为 number 并不意味着可互相平均。

偏好判断 subjects 必须包含共同上下文和具体候选；winner 必须属于候选集合。chosen 只表示某个协议下更偏好，不能推出答案正确。

汇总分数仍是 Assessment，subjects 指向固定版本的 Collection，聚合 Activity 的 inputs 固定被采用的样本级 Assessment，method 固定分母、去重、重试、权重、缺失处理和 CI 方法。Result 的结构化 value 可保存 value/n_total/n_scored/coverage/CI，具体由 criterion schema 限定。

“质量状态”是某套采用策略下从判断投影出的视图，不能用 latest score 或 latest review 偷偷覆盖冲突。裁决 Activity 把冲突意见作为 inputs，产生新的最终判断。

## 6. Collection：固定集合与用途

```text
Collection = Identity +
├── name           ! string
├── purpose        ! train | eval | mixed | catalog
├── members        ! Member[] | ManifestRef
├── produced_by    ! Ref<Activity>        assemble/export/release 可用 transform/export/release
├── protocol       C Ref<Procedure>        可复现 eval 或训练导出 release 时必选
├── policy         C Ref<Policy>           有用途/访问/发布限制时必选
└── release_evidence ? Ref<Assessment>[]  发布必须符合自身 gate；无统一强制审核轮数

Member
├── key            ! string               集合内唯一；允许同一对象按明确规则重复采样
├── target         ! Ref<Asset>           固定成员版本；可为 task/trajectory/training_example
├── split          ? string               train/dev/test/custom；不等于访问权限
└── weight         ? number>0             默认 1；顺序采用 manifest 数组/ordinal

ManifestRef
├── artifact       ! Ref<Artifact>        内容是 Member 行，格式固定且有 hash
└── format         ! URI
```

train/dev/test 是集合成员关系，不是 Task 的永久属性；用途可表达，不代表用途获授权。训练导出必须检查 policy 和去重/隔离策略。public/private 是访问维度，不能混入 split 枚举。

发布的字节快照不因撤回而改写。后续的撤回/隔离由对该 Collection 的 Assessment 和相应 Activity 记录，服务当前资格视图控制可见性。审核判断发生争议也不修改旧发布的内容。

## 7. 必选性按场景收紧

不应让所有题型共用一张“全部必填”表。核心 schema 约束共同语义，profile 约束特定场景与发布要求。

| 场景 | 必须额外具备 | 允许缺少 |
|---|---|---|
| imported QA | task input；保留 raw source；import Activity；外部 ID/revision/row locator 尽可能记录，未知如实标记 | 原始作者、原构造时间、未公开审核历史 |
| 自建且审核通过的 QA | references；author/annotation/review 活动；精确审核目标和输入；适用规范；发布采用的审核证据 | environment；模型执行轨迹 |
| terminal/interactive eval | environment；initial/reset state；tools/依赖；evaluator；protocol；task 固定版本 | 参考解；人写 rationale，若评测不依赖它们 |
| SFT export | 输入与目标 completion；导出 procedure；source refs；loss-mask/模板语义由 profile 定义 | verifier；偏好比较；environment |
| DPO export | 同上下文两候选；选择/比较 Assessment；raw 候选；export recipe | 单一标准答案 |
| online RL prompt pool | task input；运行环境或 response-only 协议；reward evaluator；采样配置 | 预生成 rollout；gold answer，若奖励协议不依赖 |
| offline RL trajectory | 有序/有因果关系的 observation/action/reward；终止与截断；behavior policy/model/config；奖励来源 | 自然语言题目、标准答案，若该 profile 不使用 |
| 本地 aggregate benchmark report | 固定成员集合；逐项判断；聚合方法/权重/覆盖率；协议版本 | 不必复制各成员的原文 |
| 私有 benchmark 的外部总分 | 原始报告 Artifact；source 和导入 Activity；Assessment 定义为“来源报告的分数” | 私有成员和逐项判断；缺失时不创建声称完整的 Collection |

imported、audited、runnable、trainable 是验证 profile 的能力，不是一串必须顺序经过的全球状态。导入可成功但不可重放；可重放不等于标注正确；已通过审核也不自动获准训练。

## 8. 用同一条任务验证字段级 provenance

以下 ID 是虚构设计示例，不是 HLE 的真实标注记录。

```text
task/Q1@r1
├── input.messages[0].content.inline = "...题干..."
└── references
    ├── key=answer,    role=answer,    value.inline="42"
    └── key=rationale, role=rationale, value.inline="...推导..."

author/A1@done
├── participants = [person/P1@v1 : author]
├── method = guideline/G1@v2
└── time = 09:00 -> 09:30
    └── 输出：task/Q1@r1.produced_by = author/A1@done

review/R1@done
├── inputs = [Q1@r1 的题干、答案、解析；rubric@v3]
├── participants = [person/P2@v1 : reviewer]
└── time = 10:00 -> 10:20
    └── 输出：assessment/J1@v1
        ├── subjects = [Q1@r1 的答案路径]
        ├── criterion = answer_correctness
        └── result = false

transform/F1@done
├── inputs = [task/Q1@r1, assessment/J1@v1]
└── participants = [person/P1@v1 : author]
    └── 输出：task/Q1@r2，答案改为 "43"，parents=[Q1@r1]

review/R2@done
├── inputs = [task/Q1@r2, rubric@v3]
└── participants = [person/P3@v1 : reviewer]
    └── 输出：assessment/J2@v1，针对 Q1@r2，正确性判断为 true

collection/expert-qa@2026-09
├── members = [{key:"Q1", target:Q1@r2, split:"test"}]
└── release_evidence = [J2@v1]
```

同一个旧版本上的多个审稿意见可以并存。新版本不会自动继承旧审核：即使答案文本没变，题干或图像变了，答案正确性也可能失效。判断适用性同时依赖 subjects、review Activity.inputs 和采用规则；复用旧审核需要显式复用/复审证据。不能直接 `latest(question)+latest(answer)` 拼出从未审核过的组合。

单人、单来源的局部修改通常用 Target + snapshot diff 即可。一次合并不同来源或不同字段责任人时，必须用 Activity.mappings 明确“产物路径 -> 输入路径/责任人”，或引用分别生成的独立产物。仅 participants=[甲,乙] 不能推断谁写题干、谁写解析。大规模 ETL 的等价映射可以用受 profile 约束的规则和输入 manifest 物化生成，避免每个单元格创建一条活动。

外置轨迹也可精确定位：`{ref: trajectory@r1, path: /data/events, selector: {format: event-id-v1, value: {event_id: e17}}}`。实际格式必须是版本化 URI；此处用短名示意。逐步 reward/审核可以绑定这个 Target，不能只引用整份日志后丢失 step 对齐。

动态任务的模板和生成器放在 Procedure，参数/随机性放在 Activity.method.config；其产物必须包含实际 Task 快照和初始状态。仅保存模板版本不足以复原一次任务实例。

## 9. 为什么简洁，为什么覆盖所需场景

这里的“最简”是保留必要语义边界的工程最简，不是声称四种对象在数学上不可约。用一个 JSON 或通用 Entity/Edge 也能装下全部内容，但无法约束混淆。

四种职责各自回答不同问题：

1. Asset：到底是什么内容/定义？删除它就无法区分题目、候选答案和环境。
2. Activity：谁、何时、按什么方法操作？删除它就丢失构造者、审核者、方法版本与历史。
3. Assessment：作出了什么可争议判断？删除它就会把答案、评分、审核决定混为一谈，无法保留冲突和重评分。
4. Collection：当时选择了哪些精确版本用于什么？删除它就无法复原训练批次、eval release、split 和聚合分母。

所有构造/审核/运行使用同一个 Activity；所有主观标签/偏好/逐测试分数/聚合分数使用同一个 Assessment；多数内容内嵌在 Task 树；独立资源才引用。因此减少的是重复机制，不是把复杂性塞进 metadata:any。

| 原始需求 | 落点 |
|---|---|
| instruction | Task.input |
| solution / answer / rationale | Task.references |
| environment | Task.environment -> Environment |
| test suite | Task.evaluation -> Evaluator.materials/method |
| dependency | Environment.dependencies，或锁文件 Artifact |
| rollout | Activity(kind=rollout) 的 Response/Trajectory 产物 |
| model / agent scaffold / inference 参数 | Activity.method.models / procedure / config |
| score / quality / preference / review verdict | Assessment + Criterion |
| 构造时间 / 标注员 / 审核员 / 各阶段 | Activity.time / participants / workflow |
| 每一部分的构造信息 | Task 精确 revision + Target.path + Activity 输入/产物 |
| 来源 / 原始数据 / 规范化过程 | Artifact.source + import/transform Activity |
| train / eval / split / 版本 / 采样权重 | Collection / Member |
| 不同状态 | Activity.state、Assessment 结论、Collection 当前资格视图分别管理 |

### 必须成立的关系约束

1. 所有 Ref 能解析到精确版本；每个 Target.path 存在于该版本，selector 能在对应固定内容中解析。内容引用发生循环时不能递归嵌套序列化；版本继承链禁止环。
2. 内部产物必须有 produced_by；导入产物指向 import 活动，不能冒充原始构造活动。外部真实生产史如有记录，可单独导入。
3. frozen release 成员不能指向可变别名；profile 决定该发布需要哪些审核/执行证据。
4. Assessment.value 必须满足精确 criterion 版本；未评分不等于零分。
5. Review/score 的输入必须包含形成判断所依赖的上下文；审核证据不能无条件跨 revision 继承。
6. 过程成功、样本正确、发布资格、训练权限是独立概念。
7. DPO 的两个候选共享比较上下文；RL 的 reward 对齐与终止约定由 profile 明确；导出不得推断未记录的 reasoning 或 logprob。
8. 仅有总体分数的私有 benchmark 可以作为外部 report 接入，但必须标记缺少 task/trace，不声称可重评分。

外部 report-only 情况下，Assessment.subjects 指向报告 Artifact 中的具体结果，使用“外部报告值”criterion；不能用 members=[] 假装成员未知，更不能当成本系统重算的 accuracy。拿到成员清单后再创建实际 Collection，并通过新的导入/核对活动建立关联。

这套覆盖验证比“字段有多少列”更重要。完备性来自必选约束、输入输出关联、版本与证据，而不是一个不断加列的 JSON。

## 10. 实现边界

第一阶段只需实现四类记录的 CRUD/不可变快照、精确引用解析、profile 验证、字段选择器、produced_by 反向查询、活动/审核当前视图。并不要求 graph database 或全量 event sourcing。

可用 PostgreSQL/SQLite 存索引和结构化记录，文件/对象存储存 Artifact，Parquet 存导出表；这些是物理布局，不改变模型。先实现 qa、terminal、sft、preference 四个 profile，再按实际数据补其他 profile。

本文件是字段和语义设计，尚未生成可执行 JSON Schema、数据库迁移、benchmark adapter 或进行真实数据 round-trip。AA Bench/ALE 的准确名称与版本仍需在编写 adapter 时确认；此处不假设某个缩写一定对应某个项目。
