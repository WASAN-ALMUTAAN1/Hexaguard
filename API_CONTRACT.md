# Hexaguard Frontend API Contract

## Base URL

Configured in:

```text
assets/js/config.js
```

---

# Scenario Library

## List scenarios

```http
GET /api/scenarios
```

## Create scenario

```http
POST /api/scenarios
```

## Run scenario

```http
POST /api/scenarios/{id}/run
```

## Replay scenario

```http
POST /api/scenarios/{id}/replay
```

## Import dataset

```http
POST /api/datasets/import
```

## Generate attack

```http
POST /api/attacks/generate
```

## Add scenario to campaign

```http
POST /api/campaigns/scenarios
```

## Export library

```http
POST /api/scenarios/export
```

## Generate intelligence report

```http
POST /api/reports/intelligence
```

---

# Manual Red Teaming Workspace

## Get manual session

```http
GET /api/manual-red-team/session
```

## Configure manual attack

```http
POST /api/manual-red-team/configure
```

## Save manual prompt

```http
POST /api/manual-red-team/prompt
```

## Run manual attack

```http
POST /api/manual-red-team/run
```

## Submit manual verdict

```http
POST /api/manual-red-team/verdict
```

## Save manual result

```http
POST /api/manual-red-team/results
```

## Generate manual report

```http
POST /api/manual-red-team/reports
```

## Add manual result to dataset

```http
POST /api/manual-red-team/dataset
```

## Send manual result to review queue

```http
POST /api/manual-red-team/review-queue
```

## Create manual incident

```http
POST /api/manual-red-team/incidents
```

## Add manual result to campaign

```http
POST /api/manual-red-team/campaigns
```

## Replay manual attack

```http
POST /api/manual-red-team/replay/{id}
```

---

# Prompt Risk Sandbox

## Get sandbox session

```http
GET /api/sandbox/session
```

## Analyze sandbox prompt

```http
POST /api/sandbox/analyze
```

## Apply sandbox mutation

```http
POST /api/sandbox/mutation
```

## Save sandbox result

```http
POST /api/sandbox/results
```

## Export sandbox report

```http
POST /api/sandbox/reports
```
