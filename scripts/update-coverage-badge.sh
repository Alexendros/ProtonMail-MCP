#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# update-coverage-badge.sh
#
# Genera coverage-badge.json para shields.io endpoint badge (gh-pages).
# También actualiza el texto de cobertura en la sección de calidad del README.
#
# Uso:
#   bash scripts/update-coverage-badge.sh              # corre vitest + genera
#   bash scripts/update-coverage-badge.sh --skip-run    # solo procesa JSON existente
#   bash scripts/update-coverage-badge.sh --check       # verifica badge JSON sin modificar
# ---------------------------------------------------------------------------
set -euo pipefail

COVERAGE_FILE="coverage/coverage-summary.json"
BADGE_FILE="coverage/coverage-badge.json"
README="README.md"
mode="${1#--}"
MODE="${mode:-update}"

# ── 1. Ejecutar vitest solo si es necesario ──────────────────────────────
if [[ "$MODE" == "update" ]]; then
  echo "→ Running vitest --coverage …"
  npx vitest run --coverage --reporter=default 2>/dev/null
fi

# ── 2. Leer coverage del JSON ────────────────────────────────────────────
if [[ ! -f "$COVERAGE_FILE" ]]; then
  echo "❌ $COVERAGE_FILE not found. Run 'vitest run --coverage' first."
  exit 1
fi

PCT=$(node -e "
const fs = require('fs');
const r = JSON.parse(fs.readFileSync('${COVERAGE_FILE}', 'utf-8'));
console.log(r.total.statements.pct.toFixed(2));
")

echo "→ Coverage: $PCT% statements"

# ── 3. Elegir color según rango ──────────────────────────────────────────
PCT_INT="${PCT%.*}"
if (( PCT_INT >= 90 )); then
  COLOR="brightgreen"
elif (( PCT_INT >= 80 )); then
  COLOR="yellowgreen"
elif (( PCT_INT >= 70 )); then
  COLOR="yellow"
else
  COLOR="red"
fi

# ── 4. Generar coverage-badge.json para shields.io endpoint ─────────────
mkdir -p coverage
cat > "$BADGE_FILE" <<EOF
{
  "schemaVersion": 1,
  "label": "coverage",
  "message": "${PCT}%",
  "color": "${COLOR}",
  "logo": "vitest"
}
EOF
echo "✅ $BADGE_FILE generated: ${PCT}% (${COLOR})"

# ── 5. Modo check — verificar que badge JSON coincide con cobertura ──────
if [[ "$MODE" == "check" ]]; then
  if [[ ! -f "$BADGE_FILE" ]]; then
    echo "❌ $BADGE_FILE not found"
    exit 1
  fi
  CURRENT_PCT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('${BADGE_FILE}','utf-8')).message)")
  if [[ "${CURRENT_PCT}" != "${PCT}%" ]]; then
    echo "❌ Badge out of date: JSON has ${CURRENT_PCT}, actual is ${PCT}%"
    exit 1
  fi
  echo "✅ Badge JSON is up to date ($PCT%)"
  exit 0
fi

# ── 6. Actualizar texto en sección de calidad del README ─────────────────
QUALITY_TEXT_PATTERN='npm run coverage'
QUALITY_LINE=$(grep -n "$QUALITY_TEXT_PATTERN" "$README" | head -1 || true)
if [[ -n "$QUALITY_LINE" ]]; then
  LINE_NUM=$(echo "$QUALITY_LINE" | cut -d: -f1)
  sed -i "${LINE_NUM}s|[0-9.]\\+% statements|${PCT}% statements|" "$README"
  echo "✅ Quality section coverage text updated to $PCT%"
fi
