---
name: pass-audit
description: Auditoría de fortaleza del vault Pass (pass|gopass) — débiles, duplicados, stale y plan de rotación.
---

# Auditoría de Pass

## Objetivo

Revisar la fortaleza del vault: contraseñas débiles, duplicadas, entradas
stale (mtime antiguo) y un `rotationPlan` accionable.

## Prerrequisitos

- `pass` o `gopass` instalado.
- `PROTON_PASS_ENABLED=true`.
- `PROTON_PASS_STORE_DIR` (o `GOPASS_STORE_DIR` si `PROTON_PASS_BACKEND=gopass`).

## Flujo

### 1. Dry-run (recomendado)

```bash
AGENT_DRY_RUN=true pnpm exec protonsuite-agent pass-audit
# o: npx -y @alexendros/protonsuite-agent pass-audit
```

### 2. Revisar el informe

- Total de entradas.
- Débiles / duplicados / stale.
- `rotationPlan`: `{ path, reason, action: regenerate }`.

### 3. Aplicar rotación (explícito)

```bash
AGENT_DRY_RUN=false pnpm exec protonsuite-agent pass-audit
```

Regenera solo las entradas del plan (valores nunca se loguean).

### 4. Alternativa MCP

```
proton_pass_generate path="servicios/entry-debil" length=24
```

## Verificación

Repite el dry-run: 0 débiles / 0 duplicados / plan vacío (salvo stale por política).

## Seguridad

- Valores NUNCA en logs ni respuestas MCP ([CONSTITUTION.md](../CONSTITUTION.md) §5).
- Evaluación local; dry-run por defecto (ADR-004).
