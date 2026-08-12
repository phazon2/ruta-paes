#!/usr/bin/env bash
# Ruta PAES — one command, one file, todo lo que necesito ver.
#
# Generalizado desde el state-dump.sh de Contraparte (toolkit del rep anterior).
# Reemplaza el ciclo de screenshots: responde "que hay desplegado y esta vivo"
# sin que Diego tenga que describir nada.
#
#   bash state-dump.sh          # escribe ruta-paes-state.md en el directorio actual
#
# Solo necesita curl. Sin clone, sin credenciales, sin instalar nada.
# NUNCA imprime valores de secretos: solo si estan presentes (booleano).

set -uo pipefail
REPO="phazon2/ruta-paes"
APP="https://ruta-paes.vercel.app"
OUT="ruta-paes-state.md"
CB="cb=$(date +%s)"          # cache-buster: raw.githubusercontent cachea ~5 min

raw() { curl -fsSL "https://raw.githubusercontent.com/$REPO/main/$1?$CB" 2>/dev/null; }

# marker <archivo> <etiqueta> <aguja>  -> una linea PRESENTE/AUSENTE
marker() {
  local body; body=$(raw "$1")
  if [ -z "$body" ]; then printf -- "- %-46s ARCHIVO FALTA\n" "$2"; return; fi
  if printf '%s' "$body" | grep -qF -- "$3"; then
    printf -- "- %-46s PRESENTE\n" "$2"
  else
    printf -- "- %-46s AUSENTE\n" "$2"
  fi
}

{
echo "# Ruta PAES — estado desplegado"
echo
echo "Generado: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo
echo "## Ultimo commit en main"
echo '```'
curl -fsSL "https://api.github.com/repos/$REPO/commits/main?$CB" 2>/dev/null \
  | grep -o '"message": *"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//' \
  || echo "(API de GitHub no disponible)"
echo '```'
echo
echo "## Precio y ancla"
marker lib/exams.js  "PAES a 9.990"                      '"9.990"'
marker lib/exams.js  "ancla nueva (profe particular)"    "menos que una hora de profe particular"
marker lib/exams.js  "PAES sin el precio viejo (AUSENTE esperado)" '"2.990"'
echo
echo "## Orden invertido: WhatsApp antes del pago"
marker app/ui.js     "CTA manda a WhatsApp"              "te paso el link de pago"
marker app/ui.js     "mensaje prellenado"                "Quiero mi Ruta"
marker app/ui.js     "ya no pide tipear el monto (AUSENTE esperado en la rama con WSP)" "En Mercado Pago ingresa el monto"
echo
echo "## Links de monto fijo (los 5)"
for l in 31bsftj 2MYD66q 2rMuFsU 1MAXMpe 2DV3pVZ; do
  if raw lib/exams.js | grep -qF "$l" || raw lib/products.js | grep -qF "$l"; then
    printf -- "- %-46s PRESENTE\n" "mpago.la/$l"
  else
    printf -- "- %-46s AUSENTE\n" "mpago.la/$l"
  fi
done
echo
echo "## Entrega y candado del pack"
marker app/ui.js                  "vista de entrega ?pack=1"        'get("pack")'
marker app/ui.js                  "boton imprimir a PDF"            "Imprimir / Guardar como PDF"
marker app/globals.css            "estilos de impresion"            "@media print"
marker app/api/diagnostico/route.js "recorte en el servidor"        "recortarParaVisitante"
marker app/api/diagnostico/route.js "candado falla cerrado"         "PACK_KEY"
echo
echo "## Guardas de completitud y de tiempo"
marker lib/gemini.js              "drills antes que ruta"           "de la ruta y nunca los drills"
marker lib/gemini.js              "validacion de pack completo"     "packCompleto"
marker lib/gemini.js              "reintento con presupuesto"       "PRESUPUESTO_REINTENTO_MS"
marker app/api/diagnostico/route.js "QA con presupuesto adaptativo" "sin presupuesto para QA"
echo
echo "## App en vivo"
code=$(curl -o /dev/null -s -w '%{http_code}' "$APP/paes" 2>/dev/null)
echo "- HTTP /paes: ${code:-inalcanzable}"
echo
echo "### /api/health (solo booleanos, nunca valores)"
echo '```'
curl -fsSL "$APP/api/health?$CB" 2>/dev/null || echo "(sin respuesta)"
echo '```'
echo
echo "### Pipeline completo (diagnostico + QA + oplog)"
echo '```'
curl -fsSL -m 90 "$APP/api/health?full=1&$CB" 2>/dev/null || echo "(sin respuesta o timeout)"
echo '```'
echo
echo "### Candado: un visitante sin clave NO debe recibir el pack"
echo '```'
# Solo curl y grep: node no esta en el PATH de Git Bash en el PC de Diego.
#
# Se mide el LARGO REAL de lo entregado contando los elementos del array, no el
# campo "dias" del payload: ese campo lleva el total generado (metadato) y no lo
# que se entrego. Confundirlos hacia que el chequeo dijera 13 cuando el visitante
# habia recibido 8.
RESP=$(curl -fsSL -m 90 -X POST "$APP/api/diagnostico" \
  -H "Content-Type: application/json" \
  -d '{"scores":{"prueba":"Matemática M1","puntaje":"612"},"examId":"paes"}' 2>/dev/null)

if [ -z "$RESP" ]; then
  echo "(sin respuesta)"
else
  full=$(printf '%s' "$RESP"    | grep -o '"full":[a-z]*'      | head -1 | cut -d: -f2)
  ruta=$(printf '%s' "$RESP"    | grep -o '"dia":[0-9]*'       | wc -l | tr -d ' ')
  drills=$(printf '%s' "$RESP"  | grep -o '"enunciado":'       | wc -l | tr -d ' ')
  soluc=$(printf '%s' "$RESP"   | grep -o '"solucion":'        | wc -l | tr -d ' ')
  ms=$(printf '%s' "$RESP"      | grep -o '"totalMs":[0-9]*'   | head -1 | cut -d: -f2)
  echo "full=${full:-?} ruta_entregada=${ruta} drills=${drills} soluciones=${soluc} totalMs=${ms:-?}"
fi
echo '```'
echo "Esperado: full=false, ruta_entregada=8, drills=2, soluciones=1."
echo "soluciones=2 significa que se esta regalando la solucion del segundo ejercicio."
echo "full=true o ruta_entregada>8 significa que el candado esta abierto."
echo "totalMs cerca de 60000 significa que se esta rozando el techo de la funcion."
} > "$OUT"

echo "escrito $OUT"
echo "--- mandale este archivo a Claude ---"
