# Lyria AI Integration Spec

This specification defines the data contracts, storage behavior, synchronization mappers, schemas, and enums within the Lyria codebase. This document serves as the guide for integrating a future natural language AI assistant that proposes structured actions to be executed safely via the existing `AppContext`.

---

## 1. AppContext Contract

The application manages state through `AppContext` in `src/contexts/AppContext.jsx`. The state is mutated and persisted locally and remotely using the following functions:

### Function Signatures and Behavior

1. **`createItem(stateKey, item)`**
   - **Arguments**:
     - `stateKey` (string): The identifier of the collection (e.g., `'tasks'`, `'finance'`).
     - `item` (object): The payload containing fields of the record.
   - **Behavior**:
     - Calls `db.create(collectionMap[stateKey], item)` to save the item in `localStorage`.
     - Triggers a React state update for that collection via `refreshCollection(stateKey)`.
     - If a user is logged in (`user` or `getCurrentUser()`) and Supabase is configured, it maps the local item using the appropriate sync mapper and pushes it to Supabase asynchronously (`supabase.from(table).insert(remoteItem)`).
     - Returns the created item (with auto-generated fields).

2. **`updateItem(stateKey, id, updates)`**
   - **Arguments**:
     - `stateKey` (string): The identifier of the collection.
     - `id` (string/UUID): The identifier of the record to update.
     - `updates` (object): Partial payload representing the fields to change.
   - **Behavior**:
     - Calls `db.update(collectionMap[stateKey], id, updates)` to save changes in `localStorage`.
     - Triggers state refresh.
     - If authenticated, maps and upserts the updated item to Supabase (`supabase.from(table).upsert(remoteItem, { onConflict: 'id' })`).
     - Returns the updated item.

3. **`updateBatch(stateKey, updatesArray)`**
   - **Arguments**:
     - `stateKey` (string): The identifier of the collection.
     - `updatesArray` (array of objects): Each object must have `{ id, updates }`.
   - **Behavior**:
     - Calls `db.updateBatch(collectionMap[stateKey], updatesArray)` to apply multiple updates in a single local batch.
     - Triggers state refresh.
     - Maps the updated objects and performs a batch upsert to Supabase.
     - Returns boolean indicating success.

4. **`deleteItem(stateKey, id)`**
   - **Arguments**:
     - `stateKey` (string): The identifier of the collection.
     - `id` (string/UUID): The identifier of the record to delete.
   - **Behavior**:
     - Removes the item from `localStorage` using `db.remove(collectionMap[stateKey], id)`.
     - Triggers state refresh.
     - If authenticated, performs a soft delete in Supabase by setting `deleted_at: new Date().toISOString()`.
     - For `'tasks'`, it additionally updates `status: 'excluída'` in the remote update payload.

5. **`refreshAll()`**
   - **Behavior**: Reloads all collections from local storage into the React context state.

6. **`refreshCollection(stateKey)`**
   - **Behavior**: Reloads a specific collection into the React state from local storage.

### Local Database Auto-Generated Fields

When `db.create()` is invoked, the helper automatically generates the following fields:
- **`id`**: Assigned using `crypto.randomUUID()`.
- **`createdAt`**: Assigned using `new Date().toISOString()`.
- **`order`**: Automatically calculated to determine sorting order: `Math.max(...items.map(t => t.order || 0)) + 1` (or `0` if empty).

> [!IMPORTANT]
> The AI payload **should avoid sending `id`, `createdAt`, or `order` fields** when creating items, allowing `db.create()` to handle generation.

---

## 2. Storage and Sync Model

Lyria utilizes a local-first design architecture:

- **Local-First Architecture**: All reads and writes target the client's local cache first. This guarantees high speed, offline resilience, and immediate UI updates.
- **`localStorage` Key Pattern**: Local collections are prefixed with `cp_` (e.g., `cp_tasks`, `cp_finance`, `cp_projects`, `cp_rewards`, `cp_learnings`, `cp_experiments`).
- **Supabase Cloud Sync**: Mutations triggered via `AppContext` handlers automatically sync out-of-band to Supabase if the user session is active.
- **Why the AI must not write directly to Supabase**:
  - Direct database writes would bypass `localStorage`, leading to cache mismatches and stale UI states.
  - Using `AppContext` ensures that both local cache and cloud data are synchronized correctly, adhering to the application's offline-first architecture.
  - Security policies and session validations are built into `AppContext` and `supabaseClient.js`, preventing the need to reinvent auth tokens or credentials in parallel.

---

## 3. Module Contracts

Below are the data contracts for each target module, discovered from page default templates, components, and sync mappers.

### 3.1 Tasks (`tasks`)

*State Key Name*: `tasks` | *Collection Key*: `tasks` | *Remote Table*: `tasks`  
*Source File*: `src/pages/Tasks.jsx` (L13-L20) & `src/lib/tasksSync.js`

| Local Field | Type | Req/Opt | Local Default Value | Remote Mapping | Allowed Values / Formatting |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Required** | `''` | `title` | Free text |
| `description`| `string` | Optional | `''` | `description` | Free text |
| `priority` | `string` | Optional | `'média'` | `priority` | `'baixa'`, `'média'`, `'alta'` |
| `estimatedHours`| `string` | Optional | `''` | `estimated_hours` | Numeric string (mapped to float) |
| `status` | `string` | Optional | `'pendente'` | `status` | `'pendente'`, `'em_andamento'`, `'concluída'`, `'excluída'` |
| `dueDate` | `string` | Optional | `''` | `due_date` | `YYYY-MM-DD` |
| `scheduledDate`| `string` | Optional | `''` | `scheduled_date` | `YYYY-MM-DD` |
| `scheduledTime`| `string` | Optional | `''` | Mapped in context | `HH:mm` |
| `category` | `string` | Optional | `''` | `category` | `'Marketing'`, `'Conteúdo'`, `'Produto'`, `'Operações'`, `'Estratégia'`, `'Pessoal'`, `'Outro'` |
| `recurrence` | `string` | Optional | `'única'` | `recurrence` | `'única'`, `'diária'`, `'semanal'`, `'mensal'` |
| `recurrenceDay`| `string` | Optional | `''` | `recurrence_day` | Numeric string or day name depending on recurrence |
| `completedDates`| `array` | Optional | `[]` | `completed_dates` | Array of `YYYY-MM-DD` strings |

---

### 3.2 Finance (`finance`)

*State Key Name*: `finance` | *Collection Key*: `finance` | *Remote Table*: `finance_entries`  
*Source File*: `src/pages/Finance.jsx` (L14-L18) & `src/lib/financeSync.js`

| Local Field | Type | Req/Opt | Local Default Value | Remote Mapping | Allowed Values / Formatting |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `type` | `string` | **Required** | `'entrada'` | `type` | `'entrada'` (Income), `'saída'` (Expense) |
| `amount` | `number` | **Required** | `''` | `amount` | Positive float/integer |
| `category` | `string` | **Required** | `''` | `category` | For **entrada**: `'Vendas'`, `'Serviços'`, `'Investimentos'`, `'Outros'`<br>For **saída**: `'Marketing'`, `'Ferramentas'`, `'Operações'`, `'Pessoal'`, `'Educação'`, `'Impostos'`, `'Outros'` |
| `expenseClass`| `string` | Optional | `''` | `expense_class` | Only for *saída*: `'Essencial'`, `'Fixo'`, `'Variável'`, `'Estratégico'`, `'Investimento'`, `'Supérfluo'` |
| `subcategory`| `string` | Optional | `''` | `subcategory` | Free text |
| `source` | `string` | Optional | `''` | `source` | `'dropshipping'`, `'conteúdo'`, `'serviços'`, `'ferramentas'`, `'marketing'`, `'operações'`, `'pessoal'`, `'outro'` |
| `date` | `string` | **Required** | Today's Date | `date` | `YYYY-MM-DD` |
| `notes` | `string` | Optional | `''` | `notes` | Free text |
| `originalDescription`| `string` | Optional | `''` | `original_description`| Free text |
| `sourceBank` | `string` | Optional | `''` | `source_bank` | Free text (defaults to `'Importado'` for sheet transactions) |
| `accountName`| `string` | Optional | `''` | `account_name` | Free text |
| `duplicateKey`| `string` | Optional | `''` | `duplicate_key` | Free text (used for deduplication checks) |
| `importedFrom`| `string` | Optional | `''` | `imported_from` | Free text |
| `reviewStatus`| `string` | Optional | `'approved'` | Mapped in context | `'approved'`, `'pending'` |
| `fixedCostId`| `string` | Optional | `null` | `fixed_cost_id` | UUID string (references a fixed cost record) |
| `periodKey` | `string` | Optional | `''` | `period_key` | `YYYY-MM` |

---

### 3.3 Projects (`projects`)

*State Key Name*: `projects` | *Collection Key*: `projects` | *Remote Table*: `projects`  
*Source File*: `src/pages/Projects.jsx` (L12-L22, L34-L42) & `src/lib/batch3Sync.js`

| Local Field | Type | Req/Opt | Local Default Value | Remote Mapping | Allowed Values / Formatting |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Required** | `''` | `title` | Free text |
| `description`| `string` | Optional | `''` | `description` | Free text |
| `status` | `string` | Optional | `'ativo'` | `status` | `'ativo'`, `'pausado'`, `'concluído'`, `'arquivado'`, `'excluído'` |
| `category` | `string` | Optional | `''` | `category` | `'Conteúdo'`, `'Negócios'`, `'Estudos'`, `'Produto'` |
| `startDate` | `string` | Optional | Today's Date | `start_date` | `YYYY-MM-DD` |
| `targetDate` | `string` | Optional | `''` | `target_date` | `YYYY-MM-DD` |
| `completedAt`| `string` | Optional | `''` | `completed_at` | `YYYY-MM-DD` or timestamp string |
| `subtasks` | `array` | Optional | `[]` | `subtasks` | Array of `{ id, title, completed, order }` |

---

### 3.4 Rewards (`rewards`)

*State Key Name*: `rewards` | *Collection Key*: `rewards` | *Remote Table*: `rewards`  
*Source File*: `src/pages/Recompensas.jsx` (L11-L26, L28-L44) & `src/lib/rewardsSync.js`

| Local Field | Type | Req/Opt | Local Default Value | Remote Mapping | Allowed Values / Formatting |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Required** | `''` | `title` | Free text |
| `description`| `string` | Optional | `''` | `description` | Free text |
| `category` | `string` | Optional | `'Outro'` | `category` | `'Trabalho'`, `'Financeiro'`, `'Saúde'`, `'Casa'`, `'Estudos'`, `'Lazer'`, `'Pessoal'`, `'Outro'` |
| `estimatedValue`| `number` | Optional | `''` | `estimated_value`| Positive float/integer |
| `deadline` | `string` | Optional | `''` | `deadline` | `YYYY-MM-DD` |
| `redeemAvailableDate`| `string`| Optional | `''` | `redeem_available_date`| `YYYY-MM-DD` |
| `priority` | `string` | Optional | `'média'` | `priority` | `'baixa'`, `'média'`, `'alta'` |
| `status` | `string` | Optional | `'em_andamento'`| `status` | `'em_andamento'`, `'desbloqueada'`, `'resgatada'`, `'arquivada'`, `'excluída'` |
| `conditions` | `array` | Optional | `[]` | `conditions` | Array of `{ id, text, completed, completedAt }` |
| `notes` | `string` | Optional | `''` | `notes` | Free text |
| `redeemedAt` | `string` | Optional | `''` | `redeemed_at` | `YYYY-MM-DD` or ISO string |
| `archivedAt` | `string` | Optional | `''` | `archived_at` | `YYYY-MM-DD` or ISO string |
| `financialTargetAmount`| `number`| Optional | `null` | `financial_target_amount`| Float/integer or `null` |
| `financialCurrentAmount`| `number`| Optional | `null` | `financial_current_amount`| Float/integer or `null` |
| `showOnDashboard`| `boolean`| Optional | `false` | `show_on_dashboard`| `true` or `false` |

---

### 3.5 Learnings (`learnings`)

*State Key Name*: `learnings` | *Collection Key*: `learnings` | *Remote Table*: `learnings`  
*Source File*: `src/pages/Learnings.jsx` (L14-L21) & `src/lib/batch1Sync.js`

| Local Field | Type | Req/Opt | Local Default Value | Remote Mapping | Allowed Values / Formatting |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `content` | `string` | **Required** | `''` | `content` | Free text (the learning idea or summary) |
| `source` | `string` | Optional | `''` | `source` | Free text (e.g. book title, URL, meeting) |
| `tags` | `array` | Optional | `[]` | `tags` | Array of strings |
| `isFavorite` | `boolean`| Optional | `false` | `is_favorite` | `true` or `false` |
| `date` | `string` | Optional | Today's Date | `date` | `YYYY-MM-DD` |

---

### 3.6 Experiments (`experiments`)

*State Key Name*: `experiments` | *Collection Key*: `experiments` | *Remote Table*: `experiments`  
*Source File*: `src/pages/Experiments.jsx` (L9-L15) & `src/lib/batch1Sync.js`

| Local Field | Type | Req/Opt | Local Default Value | Remote Mapping | Allowed Values / Formatting |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Required** | `''` | `title` | Free text |
| `category` | `string` | **Required** | `''` | `category` | `'ads'`, `'conteúdo'`, `'negócio'`, `'operacional'`, `'produtividade'`, `'estratégia'`, `'outro'` |
| `context` | `string` | Optional | `''` | `context` | Free text |
| `whatWasTested`| `string` | Optional | `''` | `what_was_tested` | Free text |
| `result` | `string` | Optional | `''` | `result` | Free text |
| `mainError` | `string` | Optional | `''` | `main_error` | Free text |
| `lessonLearned`| `string` | Optional | `''` | `lesson_learned` | Free text |
| `repeatThis` | `string` | Optional | `'sim'` | `repeat_this` | `'sim'`, `'não'` |
| `date` | `string` | Optional | Today's Date | `date` | `YYYY-MM-DD` |
| `notes` | `string` | Optional | `''` | `notes` | Free text |
| `tags` | `array` | Optional | `[]` | `tags` | Array of strings |

---

## 4. Date and Time Formats

The application expects strict date and time formats to ensure successful visual rendering and database synchronization:

- **Dates** (`dueDate`, `scheduledDate`, `startDate`, `targetDate`, `deadline`, `date`):
  - Must be formatted as `YYYY-MM-DD` (e.g., `'2026-06-25'`).
  - No timezone components or hours should be appended to these specific fields.
- **Times** (`scheduledTime`):
  - Must be formatted as `HH:mm` in 24-hour clock notation (e.g., `'14:30'`, `'09:15'`).
- **Timestamps** (`createdAt`, `completedAt`, `redeemedAt`, `archivedAt`):
  - Expected to follow the ISO 8601 extended format: `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g., `'2026-06-25T15:34:33.000Z'`).
- **pt-BR Assumptions**:
  - The frontend expects database dates to be stored as `YYYY-MM-DD`. However, user inputs or uploaded documents might contain dates in `DD/MM/YYYY` format. The AI executor system must sanitize and map any `DD/MM/YYYY` input into `YYYY-MM-DD` prior to invoking context operations.

---

## 5. Soft Delete Behavior

Mutations invoking `deleteItem(stateKey, id)` behave as follows:

1. **Local storage removal**: The item is completely deleted from the client browser storage using `db.remove()`.
2. **Cloud soft delete**:
   - The sync runner executes a remote table update, setting `deleted_at: new Date().toISOString()`.
   - The record is kept in Supabase but excluded from standard fetches.
   - For `'tasks'`, it also sets `status = 'excluída'`.

> [!WARNING]
> Because local deletions are physically destructive while remote deletions are logical, direct delete operations introduce synchronization discrepancies. For Version 1 of the AI Integration, **only CREATE (`"create"`) actions are recommended**. Destructive update and delete actions should be avoided.

---

## 6. Consolidated List of Exact Allowed Enums

The AI system and executor must use these exact strings. Any variations will cause database constraint failures or rendering issues.

- **Task Priority**: `'baixa'`, `'média'`, `'alta'`
- **Task Status**: `'pendente'`, `'em_andamento'`, `'concluída'`, `'excluída'`
- **Task Recurrence**: `'única'`, `'diária'`, `'semanal'`, `'mensal'`
- **Task Category**: `'Marketing'`, `'Conteúdo'`, `'Produto'`, `'Operações'`, `'Estratégia'`, `'Pessoal'`, `'Outro'`
- **Finance Type**: `'entrada'`, `'saída'`
- **Finance Income Categories** (when `type === 'entrada'`): `'Vendas'`, `'Serviços'`, `'Investimentos'`, `'Outros'`
- **Finance Expense Categories** (when `type === 'saída'`): `'Marketing'`, `'Ferramentas'`, `'Operações'`, `'Pessoal'`, `'Educação'`, `'Impostos'`, `'Outros'`
- **Finance Expense Class** (when `type === 'saída'`): `'Essencial'`, `'Fixo'`, `'Variável'`, `'Estratégico'`, `'Investimento'`, `'Supérfluo'`
- **Finance Source**: `'dropshipping'`, `'conteúdo'`, `'serviços'`, `'ferramentas'`, `'marketing'`, `'operações'`, `'pessoal'`, `'outro'`
- **Project Status**: `'ativo'`, `'pausado'`, `'concluído'`, `'arquivado'`, `'excluído'`
- **Project Category**: `'Conteúdo'`, `'Negócios'`, `'Estudos'`, `'Produto'`
- **Reward Status**: `'em_andamento'`, `'desbloqueada'`, `'resgatada'`, `'arquivada'`, `'excluída'`
- **Reward Priority**: `'baixa'`, `'média'`, `'alta'`
- **Reward Category**: `'Trabalho'`, `'Financeiro'`, `'Saúde'`, `'Casa'`, `'Estudos'`, `'Lazer'`, `'Pessoal'`, `'Outro'`
- **Learning Fields**: (Favorite field must be boolean `true`/`false`. Content and source are free-text. No category enums apply).
- **Experiment Repeat Value**: `'sim'`, `'não'`
- **Experiment Category**: `'ads'`, `'conteúdo'`, `'negócio'`, `'operacional'`, `'produtividade'`, `'estratégia'`, `'outro'`

---

## 7. Proposed AI JSON Response Schema

The future serverless route `/api/lyria-ai-agent.js` will return a single JSON envelope.

### Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "OBJECT",
  "properties": {
    "reply": {
      "type": "STRING",
      "description": "Natural language response in Portuguese explaining what the assistant is proposing."
    },
    "actions": {
      "type": "ARRAY",
      "description": "List of state changes proposed by the AI.",
      "items": {
        "type": "OBJECT",
        "properties": {
          "type": {
            "type": "STRING",
            "enum": ["create"],
            "description": "The action type. Version 1 only supports 'create'."
          },
          "module": {
            "type": "STRING",
            "enum": ["tasks", "finance", "projects", "rewards", "learnings", "experiments"],
            "description": "Target AppContext state key."
          },
          "payload": {
            "type": "OBJECT",
            "description": "Exact payload schema corresponding to the target module. Do not supply id, createdAt, or order."
          },
          "confidence": {
            "type": "NUMBER",
            "minimum": 0.0,
            "maximum": 1.0,
            "description": "Confidence score of the proposed action."
          },
          "requiresConfirmation": {
            "type": "BOOLEAN",
            "enum": [true],
            "description": "Must be true in V1. Requires explicit user approval."
          },
          "summary": {
            "type": "STRING",
            "description": "Short explanation in Portuguese showing what will be created."
          }
        },
        "required": ["type", "module", "payload", "confidence", "requiresConfirmation", "summary"]
      }
    }
  },
  "required": ["reply", "actions"]
}
```

### Example Actions Payloads

#### Tasks Example
```json
{
  "type": "create",
  "module": "tasks",
  "payload": {
    "title": "Criar criativos de anúncios",
    "description": "Preparar 3 variações de vídeo e imagem para o produto X",
    "priority": "alta",
    "status": "pendente",
    "dueDate": "2026-06-30",
    "scheduledDate": "2026-06-26",
    "scheduledTime": "09:00",
    "category": "Marketing",
    "recurrence": "única",
    "recurrenceDay": "",
    "completedDates": []
  },
  "confidence": 0.98,
  "requiresConfirmation": true,
  "summary": "Criar tarefa 'Criar criativos de anúncios' para 26 de junho."
}
```

#### Finance Example
```json
{
  "type": "create",
  "module": "finance",
  "payload": {
    "type": "saída",
    "amount": 250.00,
    "category": "Ferramentas",
    "expenseClass": "Fixo",
    "subcategory": "Assinatura SaaS",
    "source": "ferramentas",
    "date": "2026-06-25",
    "notes": "Assinatura mensal do servidor Vercel Pro",
    "originalDescription": "Vercel subscription",
    "sourceBank": "Importado",
    "accountName": "Cartão Principal",
    "duplicateKey": "",
    "importedFrom": "AI Assistant",
    "reviewStatus": "approved",
    "fixedCostId": null,
    "periodKey": "2026-06"
  },
  "confidence": 0.95,
  "requiresConfirmation": true,
  "summary": "Adicionar despesa de R$ 250,00 na categoria 'Ferramentas'."
}
```

#### Projects Example
```json
{
  "type": "create",
  "module": "projects",
  "payload": {
    "title": "Reestruturação de Tráfego Pago",
    "description": "Revisar funil de vendas e relançar campanhas de retargeting",
    "status": "ativo",
    "category": "Negócios",
    "startDate": "2026-06-25",
    "targetDate": "2026-07-15",
    "completedAt": "",
    "subtasks": []
  },
  "confidence": 0.92,
  "requiresConfirmation": true,
  "summary": "Iniciar projeto 'Reestruturação de Tráfego Pago'."
}
```

#### Rewards Example
```json
{
  "type": "create",
  "module": "rewards",
  "payload": {
    "title": "Viagem de Fim de Semana",
    "description": "Resgatar viagem caso atinja o faturamento estipulado",
    "category": "Lazer",
    "estimatedValue": 1200.00,
    "deadline": "2026-08-01",
    "redeemAvailableDate": "",
    "priority": "média",
    "status": "em_andamento",
    "conditions": [
      {
        "id": "cond-1",
        "text": "Atingir R$ 50k em vendas",
        "completed": false,
        "completedAt": null
      }
    ],
    "notes": "Reservar hotel com antecedência",
    "redeemedAt": "",
    "archivedAt": "",
    "financialTargetAmount": 50000.00,
    "financialCurrentAmount": 15000.00,
    "showOnDashboard": true
  },
  "confidence": 0.94,
  "requiresConfirmation": true,
  "summary": "Adicionar recompensa 'Viagem de Fim de Semana' vinculada a faturamento."
}
```

#### Learnings Example
```json
{
  "type": "create",
  "module": "learnings",
  "payload": {
    "content": "Vídeos curtos de retargeting performam melhor com prova social explícita nos primeiros 3 segundos.",
    "source": "Análise de Campanhas Junho",
    "tags": ["marketing", "trafego", "anuncios"],
    "isFavorite": true,
    "date": "2026-06-25"
  },
  "confidence": 0.97,
  "requiresConfirmation": true,
  "summary": "Salvar aprendizado sobre anúncios de retargeting."
}
```

#### Experiments Example
```json
{
  "type": "create",
  "module": "experiments",
  "payload": {
    "title": "Página de checkout de 1 clique",
    "category": "produto",
    "context": "Reduzir fricção de compras de impulso",
    "whatWasTested": "Substituição do checkout tradicional de 3 etapas por botão expresso",
    "result": "Taxa de conversão de checkout subiu 14%",
    "mainError": "Incompatibilidade inicial com alguns cartões locais",
    "lessonLearned": "Checkouts rápidos aumentam conversão, mas exigem gateways estáveis",
    "repeatThis": "sim",
    "date": "2026-06-25",
    "notes": "Monitorar estornos",
    "tags": ["checkout", "conversao", "cro"]
  },
  "confidence": 0.93,
  "requiresConfirmation": true,
  "summary": "Registrar experimento 'Página de checkout de 1 clique'."
}
```

---

## 8. Validation Rules for Future Executor

Before the client-side module `aiActionExecutor.js` executes `createItem(stateKey, payload)`, it must validate and normalize the incoming payloads using the following rules:

1. **Required Field Verification**:
   - Check if the payload contains all fields marked as **Required** in Section 3. If any required fields are missing, reject the action.

2. **Enum Normalization**:
   - AI models frequently output values in English. The executor must normalize them to Portuguese enums:
     - **Priority**: `'high'` $\rightarrow$ `'alta'`, `'medium'` / `'average'` $\rightarrow$ `'média'`, `'low'` $\rightarrow$ `'baixa'`.
     - **Status**: `'todo'` / `'pending'` $\rightarrow$ `'pendente'`, `'in_progress'` / `'active'` $\rightarrow$ `'em_andamento'`, `'done'` / `'completed'` $\rightarrow$ `'concluída'`.
     - **Finance Type**: `'income'` $\rightarrow$ `'entrada'`, `'expense'` $\rightarrow$ `'saída'`.
     - **Experiment Repeat**: `'yes'` $\rightarrow$ `'sim'`, `'no'` $\rightarrow$ `'não'`.
   - If values cannot be recognized or mapped to the allowed lists, the action must be rejected.

3. **Date and Time Normalization**:
   - Ensure all date fields strictly adhere to `YYYY-MM-DD`. Parse standard Brazilian formats like `DD/MM/YYYY` into `YYYY-MM-DD`.
   - Ensure all time fields adhere to `HH:mm`. If seconds are appended (e.g. `HH:mm:ss`), strip them.
   - Inject the current local client date (`new Date().toISOString().split('T')[0]`) if a date field is missing.

4. **Amount and Financial Values**:
   - Parse all amount-related strings into floating point numbers.
   - Replace comma decimal separators (e.g., `'150,50'`) with dots (e.g., `150.50`).
   - Throw a validation error if any amount value is negative.

5. **Finance Rules**:
   - Verify that the `category` is appropriate for the transaction `type`. If `type === 'saída'`, categories must belong to the expenses subset. If `type === 'entrada'`, it must belong to the income subset.
   - Map unrecognized or invalid category values into `'Outros'` (or `'Outro'`) rather than rejecting.

6. **Ambiguous Information**:
   - If critical information (e.g., amount of a transaction, title of a task) is missing or cannot be inferred from the chat history, the assistant must prompt the user with clarifying questions rather than generating a payload with dummy data.

---

## 9. Infrastructure Notes for Later Phases

### 9.1 Vercel API Rewrite Rules
- The current `vercel.json` contains a catch-all SPA rewrite rule:
  ```json
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
  ```
- **Risk**: A future API route placed under `/api/lyria-ai-agent.js` would be rewritten to `/index.html`, making it unreachable.
- **Solution**: The rewrite rules must be updated to exclude `/api/*`. This can be achieved by placing a bypass rule at the top:
  ```json
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
  ```

### 9.2 TypeScript Compilation Behavior
- The project runs a strict build compilation: `tsc && vite build` (defined in `package.json`).
- `tsconfig.json` contains strict compile rules (`"strict": true`).
- **Guideline**: To prevent build-breaking type errors, all new frontend scripts (including the future executor `aiActionExecutor.js` and assistant UI components) must be written in standard JavaScript (`.js`/`.jsx`) instead of TypeScript (`.ts`/`.tsx`).

### 9.3 Serverless API Security
- Do not make direct AI provider endpoint calls (e.g. OpenAI/Anthropic/Gemini APIs) from frontend code, as it would expose API keys.
- The serverless `/api/lyria-ai-agent.js` route must act as a gateway.
- The API gateway must read the Supabase JWT header (`Authorization: Bearer <token>`) sent by the client, validate it using the Supabase JWT public signing keys, and return `401 Unauthorized` if validation fails.

### 9.4 Token and Context Limits
- The database local cache might grow large over time. 
- The client must not transmit the full database payload to the AI provider.
- Prior to calling the gateway, the client must compile a compact context summary (e.g., listing recent task names, project names, active rewards, and monthly budget sums) to minimize token consumption and speed up inference.

---

## 10. Unknowns / Risks Discovered in Code

1. **Inconsistent Object Property Names**:
   - Mismatches exist between local storage objects and remote sync mappers:
     - Local task field `estimatedHours` (camelCase) is mapped to database field `estimated_hours` (snake_case) but in remote-to-local mapper, it is parsed back to a string rather than a number.
     - Local task field `order` is mapped to remote `list_order`, but local tasks page refers to it as `order` or `list_order` in different modules.
     - Projects subtasks are kept as JSON arrays, which bypasses relational foreign key constraints.
2. **Category / Enum Drift**:
   - Allowed enums (like categories and priorities) are hardcoded inside individual page components (`Finance.jsx`, `Recompensas.jsx`, `Projects.jsx`) rather than a shared enums module. If any developer alters these options, the AI schemas would instantly fall out of sync.
3. **Competing Date Parsers**:
   - The codebase has custom utilities (`toLocalISODate()`, `getToday()`, `formatDate()`) with differing timezone/offset behaviors. The AI executor system must rely strictly on local ISO strings (`YYYY-MM-DD`) matching the browser's current calendar day to avoid offset drift.
4. **Supabase Sync Constraint Risk**:
   - If the AI proposes an invalid category or enum option that is not validated locally, the item will save successfully to `localStorage` (since it does not enforce schemas). However, the background sync operation to Supabase will throw a constraint failure, leading to a sync block or silent data drops. Local validations in `aiActionExecutor.js` are critical.
