# Knowledge base de clasificación de correos

Proton Suite Agent usa un knowledge base embebido de reglas heurísticas para clasificar correos en categorías profesionales y detectar riesgos. Este documento describe las convenciones y criterios que el agente aplica.

## Filosofía de la clasificación

- **Local y privada:** no se envía contenido a modelos externos.
- **Explicable:** cada clasificación indica qué patrones coincidieron.
- **Sugerida, no impuesta:** el agente presenta propuestas; el operador las confirma (modo dry-run por defecto).
- **Configurable:** `AGENT_MIN_CONFIDENCE` (0-1) ajusta el umbral de aceptación.

## Categorías profesionales

### Legal

Correos relacionados con derecho, contratos, litigios, propiedad intelectual, confidencialidad y normativa.

**Palabras clave indicativas:** `lawyer`, `abogado`, `bufete`, `despacho`, `judicial`, `juzgado`, `demanda`, `contrato`, `agreement`, `NDA`, `non-disclosure`, `propiedad intelectual`, `court`, `tribunal`, `sentencia`, `resolución`.

**Carpeta sugerida:** `Legal`  
**Etiquetas:** `legal`, `keep`

### Administrativo / Fiscal

Correos de gestión administrativa, tributaria, laboral, registros públicos y certificados digitales.

**Palabras clave indicativas:** `hacienda`, `agencia tributaria`, `AEAT`, `IRPF`, `IVA`, `Seguridad Social`, `TGSS`, `registro mercantil`, `ayuntamiento`, `certificado digital`, `FNMT`, `@firma`, `gestoría`, `gestor`.

**Carpeta sugerida:** `Admin`  
**Etiquetas:** `admin`, `keep`

### Gobierno / Institucional

Comunicaciones de organismos públicos, subvenciones, citas y trámites oficiales.

**Palabras clave indicativas:** `gobierno`, `ministerio`, `delegación`, `conselleria`, `generalitat`, `junta`, `subvención`, `ayuda`, `convocatoria`, `procedimiento`, `expediente`, `resolución`, `DNI`, `NIE`, `pasaporte`, `cita previa`.

**Carpeta sugerida:** `Gobierno`  
**Etiquetas:** `official`, `keep`

### Banca / Finanzas

Correos bancarios, pagos, transferencias, facturas, nóminas y seguros.

**Palabras clave indicativas:** `bank`, `banco`, `cuenta`, `IBAN`, `transferencia`, `ingreso`, `cargo`, `recibo`, `tarjeta`, `pago`, `PayPal`, `Stripe`, `factura`, `extracto`, `nómina`, `hipoteca`, `préstamo`, `seguro`.

**Carpeta sugerida:** `Banca`  
**Etiquetas:** `bank`, `keep`

### Tecnología / Infraestructura

Alertas de sistemas, CI/CD, dependencias, APIs, incidentes y desarrollo.

**Palabras clave indicativas:** `git`, `GitHub`, `GitLab`, `CI/CD`, `deploy`, `build`, `error`, `incident`, `alert`, `monitoring`, `downtime`, `API`, `SDK`, `library`, `vulnerability`, `CVE`, `server`, `database`, `cloud`, `pull request`, `release`, `version`.

**Carpeta sugerida:** `Tech`  
**Etiquetas:** `tech`, `devops`

### Comercial

Correos de ventas, clientes, cotizaciones, propuestas y partnerships.

**Palabras clave indicativas:** `sales`, `ventas`, `lead`, `oportunidad`, `cotización`, `presupuesto`, `pedido`, `invoice`, `factura`, `partnership`, `colaboración`, `sponsor`, `demo`, `presentación`.

**Carpeta sugerida:** `Comercial`  
**Etiquetas:** `commercial`

### Personal

Correos de ámbito privado: familia, viajes, salud, eventos sociales.

**Palabras clave indicativas:** `familia`, `casa`, `viaje`, `vuelo`, `hotel`, `cita médica`, `salud`, `receta`, `cumpleaños`, `invitación`, `boda`, `fiesta`.

**Carpeta sugerida:** `Personal`  
**Etiquetas:** `personal`

## Detección de amenazas

### Phishing / suplantación

- Dominios de primer nivel de alto riesgo (`ru`, `tk`, `ml`, `ga`, `cf`, `xyz`, `top`, `click`, `link`).
- Uso de acortadores (`bit.ly`, `tinyurl`).
- Dominios que contienen `proton` seguidos de TLD sospechoso.

### Solicitud de credenciales

- Frases como "enter your password", "verify your account", "confirm your credentials" y sus equivalentes en español.

### Presión de urgencia

- Frases como "urgent", "immediate", "action required", "24 hours" y equivalentes en español.

### Adjuntos sospechosos

- Extensiones ejecutables o con macros: `exe`, `zip`, `scr`, `js`, `vbs`, `docm`, `xlsm`.

## Cómo ampliar el knowledge base

Las reglas viven en `src/alerts/rules.ts`. Para añadir una categoría:

1. Añade una entrada al array `RULES` con `category`, `severity`, `suggestedFolder`, `suggestedLabels` y `patterns`.
2. Para amenazas específicas, añade una entrada al array `checks` de `detectThreats`.
3. Ejecuta `pnpm test` y añade un caso de test en `tests/alerts.test.ts`.

No uses expresiones regulares que procesen cuerpos completos de correo de forma insegura; mantén los patrones orientados a palabras clave y estructuras.
