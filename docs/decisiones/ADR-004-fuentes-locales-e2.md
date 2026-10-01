# ADR-004 · Fuentes locales para E2

Fecha: 2026-10-01 · Estado: **aceptado parcialmente**: E2.1–E2.3 cerradas; E2.4 autorizada.

## Contexto

E2 debe cumplir RF-03 y CA-02: un responsable carga una fuente en su espacio, el sistema la procesa y muestra si quedó lista o falló; un error se puede reintentar sin duplicar resultados. E1 está cerrada en `7627580` con identidad, membresías, autorización central y auditoría. ADR-002 activa el worker desde E2. ADR-003 dejó como propuesta pendiente `pg-boss` y aplazó el almacenamiento de archivos. La etapa sigue siendo exclusivamente local. No incluye IA, embeddings, búsqueda, lecciones, conectores ni servicios contratados.

Hechos verificados en el repositorio y la documentación instalada:

- La pila Supabase CLI local ya ejecuta Storage (contenedor `supabase_storage_stepable`), con `file_size_limit = "50MiB"` global. `config.toml` admite buckets privados declarados.
- Next.js 16.3.5 limita los Server Actions a 1 MB por defecto. Con `proxy.ts` activo, Next guarda en memoria el cuerpo de cada solicitud hasta 10 MB y no conserva lo que exceda ese límite (documentación incluida en `node_modules/next/dist/docs`, `serverActions.md` y `proxyClientMaxBodySize.md`).

## Resolución parcial del 2026-10-01 (E2.1)

El usuario autorizó implementar E2.1 con Markdown y conservar la secuencia E2.2–E2.4, con tres ajustes:

1. **Contenido mínimo:** se aceptan documentos cortos con contenido útil. Solo se rechazan los vacíos, sin el umbral de 200 caracteres.
2. **Trabajos:** se prioriza `pg-boss`, como preveía ADR-003. Que gestione su propio esquema no justifica por sí solo una cola propia. Encaje resuelto:
   - el esquema se versiona como migración SQL generada por la CLI oficial (`plans create --dry-run`);
   - las instancias arrancan con `migrate: false` y `createSchema: false`;
   - el trabajo se encola en la misma transacción que crea la versión (`fromDrizzle`);
   - expiración, reintentos y supervisión los aporta pg-boss.

   La alternativa de cola propia queda descartada.
3. **Conservación y eliminación:** se decidirán al implementar reemplazo (E2.3) y borrado (E2.4). No bloquean E2.1.

Se aplican en E2.1:
- Storage local con bucket privado;
- carga por Route Handler;
- extracción Markdown sin dependencia;
- acciones `consultar_fuentes` y `gestionar_fuentes`;
- límites de Markdown y cuota por espacio;
- estados visibles y manejo básico de errores;
- uso exclusivo de documentos sintéticos.

`pdfjs-dist` sigue propuesto para E2.2.

## Resolución de E2.2 del 2026-10-01

El usuario aceptó los límites de PDF (≤ 8 MiB, ≤ 200 páginas, sin cifrar, sin OCR) y autorizó implementar E2.2 con `pdfjs-dist` si era compatible. Se verificó `pdfjs-dist` 6.3.289:
- declara compatibilidad con Node `>=22.13.0 || >=24` y el entorno usa Node 24.19;
- funciona en Node con la compilación `legacy`, sin la dependencia opcional de canvas;
- ya no contiene generación de código (`eval`/`new Function`), por lo que la mitigación prevista con `isEvalSupported` dejó de existir y de ser necesaria.

Se rechaza cualquier PDF con diccionario de cifrado, aunque solo tenga contraseña de propietario, para cumplir “sin cifrar”.

## Resolución de E2.3 del 2026-10-01

El usuario autorizó el reemplazo y el reintento manual:
- solo para responsables activos;
- una candidata por fuente y cambio atómico;
- la vigente se conserva ante un fallo;
- hasta 3 reintentos sin trabajos duplicados;
- sustitución de una versión fallida por un archivo corregido.

Decidió conservar por ahora todas las versiones anteriores, sin historial visible y sin purga, hasta resolver la retención en E2.4. Esto sustituye, por ahora, la propuesta inicial de purgar las versiones reemplazadas.

## Alternativas consideradas

| Tema | Alternativa | Evaluación |
| --- | --- | --- |
| Originales | Supabase Storage local, bucket privado | Ya está en la pila. No añade servicios. Es sustituible mediante un adaptador. **Propuesta** |
| | `bytea` en PostgreSQL | Es transaccional y evita archivos huérfanos, pero mezcla archivos con el estado de negocio, engorda la base y contradice el componente de archivos privados del documento 04 |
| | Sistema de archivos local o MinIO | El primero queda fuera de la pila y de sus copias. MinIO duplica un servicio que ya existe |
| Trabajos | Tabla propia en PostgreSQL con `FOR UPDATE SKIP LOCKED` y reserva con vencimiento | Encaja con el historial único `supabase/migrations`. El estado es visible y se puede unir con las fuentes. Se implementa con poco código. **Propuesta** |
| | `pg-boss` | Biblioteca madura, pero gestiona su propio esquema fuera del historial de migraciones aceptado y ofrece más capacidades (cron, publicación) de las que E2 necesita. Se reevaluará si E3 y E4 requieren varios tipos de trabajo con planificación |
| | Procesar dentro de la solicitud web | Contradice ADR-002. Un PDF lento bloquearía la web y no habría recuperación tras una caída |
| Extracción de PDF | `pdfjs-dist` (pdf.js de Mozilla) | Es JavaScript puro, sin binarios del sistema. Entrega el texto por página, que sirve para citas futuras, y detecta PDF cifrados. Licencia Apache-2.0. **Propuesta** |
| | `pdf-parse`, `unpdf` | Envoltorios de pdf.js con menos control sobre las páginas y los errores |
| | `pdftotext` (Poppler) | Binario del sistema, no reproducible con `pnpm install` |
| Extracción de Markdown | Lectura UTF-8 estricta y segmentación por encabezados, sin dependencia | E2 no renderiza Markdown y por tanto no expone superficie de HTML activo. Una biblioteca de análisis completo no aporta valor todavía |
| Carga HTTP | Route Handler `multipart/form-data` | Evita el límite de 1 MB de Server Actions. El documento 04 ya define los Route Handlers como adaptador HTTP. **Propuesta** |

## Decisión

1. Formatos, límites, almacenamiento y procesamiento según el [documento 04 §19](../04-arquitectura.md#19-fuentes-locales-en-e2).
2. Vigencia, reemplazo y eliminación según RN-19–RN-24 del [documento 03](../03-flujos-y-reglas.md#ciclo-de-vida-de-fuentes-e2).
3. Permisos, modelo y retención según el [documento 05](../05-datos-y-permisos.md#fuentes-e2).
4. Plan E2.1–E2.4 según el [documento 07](../07-entregas-y-aceptacion.md#plan-de-e2).

## Consecuencias

- Se añade un segundo ejecutable (`worker`) que comparte módulos con la web. El desarrollo local requiere arrancarlo en otra terminal y las pruebas E2E deben levantarlo.
- El servicio Storage de Supabase pasa a ser una dependencia funcional local. El piloto deberá revisar proveedor, copias y costos de archivos (PEN-07).
- Con `pg-boss`, una actualización de la biblioteca exige generar y revisar una migración nueva, porque las instancias no migran en tiempo de ejecución. La cola propia que se proponía quedó descartada en la resolución de E2.1.
- `pdfjs-dist` debe fijarse en una versión exacta con la corrección de CVE-2024-4367 (ejecución de código mediante fuentes cuando `isEvalSupported` está activo) y usarse con `isEvalSupported: false`. La compatibilidad con Node 24 y la ruta de importación se verifican en la documentación oficial al iniciar E2.2.
- La conservación de versiones reemplazadas y la eliminación se decidirán en E2.3/E2.4. E3 y E4 podrían necesitar conservar versiones citadas por rutas publicadas (RN-05, RN-06).

## Aprobaciones pendientes

Se resumen en el [estado actual](../09-estado-actual.md#decisiones-que-requieren-aprobación).

