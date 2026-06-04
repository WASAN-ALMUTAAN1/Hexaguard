# Hexaguard Final Connected Frontend

This package contains the final connected frontend for Hexaguard.

## Pages

```text
index.html
manual-red-teaming.html
prompt-sandbox.html
```

## Shared connection files

```text
assets/js/config.js
assets/js/apiClient.js
```

## Page-specific logic

```text
assets/js/app.js
assets/js/manualRedTeaming.js
assets/js/promptSandbox.js
```

## Page-specific styles

```text
assets/css/styles.css
assets/css/manual-red-teaming.css
assets/css/prompt-sandbox.css
```

## Run locally

```bash
python3 -m http.server 5173
```

Open:

```text
http://localhost:5173/index.html
http://localhost:5173/manual-red-teaming.html
http://localhost:5173/prompt-sandbox.html
```

## Backend connection

Open:

```text
assets/js/config.js
```

Set:

```js
MOCK_MODE: false
```

Then update:

```js
API_BASE_URL: "https://backend-domain.com/api"
```

## Connected modules

- Scenario Library
- Manual Red Teaming Workspace
- Prompt Risk Sandbox
