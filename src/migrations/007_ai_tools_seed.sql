-- 007_ai_tools_seed.sql
-- Seed brand_kits (one per client, only if table is empty)
-- Seed tool_knowledge_bases (8 entries, idempotent with ON CONFLICT DO NOTHING)
-- Run this in your Supabase SQL editor

-- ─── Brand Kits ───────────────────────────────────────────────────────────────
-- Inserts one empty kit per existing client, only if brand_kits is completely empty

INSERT INTO brand_kits (client_id, name, colors, fonts, voice, audiences, differentiators, do_not)
SELECT
  c.id,
  c.name,
  '',
  '',
  '',
  '',
  '',
  ''
FROM clients c
WHERE NOT EXISTS (SELECT 1 FROM brand_kits LIMIT 1)
ON CONFLICT (client_id) DO NOTHING;

-- ─── Tool Knowledge Bases ─────────────────────────────────────────────────────

INSERT INTO tool_knowledge_bases (tool_key, title, content) VALUES

('ideas', 'Framework de Ideas de Anuncios Meta', $$
## NIVELES DE CONCIENCIA (Schwartz)
0. Sin conciencia — no sabe que tiene el problema
1. Consciente del problema — sabe que sufre, no sabe la solución
2. Consciente de la solución — sabe que existen soluciones, no conoce la tuya
3. Consciente del producto — conoce tu producto, no está convencido
4. Más consciente — conoce y quiere, solo necesita la oferta correcta

## ÁNGULOS DE VENTA PROBADOS
- Transformación: antes/después (resultado específico)
- Miedo/Urgencia: consecuencia de NO actuar
- Curiosidad: dato inesperado, pregunta sin respuesta
- Autoridad/Prueba social: testimonios, números, casos reales
- Identidad: "Para personas que..." (pertenencia)
- Valor/Ahorro: costo vs beneficio explícito
- Problema→Agitación→Solución (PAS)
- Historia personal o de cliente

## HOOKS QUE PARAN EL SCROLL (primeras 3 palabras importan)
- Pregunta directa al dolor: "¿Sigues pagando...?"
- Afirmación polémica: "Lo que te dijeron sobre X está mal"
- Dato con número: "El 73% de los [audiencia] no saben que..."
- Resultado específico: "[Nombre] pasó de X a Y en Z días"
- Comando directo: "Para si eres [audiencia]"

## REGLAS 2026 MERCADO COLOMBIANO META ADS
- El copy debe sonar como una persona hablando, no como una marca
- Emojis estratégicos (máx 2-3), no decorativos
- Precio visible en el anuncio aumenta CTR cualificado
- Video reels hasta 15s superan a los de 30s en reconocimiento
- Carrusel sigue siendo el rey para e-commerce y joyería
- Testimonios en video (aunque sean simples) convierten 2-4x más
- Audiencias amplias + creativos fuertes > audiencias hipersegmentadas
$$),

('estrategia', 'Framework de Estrategia Meta Ads', $$
## ESTRUCTURA DE CAMPAÑA RECOMENDADA
### Funnel Completo (presupuesto > $1M COP/mes)
- TOFU (40%): Reconocimiento/Tráfico — audiencias frías, contenido de valor
- MOFU (30%): Consideración — remarketing visitantes, lookalike de compradores
- BOFU (30%): Conversión — remarketing cálido, oferta directa, urgencia

### Campaña Única (presupuesto < $1M COP/mes)
- 1 campaña de Mensajes o Tráfico
- 3-5 conjuntos de anuncios (segmentos distintos)
- 3-5 creativos por conjunto (diferentes hooks y formatos)

## SEGMENTACIÓN
- Frío: intereses amplios del nicho + demográficos básicos
- Tibio: visitantes sitio web (180 días), interactuaron con perfil (365 días)
- Caliente: lista de clientes, compradores previos, mensajes previos
- Lookalike: 1-3% de compradores o mejores clientes

## PRESUPUESTO MÍNIMOS (Colombia 2025)
- CPM promedio Colombia: $3.000-$8.000 COP
- Mínimo recomendado por conjunto: $15.000 COP/día
- Fase de aprendizaje: 50 conversiones en 7 días
- Escalar: +20% cada 3-5 días si ROAS > objetivo

## FASES
1. Diagnóstico (semana 1): auditar cuenta, identificar ganadores, parar perdedores
2. Estabilización (semana 2-3): optimizar presupuesto hacia ganadores
3. Escala (mes 2+): aumentar presupuesto + expandir audiencias

## MÉTRICAS CLAVE
- CPM < $6.000 COP: buen alcance
- CTR > 1%: copy e imagen relevantes
- CPC < $300 COP: tráfico eficiente
- Frecuencia < 3.0: evitar fatiga de anuncio
- ROAS > 3.0: campaña rentable (varía por margen)
$$),

('mercado', 'Framework de Investigación de Mercado Colombia', $$
## COMPORTAMIENTO DEL CONSUMIDOR COLOMBIANO EN META
- Horarios pico: 7-9am, 12-2pm, 7-10pm (lunes a viernes)
- Fines de semana: 10am-12pm y 7-9pm
- Dispositivo dominante: móvil (>85% del tráfico)
- Plataforma preferida por edad: 18-34 años (Instagram), 35-55 años (Facebook)

## NICHOS CON ALTO RENDIMIENTO EN COLOMBIA
- Moda y accesorios: ROAS promedio 4-8x, carrusel funciona bien
- Salud y bienestar: video testimonios + antes/después
- Servicios B2B (consultorías): lead gen con formularios nativos
- Educación online: webinars + urgencia de precio
- Joyería artesanal: carrusel de producto + historia de marca
- Restaurantes/comida: video de producto en menos de 10s

## ANÁLISIS DE COMPETIDORES EN META
1. Buscar en Biblioteca de anuncios de Meta (ads.facebook.com/ads/library)
2. Filtrar por país: Colombia
3. Analizar: formatos usados, frecuencia de publicación, ángulos de copy
4. Identificar gaps: qué NO están diciendo que podemos capitalizar

## SEÑALES DE OPORTUNIDAD
- Alta demanda, baja competencia en anuncios pagos
- Competidores con anuncios de baja calidad o desactualizados
- Preguntas recurrentes sin respuesta en comentarios de competidores
- Tendencias de búsqueda crecientes en el nicho (Google Trends)
$$),

('oferta', 'Framework de Oferta Irresistible', $$
## ANATOMÍA DE UNA OFERTA IRRESISTIBLE
1. RESULTADO ESPECÍFICO: qué exactamente obtiene (con números si es posible)
2. TIEMPO: en cuánto tiempo lo obtiene
3. PARA QUIÉN: identificación del cliente ideal (inclusión/exclusión)
4. MECANISMO ÚNICO: por qué tu método es diferente
5. PRECIO Y VALOR PERCIBIDO: stack de valor mayor al precio
6. ELIMINACIÓN DE RIESGO: garantía o promesa
7. URGENCIA/ESCASEZ: razón legítima para actuar ahora

## VALUE STACK (Cómo mostrar valor)
- Lista todos los componentes de lo que incluyes
- Asigna un valor en COP a cada componente
- Suma el valor total
- Revela el precio real (significativamente menor)
- Ejemplo: "Vale $450.000 · Hoy lo tienes por $150.000"

## TIPOS DE GARANTÍA
- Satisfacción: "Si no quedas feliz, te devolvemos el dinero"
- Resultado: "Si no obtienes X en Y días, te hacemos devolución"
- Inversión: "Si no recuperas tu inversión en Z meses, seguimos sin costo"
- Doble garantía: Resultado + devolución de dinero

## COPY PARA OFERTA (estructura PAS)
P - Problema: "¿Sigues [síntoma del dolor]?"
A - Agitación: "Esto pasa porque [causa raíz], y mientras no lo resuelvas..."
S - Solución: "Por eso creamos [producto]: [resultado específico] en [tiempo] para [audiencia]"
CTA: verbo de acción + beneficio + urgencia
$$),

('carrusel', 'Framework de Carrusel Meta Ads', $$
## ESTRUCTURA GANADORA DE CARRUSEL
### Slide 1 (HOOK): Lo que para el scroll
- Título: promesa específica o pregunta poderosa
- Visual: lo más impactante, el "después" si es antes/después
- No revelar todo: dejar curiosidad para que deslicen

### Slides 2-N-1 (DESARROLLO): Cuerpo del contenido
- Cada slide = 1 solo mensaje, no sobrecargues
- Mantener coherencia visual (misma paleta, fuente, layout)
- Progresión lógica: problema → desarrollo → solución
- Números y datos concretos > afirmaciones generales

### Slide N (CTA): El cierre
- CTA específico y con beneficio claro
- "Ver catálogo" < "Elige tu estilo"
- "Escribir" < "Dinos qué te gustó"
- Incluir imagen de producto/marca fuerte

## COPY POR SLIDE
- Título: máx 30 caracteres (se lee de un golpe)
- Subtítulo/Descripción: máx 90 caracteres
- Total texto visible: máx 20% del área de imagen

## TIPOS DE CARRUSEL QUE FUNCIONAN
- Antes/Después de producto o transformación
- Lista de [N] razones/beneficios/errores
- Paso a paso de un proceso
- Comparación nuestra marca vs problema sin resolver
- Testimonios uno por slide (con foto si es posible)
- Catálogo de productos (e-commerce)

## FORMATOS TÉCNICOS
- Cuadrado 1:1 (1080x1080px): mejor para feed
- Vertical 4:5 (1080x1350px): mayor espacio en móvil
- Máx 10 slides
$$),

('dm', 'Framework de Mensajes DM para Conversión', $$
## PRINCIPIOS DE DM EFECTIVO
1. Personalización > templating (menciona algo específico de su interacción)
2. Valor antes de vender (da algo útil en el primer mensaje)
3. Preguntas abiertas para calificar y generar conversación
4. 1 mensaje = 1 idea (no poner todo en el primer mensaje)
5. Emojis solo si el tono de la marca los usa normalmente

## SECUENCIA DE CONVERSIÓN (5 mensajes)
1. Apertura (inmediata): reconocer su acción + pregunta de calificación
2. Seguimiento (24h sin respuesta): valor + nueva pregunta o propuesta
3. Nutrición (48h): dato relevante o contenido de valor sin vender
4. Propuesta (72h): presentar la oferta con contexto
5. Cierre (día 7): urgencia o cierre alternativo

## MANEJO DE OBJECIONES FRECUENTES
- "Está muy caro": "¿Me cuentas a qué lo estás comparando? Dependiendo del uso..."
- "Lo voy a pensar": "Con gusto. ¿Qué información te ayudaría a decidir?"
- "No tengo tiempo": "Entiendo, ¿quieres que te mande más info por aquí y la ves cuando puedas?"
- "Ya tengo proveedor": "Qué bueno que tengas. ¿Qué te gustó de lo que hacemos diferente?"
- Sin respuesta: esperar 24h, cambiar el ángulo del mensaje siguiente

## ERRORES A EVITAR
- No enviar precio en el primer mensaje sin contexto
- No escribir párrafos largos (se ve como spam)
- No usar "Hola estimado/a" ni saludos corporativos
- No copiar y pegar el mismo mensaje para todos
- No presionar ni generar culpa
$$),

('video', 'Framework de Video para Meta Ads', $$
## ESTRUCTURA DE VIDEO ADS QUE CONVIERTE
### Los 3 segundos que importan (HOOK)
- Visual: mostrar el resultado, el problema, o algo inesperado
- Audio/texto: la primera frase debe generar pregunta o resolver una duda
- Sin logos ni intros de marca en los primeros 3 segundos

### Desarrollo (segundos 4-20 en reel corto)
- 1 mensaje central claro
- Demostración > descripción (muestra, no digas)
- Testimonios en video: sin guión, naturales, con detalle específico
- Subtítulos siempre (80% ve sin audio)

### Cierre (últimos 3-5 segundos)
- CTA verbal + texto en pantalla
- Logo/marca aparece aquí, no al inicio
- Siguiente paso claro y fácil

## HOOKS VISUALES QUE PARAN EL SCROLL
- Antes/después en el mismo frame (split screen)
- Persona mirando directo a cámara + pregunta
- Demostración de producto en acción
- "POV: eres [cliente ideal]..."
- Texto grande en pantalla con dato inesperado
- Manos en acción con el producto (satisfying)

## ESPECIFICACIONES TÉCNICAS META
- Vertical 9:16 (1080x1920px): Stories y Reels
- Cuadrado 1:1 (1080x1080px): Feed general
- Horizontal 16:9 (1920x1080px): Audience Network
- Audio: 128kbps AAC estéreo mínimo
- Subtítulos: .srt o quemados en video
- Duración Reels: 15-30s para remarketing, 60s para TOFU educativo

## TIPOS DE VIDEO POR OBJETIVO
- Reconocimiento: estético, aspiracional, sin CTA directo
- Tráfico: value proposition clara + CTA "Ver más"
- Mensajes: call to action explícito a DM
- Ventas: oferta + precio + prueba social + urgencia
$$),

('analizar', 'Benchmarks Meta Ads Colombia 2025', $$
## BENCHMARKS COLOMBIA 2025 (referencia por industria)

### E-commerce / Moda / Joyería
- CPM: $3.500 - $6.000 COP
- CPC (enlace): $150 - $350 COP
- CTR: 1.2% - 2.5%
- ROAS objetivo: > 4.0x
- Frecuencia óptima: 2.0 - 3.5

### Servicios / B2B / Consultoría
- CPM: $5.000 - $9.000 COP
- CPC (enlace): $300 - $800 COP
- CPL (costo por lead): $15.000 - $50.000 COP
- Tasa de conversión lead→cliente: 10%-25%

### Restaurantes / Alimentos
- CPM: $2.500 - $5.000 COP
- CTR: 0.8% - 1.8%
- Radio de impacto: 5-15 km del local

### Educación Online
- CPM: $4.000 - $7.000 COP
- CPL: $20.000 - $60.000 COP
- Tasa de conversión webinar→venta: 2%-8%

## SEÑALES DE ALARMA
- CTR < 0.5%: creativos no resuenan, cambiar hook o imagen
- CPM > $10.000 COP: audiencia muy pequeña o competencia alta, ampliar
- Frecuencia > 4.0: fatiga de anuncio, rotar creativos
- CPC > $800 COP: landing page o segmentación problemática
- ROAS < 1.0 por más de 7 días: pausar y diagnosticar

## SEÑALES DE ESCALADA
- ROAS > objetivo por 3+ días seguidos: aumentar budget 20%
- CTR > 3%: duplicar conjunto con presupuesto mayor
- CPA en objetivo con >50 conversiones en 7 días: listo para escalar

## PROTOCOLO DE ANÁLISIS
1. Ver período correcto (últimos 7, 14, 30 días)
2. Comparar vs período anterior
3. Identificar ganadores (top 20% de gasto con mejor ROAS/resultado)
4. Identificar perdedores (gasto sin resultados, pausar)
5. Revisar desglose por: edad, género, posición, dispositivo
6. Revisar frecuencia por conjunto
7. Revisar relevance score / calidad del anuncio
$$)

ON CONFLICT (tool_key) DO NOTHING;
