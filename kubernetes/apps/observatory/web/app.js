'use strict';

// Observatorio público: datos curados, explicaciones en dos niveles y cero
// PromQL desde el navegador. Todo el estado del cluster llega de /live/api.

const I18N = {
  es: {
    'a11y.skip': 'Saltar al contenido',
    'nav.overview': 'Resumen',
    'nav.how': 'Cómo funciona',
    'nav.workloads': 'Aplicaciones',
    'nav.dashboards': 'Dashboards',
    'nav.faq': 'Preguntas',
    'hero.eyebrow': 'cat /proc/homelab',
    'hero.title1': 'Tres ordenadores pequeños.',
    'hero.title2': 'Todo esto, en vivo.',
    'hero.lede': 'Esta página la sirve un cluster de Kubernetes montado en casa con tres Raspberry Pi. No es una maqueta: los datos salen del sistema real mientras lo miras.',
    'hero.simple': 'No hace falta saber de servidores. Cada bloque trae una explicación sencilla y, si quieres más, un detalle técnico que puedes desplegar.',
    'hero.journey': 'Recorrer una visita',
    'hero.dashboards': 'Ver dashboards',
    'hero.pieces': 'Entender las piezas',
    'stat.nodes': 'nodos',
    'stat.nodesSub': 'encendidos',
    'stat.apps': 'apps',
    'stat.appsSub': 'sanas',
    'stat.pods': 'pods',
    'stat.podsSub': 'en marcha',
    'stat.backup': 'backup',
    'stat.backupSub': 'antigüedad',
    'stat.alerts': 'alertas',
    'stat.alertsSub': 'activas',
    'stat.uptime': 'uptime',
    'stat.uptimeSub': 'del nodo más joven',
    'ui.technical': 'Detalle técnico',
    'topo.note': 'datos en vivo · se actualiza cada 15 s',
    'topo.title': 'Qué pasa cuando abres esta página',
    'topo.intro': 'Tu petición pasa por seis sitios hasta volver convertida en la página que ves. Puedes recorrerla paso a paso o pulsar cualquier pieza del dibujo.',
    'topo.hint': 'Pulsa cualquier pieza para ver qué es, qué hace y sus datos en vivo.',
    'concept.hard.title': 'Tres ordenadores',
    'concept.hard.text': 'Son tres Raspberry Pi, del tamaño de una tarjeta de crédito. Están siempre encendidas en casa y se reparten el trabajo.',
    'concept.hard.tech': 'k3s v1.37.2 sobre Raspberry Pi OS Lite (Trixie), ARM64. cluster0 es el plano de control; cluster1 y cluster2 son workers. cluster2 tiene 2 GB y un taint para cargas ligeras.',
    'concept.kube.title': 'Un director de orquesta',
    'concept.kube.text': 'Kubernetes decide en qué ordenador vive cada aplicación, la reinicia si se cae y reparte las copias para que siempre haya alguien atendiendo.',
    'concept.kube.tech': 'k3s con flannel, Traefik como Ingress, ServiceLB y local-path. Cada app corre en pods; los Deployments mantienen el número de réplicas deseado.',
    'concept.git.title': 'Todo está en un repositorio',
    'concept.git.text': 'La configuración vive en Git, no en las máquinas. Si alguien cambia algo a mano, Argo CD lo devuelve a como está escrito en el repositorio.',
    'concept.git.tech': 'GitOps con Argo CD v3.6.1: app-of-apps, selfHeal y prune. Las credenciales van cifradas con Sealed Secrets; nada sensible se commitea en claro.',
    'concept.measure.title': 'Todo se mide',
    'concept.measure.text': 'Un sistema apunta cada 30 segundos cómo va todo: temperatura, memoria, visitas, errores. Si algo se sale de lo normal, avisa al móvil.',
    'concept.measure.tech': 'Prometheus v3.5.0 scrapea node-exporter, kubelet, cAdvisor, kube-state-metrics y Traefik. Alertmanager evalúa 7 reglas y notifica por ntfy.sh.',
    'layer.edge.title': 'La puerta de entrada',
    'layer.edge.tunnel': 'túnel',
    'layer.edge.probe': 'ida y vuelta',
    'layer.edge.tls': 'cifrado',
    'layer.edge.host': 'dominio',
    'layer.edge.simple': 'Cuando alguien entra, Cloudflare es lo primero que le atiende: comprueba que la conexión es segura y la pasa a casa por un túnel que sale desde el propio cluster. No hay ningún puerto abierto en el router.',
    'layer.edge.tech': 'Cloudflare termina TLS, aplica WAF y Access en los paneles. cloudflared 2026.11.1 mantiene dos conexiones QUIC salientes y entrega a traefik.kube-system:80; el enrutado sigue en los Ingress.',
    'layer.data.title': 'La copia de seguridad',
    'layer.data.last': 'desde el último backup',
    'layer.data.size': 'tamaño',
    'layer.data.schedule': 'horario',
    'layer.data.r2': 'copia fuera',
    'layer.data.retention': 'retención',
    'layer.data.simple': 'Cada noche, a las 03:15, se guarda una copia de la memoria del cluster y se sube a Cloudflare R2. Si la tarjeta SD de la Raspberry se estropea, se puede volver a montar todo.',
    'layer.data.tech': 'k3s usa SQLite/kine, así que no hay etcd. Un timer systemd copia state.db con la API .backup de SQLite, más token, tls, cred y manifests; 4 copias locales y 14 días en R2 con rclone.',
    'layer.cluster.title': 'Los tres ordenadores',
    'layer.cluster.simple': 'Kubernetes reparte las aplicaciones entre las tres Raspberry. Si una se pone al 100 % o se reinicia, las copias de las apps pueden seguir atendiendo desde las otras.',
    'layer.cluster.tech': 'k3s v1.37.2, un server y dos agents. cluster2 (2 GB) lleva el taint homelab.io/role=light:NoSchedule; solo toleran ese taint las cargas pensadas para él, como node-exporter y el portfolio.',
    'layer.gitops.title': 'El repositorio manda',
    'layer.gitops.simple': 'Cada aplicación está descrita en un repositorio de Git. Argo CD compara lo que dice Git con lo que hay de verdad en el cluster y corrige la diferencia. Así no hay cambios a mano que se pierdan.',
    'layer.gitops.tech': 'Argo CD v3.6.1 con app-of-apps (homelab-root), automated + prune + selfHeal. Image Updater cambia el tag del portfolio cada ~2 min; el app-of-apps ignora ese campo para no revertirlo.',
    'layer.workloads.title': 'Las aplicaciones',
    'layer.workloads.simple': 'Cada fila es una aplicación que está haciendo algo ahora mismo: servir el CV, filtrar publicidad, guardar métricas o enseñarte esta página.',
    'layer.workloads.more': 'Ver qué hace cada una →',
    'layer.obs.title': 'Los instrumentos',
    'layer.obs.targets': 'objetivos',
    'layer.obs.alerts': 'alertas',
    'layer.obs.rules': 'reglas',
    'layer.obs.notify': 'avisos',
    'layer.obs.notifyOk': 'ntfy',
    'layer.obs.simple': 'Prometheus mide cada 30 segundos. Si una regla se cumple —por ejemplo, un nodo lleva 5 minutos sin responder— Alertmanager manda un aviso al móvil por ntfy.',
    'layer.obs.tech': 'Prometheus v3.5.0 (7 días / 3 GB), Alertmanager v0.35.0 con receiver ntfy y topic en SealedSecret, 7 reglas. Grafana sirve cinco dashboards provisionados desde Git.',
    'workloads.title': 'Qué hace cada aplicación',
    'workloads.intro': 'Estas son las piezas que están corriendo ahora mismo. Pulsa una para ver su explicación sencilla, sus datos y su detalle técnico.',
    'workloads.searchLabel': 'Buscar aplicación',
    'workloads.search': 'Buscar…',
    'workloads.showInternals': 'Mostrar piezas internas',
    'workloads.hideInternals': 'Ocultar piezas internas',
    'workloads.count': '{n} aplicaciones visibles',
    'workloads.primary': 'principales',
    'workloads.internal': 'internas',
    'workloads.empty': 'No hay ninguna aplicación que coincida con la búsqueda.',
    'workloads.ready': 'listas',
    'workloads.restarts': 'reinicios',
    'dash.title': 'Los dashboards reales',
    'dash.intro': 'Lo mismo que ve el dueño del homelab en Grafana, pero en versión curada y pública. Elige una pestaña y un rango; pasa el ratón por las gráficas.',
    'dash.tab.cluster': 'Cluster',
    'dash.tab.web': 'Web',
    'dash.tab.api': 'API interna',
    'dash.tab.pods': 'Consumo',
    'dash.tech': 'Todo sale de Prometheus v3.5.0 en vivo y con consultas cerradas: el BFF no acepta PromQL del navegador. Los datos se cachean 15 s (estado) y 60 s (dashboards). El panel completo de Grafana sigue siendo privado.',
    'dash.total': 'total',
    'dash.loading': 'cargando datos…',
    'dash.noData': 'sin datos en este rango',
    'dash.updated': 'actualizado {age} · rango {range}',
    'dash.range': 'rango {range}',
    'dash.explain.cluster': 'Cada línea es una Raspberry. La CPU y la memoria dicen cuánto está trabajando; la temperatura, si va fresca. Lo normal es que la CPU suba y baje y la temperatura se quede por debajo de 70 °C.',
    'dash.explain.web': 'Cuántas visitas llegan, cuántas fallan y cuánto tardan. Los errores 5xx son fallos del servidor; si suben, algo se rompe. La latencia p95 es el tiempo que tarda el 95 % de las visitas.',
    'dash.explain.api': 'El cluster también se habla a sí mismo: Argo, los controladores y los pods preguntan cosas a la API. Estas gráficas muestran ese trabajo interno, que no se ve desde fuera.',
    'dash.explain.pods': 'Qué aplicaciones gastan más CPU y memoria en este momento. Sirve para detectar quién se está comiendo la Raspberry.',
    'dash.chart.cpu': 'CPU por nodo',
    'dash.chart.memory': 'Memoria por nodo',
    'dash.chart.temperature': 'Temperatura',
    'dash.chart.requests': 'Peticiones por segundo',
    'dash.chart.errors': 'Errores 5xx',
    'dash.chart.latency': 'Latencia p95',
    'dash.chart.apirequests': 'Peticiones a la API',
    'dash.top.cpu': 'Top CPU',
    'dash.top.memory': 'Top memoria',
    'faq.title': 'Preguntas frecuentes',
    'timeline.note': 'últimos eventos del sistema',
    'footer.built': 'construido con k3s · Argo CD · Prometheus · Cloudflare',
    'degraded.text': 'Algunas capas no responden; se muestra la última lectura conocida.',
    'degraded.offline': 'Sin conexión con el observatorio; se muestra la última lectura conocida.',
    'status.ok': 'ok',
    'status.warn': 'aviso',
    'status.err': 'error',
    'status.off': 'off',
    'status.check': 'revisar',
    'status.stale': 'obsoleto',
    'status.synced': 'Synced',
    'status.healthy': 'Healthy',
    'status.progressing': 'Progressing',
    'status.outofsync': 'OutOfSync',
    'status.degraded': 'Degraded',
    'status.missing': 'Missing',
    'status.unknown': 'Unknown',
    'backup.off': 'sin R2',
    'alerts.none': 'sin alertas activas',
    'alerts.activeCount': '{n} activas',
    'timeline.empty': 'sin eventos recientes',
    'unit.daily': 'diario',
    'event.gitops': 'Argo CD sincronizó {app} en {rev}',
    'event.backup': 'Backup completado ({size})',
    'event.probe': 'Petición pública OK ({ms} ms)',
    'event.alert': 'Alerta {name} ({severity})',
    'journey.ok': 'Cloudflare → túnel → Traefik → pod · {status} · {ms} ms',
    'journey.nodata': 'Ruta simulada: sin datos del probe público.',
    'journey.step': 'paso {n} de {total}',
    'journey.play': 'Reproducir recorrido',
    'journey.pause': 'Pausar recorrido',
    'drawer.close': 'Cerrar',
    'drawer.live': 'en vivo',
    'drawer.technical': 'cómo está montado',
    'drawer.pods': 'pods',
    'drawer.resources': 'recursos',
    'drawer.links': 'enlaces',
    'drawer.image': 'imagen',
    'drawer.namespace': 'namespace',
    'drawer.kind': 'tipo',
    'drawer.status': 'estado',
    'drawer.ready': 'listas',
    'drawer.restarts': 'reinicios',
    'drawer.cpu': 'CPU',
    'drawer.memory': 'memoria',
    'drawer.age': 'en marcha desde',
    'drawer.since': 'desde hace {age}',
    'drawer.requests': 'peticiones',
    'drawer.limits': 'límites',
    'drawer.noLimits': 'sin límites definidos',
    'drawer.noPods': 'Ahora mismo no hay pods de esta aplicación.',
    'drawer.noPublic': 'Sin enlace público: es una pieza interna del cluster.',
    'drawer.access': 'requiere Cloudflare Access',
    'drawer.pod': 'pod',
    'drawer.node': 'nodo',
    'drawer.phase': 'fase',
    'drawer.running': 'Running',
    'drawer.stale': 'obsoleto',
    'drawer.fresh': 'al día',
    'drawer.tunnel': 'túnel',
    'drawer.probe': 'probe público',
    'drawer.targets': 'objetivos',
    'drawer.rules': 'reglas',
    'drawer.alerts': 'alertas',
    'drawer.schedule': 'horario',
    'drawer.size': 'tamaño',
    'drawer.retention': 'retención',
    'drawer.uptime': 'encendido desde',
    'drawer.temp': 'temperatura',
    'drawer.disk': 'disco',
    'drawer.route': 'rutas',
    'drawer.browser': 'navegador',
    'drawer.edge': 'edge',
    'drawer.compute': 'cómputo',
    'drawer.storage': 'almacenamiento',
    'drawer.observability': 'observabilidad',
    'drawer.workload': 'aplicación',
    'drawer.internals': 'pieza interna',
    'drawer.copy': 'copiar enlace',
    'drawer.copied': 'enlace copiado',
    'faq.q1': '¿Esto es real o una maqueta?',
    'faq.a1': 'Es real. Los números se piden al cluster cada 15 segundos y las gráficas salen de Prometheus. Si algo se cae, se verá aquí.',
    'faq.q2': '¿Qué es un homelab?',
    'faq.a2': 'Un laboratorio en casa. Sirve para aprender infraestructura con hardware real sin depender de la nube, y de paso aloja el CV y un DNS que bloquea anuncios.',
    'faq.q3': '¿Qué es Kubernetes?',
    'faq.a3': 'Un director de orquesta para contenedores. Decide en qué máquina corre cada aplicación, cuántas copias hay y qué hacer si una se cae. k3s es una versión ligera pensada para equipos pequeños.',
    'faq.q4': '¿Qué es un pod?',
    'faq.a4': 'La unidad mínima que ejecuta Kubernetes: una caja con uno o varios contenedores que comparten red y almacenamiento. Aquí cada aplicación tiene uno o varios pods.',
    'faq.q5': '¿Qué es GitOps?',
    'faq.a5': 'Guardar la configuración en Git y dejar que una herramienta (Argo CD) la aplique sola. Si alguien cambia algo a mano, se revierte; si se cambia en Git, se despliega.',
    'faq.q6': '¿Por qué Raspberry Pi y no un servidor?',
    'faq.a6': 'Consumen muy poco, son baratas y obligan a pensar en límites reales de CPU, memoria y almacenamiento. Para aprender, es un laboratorio excelente.',
    'faq.q7': '¿Qué pasa si se estropea una Raspberry?',
    'faq.a7': 'Kubernetes reprograma los pods en las otras. Las aplicaciones con varias réplicas siguen atendiendo. Los datos de la tarjeta SD se recuperan del backup diario.',
    'faq.q8': '¿Puedo ver los paneles internos?',
    'faq.a8': 'Grafana y Argo CD están detrás de Cloudflare Access y no son públicos. Aquí tienes una versión curada de las métricas y del estado, pensada para explicar cómo funciona todo.',
    'faq.q9': '¿Se muestran datos sensibles?',
    'faq.a9': 'No. El observatorio nunca expone secretos, logs, IPs internas ni PromQL libre: solo nombres de aplicaciones, estados y métricas agregadas.',
  },
  en: {
    'a11y.skip': 'Skip to content',
    'nav.overview': 'Overview',
    'nav.how': 'How it works',
    'nav.workloads': 'Workloads',
    'nav.dashboards': 'Dashboards',
    'nav.faq': 'FAQ',
    'hero.eyebrow': 'cat /proc/homelab',
    'hero.title1': 'Three tiny computers.',
    'hero.title2': 'All of this, live.',
    'hero.lede': 'This page is served by a Kubernetes cluster built at home with three Raspberry Pis. It is not a mock-up: the data comes from the real system while you watch.',
    'hero.simple': 'You do not need to know about servers. Every block has a plain explanation and, if you want more, a technical detail you can expand.',
    'hero.journey': 'Take a tour',
    'hero.dashboards': 'See dashboards',
    'hero.pieces': 'Understand the pieces',
    'stat.nodes': 'nodes',
    'stat.nodesSub': 'online',
    'stat.apps': 'apps',
    'stat.appsSub': 'healthy',
    'stat.pods': 'pods',
    'stat.podsSub': 'running',
    'stat.backup': 'backup',
    'stat.backupSub': 'age',
    'stat.alerts': 'alerts',
    'stat.alertsSub': 'active',
    'stat.uptime': 'uptime',
    'stat.uptimeSub': 'youngest node',
    'ui.technical': 'Technical detail',
    'topo.note': 'live data · refreshed every 15 s',
    'topo.title': 'What happens when you open this page',
    'topo.intro': 'Your request goes through six places before coming back as the page you are reading. You can follow it step by step or click any piece in the diagram.',
    'topo.hint': 'Click any piece to see what it is, what it does and its live data.',
    'concept.hard.title': 'Three computers',
    'concept.hard.text': 'Three Raspberry Pis, each the size of a credit card. They stay on at home and share the work.',
    'concept.hard.tech': 'k3s v1.37.2 on Raspberry Pi OS Lite (Trixie), ARM64. cluster0 is the control plane; cluster1 and cluster2 are workers. cluster2 has 2 GB and a taint for light workloads.',
    'concept.kube.title': 'An orchestra conductor',
    'concept.kube.text': 'Kubernetes decides which computer runs each app, restarts it if it crashes and keeps several copies so someone is always answering.',
    'concept.kube.tech': 'k3s with flannel, Traefik as Ingress, ServiceLB and local-path. Apps run in pods; Deployments keep the desired replica count.',
    'concept.git.title': 'Everything lives in a repo',
    'concept.git.text': 'Configuration lives in Git, not on the machines. If someone changes something by hand, Argo CD puts it back to what the repository says.',
    'concept.git.tech': 'GitOps with Argo CD v3.6.1: app-of-apps, selfHeal and prune. Credentials are encrypted with Sealed Secrets; nothing sensitive is committed in the clear.',
    'concept.measure.title': 'Everything is measured',
    'concept.measure.text': 'A system records how everything is doing every 30 seconds: temperature, memory, visits, errors. If something goes out of range, it alerts the phone.',
    'concept.measure.tech': 'Prometheus v3.5.0 scrapes node-exporter, kubelet, cAdvisor, kube-state-metrics and Traefik. Alertmanager evaluates 7 rules and notifies via ntfy.sh.',
    'layer.edge.title': 'The front door',
    'layer.edge.tunnel': 'tunnel',
    'layer.edge.probe': 'round trip',
    'layer.edge.tls': 'encryption',
    'layer.edge.host': 'domain',
    'layer.edge.simple': 'When someone visits, Cloudflare answers first: it checks the connection is secure and passes it home through a tunnel opened by the cluster itself. No router port is open.',
    'layer.edge.tech': 'Cloudflare terminates TLS, applies WAF and Access on admin panels. cloudflared 2026.11.1 keeps two outbound QUIC connections and forwards to traefik.kube-system:80; routing still lives in Ingress resources.',
    'layer.data.title': 'The backup',
    'layer.data.last': 'since the last backup',
    'layer.data.size': 'size',
    'layer.data.schedule': 'schedule',
    'layer.data.r2': 'off-site copy',
    'layer.data.retention': 'retention',
    'layer.data.simple': 'Every night at 03:15 a copy of the cluster memory is saved and uploaded to Cloudflare R2. If a Raspberry SD card dies, everything can be rebuilt.',
    'layer.data.tech': 'k3s uses SQLite/kine, so there is no etcd. A systemd timer copies state.db with SQLite .backup, plus token, tls, cred and manifests; 4 local copies and 14 days in R2 with rclone.',
    'layer.cluster.title': 'The three computers',
    'layer.cluster.simple': 'Kubernetes spreads apps across the three Raspberry Pis. If one hits 100 % or reboots, app copies can keep answering from the others.',
    'layer.cluster.tech': 'k3s v1.37.2, one server and two agents. cluster2 (2 GB) carries the homelab.io/role=light:NoSchedule taint; only workloads designed for it tolerate that taint, such as node-exporter and the portfolio.',
    'layer.gitops.title': 'The repo rules',
    'layer.gitops.simple': 'Every app is described in a Git repository. Argo CD compares Git with the cluster and fixes any difference. Manual changes cannot silently survive.',
    'layer.gitops.tech': 'Argo CD v3.6.1 with app-of-apps (homelab-root), automated + prune + selfHeal. Image Updater changes the portfolio tag every ~2 min; the app-of-apps ignores that field to avoid reverting it.',
    'layer.workloads.title': 'The applications',
    'layer.workloads.simple': 'Each row is an app doing something right now: serving the CV, blocking ads, storing metrics or showing you this page.',
    'layer.workloads.more': 'See what each one does →',
    'layer.obs.title': 'The instruments',
    'layer.obs.targets': 'targets',
    'layer.obs.alerts': 'alerts',
    'layer.obs.rules': 'rules',
    'layer.obs.notify': 'notifications',
    'layer.obs.notifyOk': 'ntfy',
    'layer.obs.simple': 'Prometheus measures every 30 seconds. If a rule fires — for example, a node has not answered for 5 minutes — Alertmanager sends a phone notification via ntfy.',
    'layer.obs.tech': 'Prometheus v3.5.0 (7 days / 3 GB), Alertmanager v0.35.0 with an ntfy receiver and topic in a SealedSecret, 7 rules. Grafana serves five dashboards provisioned from Git.',
    'workloads.title': 'What each application does',
    'workloads.intro': 'These are the pieces running right now. Click one to see its plain explanation, its data and its technical detail.',
    'workloads.searchLabel': 'Search application',
    'workloads.search': 'Search…',
    'workloads.showInternals': 'Show internal pieces',
    'workloads.hideInternals': 'Hide internal pieces',
    'workloads.count': '{n} applications visible',
    'workloads.primary': 'primary',
    'workloads.internal': 'internal',
    'workloads.empty': 'No application matches the search.',
    'workloads.ready': 'ready',
    'workloads.restarts': 'restarts',
    'dash.title': 'The real dashboards',
    'dash.intro': 'The same data the homelab owner sees in Grafana, in a curated public version. Pick a tab and a range; hover over the charts.',
    'dash.tab.cluster': 'Cluster',
    'dash.tab.web': 'Web',
    'dash.tab.api': 'Internal API',
    'dash.tab.pods': 'Consumption',
    'dash.tech': 'Everything comes from Prometheus v3.5.0 live and through closed queries: the BFF never accepts PromQL from the browser. Data is cached for 15 s (status) and 60 s (dashboards). The full Grafana panel stays private.',
    'dash.total': 'total',
    'dash.loading': 'loading data…',
    'dash.noData': 'no data in this range',
    'dash.updated': 'updated {age} · range {range}',
    'dash.range': 'range {range}',
    'dash.explain.cluster': 'Each line is a Raspberry Pi. CPU and memory show how hard it is working; temperature shows whether it is cool. CPU going up and down is normal; temperature should stay below 70 °C.',
    'dash.explain.web': 'How many visits arrive, how many fail and how long they take. 5xx errors are server failures; if they rise, something is broken. p95 latency is the time 95 % of visits take.',
    'dash.explain.api': 'The cluster also talks to itself: Argo, controllers and pods ask the API questions. These charts show that internal work, which is invisible from outside.',
    'dash.explain.pods': 'Which applications use the most CPU and memory right now. Useful to spot who is eating the Raspberry Pi.',
    'dash.chart.cpu': 'CPU per node',
    'dash.chart.memory': 'Memory per node',
    'dash.chart.temperature': 'Temperature',
    'dash.chart.requests': 'Requests per second',
    'dash.chart.errors': '5xx errors',
    'dash.chart.latency': 'p95 latency',
    'dash.chart.apirequests': 'API requests',
    'dash.top.cpu': 'Top CPU',
    'dash.top.memory': 'Top memory',
    'faq.title': 'Frequently asked questions',
    'timeline.note': 'latest system events',
    'footer.built': 'built with k3s · Argo CD · Prometheus · Cloudflare',
    'degraded.text': 'Some layers are not responding; showing the last known reading.',
    'degraded.offline': 'No connection to the observatory; showing the last known reading.',
    'status.ok': 'ok',
    'status.warn': 'warn',
    'status.err': 'error',
    'status.off': 'off',
    'status.check': 'check',
    'status.stale': 'stale',
    'status.synced': 'Synced',
    'status.healthy': 'Healthy',
    'status.progressing': 'Progressing',
    'status.outofsync': 'OutOfSync',
    'status.degraded': 'Degraded',
    'status.missing': 'Missing',
    'status.unknown': 'Unknown',
    'backup.off': 'no R2',
    'alerts.none': 'no active alerts',
    'alerts.activeCount': '{n} active',
    'timeline.empty': 'no recent events',
    'unit.daily': 'daily',
    'event.gitops': 'Argo CD synced {app} at {rev}',
    'event.backup': 'Backup completed ({size})',
    'event.probe': 'Public request OK ({ms} ms)',
    'event.alert': 'Alert {name} ({severity})',
    'journey.ok': 'Cloudflare → tunnel → Traefik → pod · {status} · {ms} ms',
    'journey.nodata': 'Simulated path: no public probe data.',
    'journey.step': 'step {n} of {total}',
    'journey.play': 'Play tour',
    'journey.pause': 'Pause tour',
    'drawer.close': 'Close',
    'drawer.live': 'live',
    'drawer.technical': 'how it is built',
    'drawer.pods': 'pods',
    'drawer.resources': 'resources',
    'drawer.links': 'links',
    'drawer.image': 'image',
    'drawer.namespace': 'namespace',
    'drawer.kind': 'kind',
    'drawer.status': 'status',
    'drawer.ready': 'ready',
    'drawer.restarts': 'restarts',
    'drawer.cpu': 'CPU',
    'drawer.memory': 'memory',
    'drawer.age': 'running for',
    'drawer.since': 'for {age}',
    'drawer.requests': 'requests',
    'drawer.limits': 'limits',
    'drawer.noLimits': 'no limits set',
    'drawer.noPods': 'There are no pods for this application right now.',
    'drawer.noPublic': 'No public link: this is an internal cluster piece.',
    'drawer.access': 'requires Cloudflare Access',
    'drawer.pod': 'pod',
    'drawer.node': 'node',
    'drawer.phase': 'phase',
    'drawer.running': 'Running',
    'drawer.stale': 'stale',
    'drawer.fresh': 'fresh',
    'drawer.tunnel': 'tunnel',
    'drawer.probe': 'public probe',
    'drawer.targets': 'targets',
    'drawer.rules': 'rules',
    'drawer.alerts': 'alerts',
    'drawer.schedule': 'schedule',
    'drawer.size': 'size',
    'drawer.retention': 'retention',
    'drawer.uptime': 'up for',
    'drawer.temp': 'temperature',
    'drawer.disk': 'disk',
    'drawer.route': 'routes',
    'drawer.browser': 'browser',
    'drawer.edge': 'edge',
    'drawer.compute': 'compute',
    'drawer.storage': 'storage',
    'drawer.observability': 'observability',
    'drawer.workload': 'application',
    'drawer.internals': 'internal piece',
    'drawer.copy': 'copy link',
    'drawer.copied': 'link copied',
    'faq.q1': 'Is this real or a mock-up?',
    'faq.a1': 'It is real. Numbers are fetched from the cluster every 15 seconds and charts come from Prometheus. If something breaks, you will see it here.',
    'faq.q2': 'What is a homelab?',
    'faq.a2': 'A lab at home. It is a way to learn infrastructure with real hardware without depending on the cloud, and it also hosts this CV and an ad-blocking DNS.',
    'faq.q3': 'What is Kubernetes?',
    'faq.a3': 'A conductor for containers. It decides which machine runs each app, how many copies exist and what to do when one fails. k3s is a lightweight version for small machines.',
    'faq.q4': 'What is a pod?',
    'faq.a4': 'The smallest unit Kubernetes runs: a box with one or more containers sharing network and storage. Every app here has one or more pods.',
    'faq.q5': 'What is GitOps?',
    'faq.a5': 'Keeping configuration in Git and letting a tool (Argo CD) apply it. Manual changes are reverted; changes in Git are deployed.',
    'faq.q6': 'Why Raspberry Pi and not a server?',
    'faq.a6': 'They use very little power, are cheap and force you to think about real CPU, memory and storage limits. For learning, it is an excellent lab.',
    'faq.q7': 'What happens if a Raspberry Pi dies?',
    'faq.a7': 'Kubernetes reschedules pods on the others. Apps with several replicas keep serving. Data on the SD card is recovered from the daily backup.',
    'faq.q8': 'Can I see the internal panels?',
    'faq.a8': 'Grafana and Argo CD sit behind Cloudflare Access and are not public. Here you get a curated version of the metrics and status, designed to explain how everything works.',
    'faq.q9': 'Is any sensitive data shown?',
    'faq.a9': 'No. The observatory never exposes secrets, logs, internal IPs or free PromQL: only app names, states and aggregated metrics.',
  },
};

const WORKLOAD_INFO = {
  portfolio: {
    simple: { es: 'El CV de Daniel, online. Tres copias idénticas responden a la vez para que la web siga en pie aunque una falle.', en: "Daniel's CV, online. Three identical copies answer at once so the site survives if one fails." },
    tech: { es: 'nginx-unprivileged sirviendo un sitio estático, 3 réplicas, Ingress dbarroso.dev; el tag lo actualiza Argo CD Image Updater.', en: 'nginx-unprivileged serving a static site, 3 replicas, dbarroso.dev Ingress; the tag is updated by Argo CD Image Updater.' },
    url: 'https://dbarroso.dev',
    primary: true,
  },
  homepage: {
    simple: { es: 'El panel de inicio del laboratorio: una página con enlaces a todo lo demás.', en: 'The lab start page: one page with links to everything else.' },
    tech: { es: 'Homepage v2.8.0 con rootfs de solo lectura, configuración por ConfigMap y widget de Kubernetes con ServiceAccount de solo lectura.', en: 'Homepage v2.8.0 with a read-only rootfs, ConfigMap config and a Kubernetes widget backed by a read-only ServiceAccount.' },
    url: 'https://lab.dbarroso.dev',
    primary: true,
  },
  adguard: {
    simple: { es: 'El portero de internet de casa: bloquea anuncios y traduce nombres como grafana.homelab.home.arpa a la IP del cluster.', en: 'The home internet gatekeeper: it blocks ads and resolves names like grafana.homelab.home.arpa to the cluster IP.' },
    tech: { es: 'AdGuard Home v0.107.80; DNS en 192.168.1.100:53 vía ServiceLB, UI en el puerto 80 y dos PVC local-path.', en: 'AdGuard Home v0.107.80; DNS on 192.168.1.100:53 via ServiceLB, UI on port 80 and two local-path PVCs.' },
    url: 'http://adguard.homelab.home.arpa',
    primary: true,
  },
  cloudflared: {
    simple: { es: 'Un túnel que sale de casa hacia Cloudflare. Gracias a él la web es pública sin abrir ningún puerto en el router.', en: 'A tunnel from home to Cloudflare. It makes the site public without opening any router port.' },
    tech: { es: 'cloudflared 2026.11.1, 2 réplicas y dos conexiones QUIC salientes; el origen es traefik.kube-system:80.', en: 'cloudflared 2026.11.1, 2 replicas and two outbound QUIC connections; the origin is traefik.kube-system:80.' },
    primary: true,
  },
  observatory: {
    simple: { es: 'Esta misma página: un programa pequeño que pregunta al cluster y dibuja lo que ves.', en: 'This very page: a small program that asks the cluster and draws what you see.' },
    tech: { es: 'Node 22 sin dependencias, uid 65534, BFF con consultas cerradas y ServiceAccount de solo lectura.', en: 'Node 22 with no dependencies, uid 65534, BFF with closed queries and a read-only ServiceAccount.' },
    url: 'https://dbarroso.dev/live',
    primary: true,
  },
  grafana: {
    simple: { es: 'Las gráficas del dueño: aquí se miran las métricas con más detalle y se comparan rangos largos.', en: "The owner's charts: detailed metrics and longer ranges are inspected here." },
    tech: { es: 'Grafana 13.1.0, PVC local-path, dashboards provisionados desde ConfigMaps y acceso anónimo Viewer.', en: 'Grafana 13.1.0, local-path PVC, dashboards provisioned from ConfigMaps and anonymous Viewer access.' },
    url: 'https://grafana.dbarroso.dev',
    access: true,
    primary: true,
  },
  prometheus: {
    simple: { es: 'La libreta donde se apunta todo cada 30 segundos: CPU, memoria, disco, visitas y errores.', en: 'The notebook where everything is recorded every 30 seconds: CPU, memory, disk, visits and errors.' },
    tech: { es: 'Prometheus v3.5.0, retención 7 días / 3 GB, scrape de kubelet, cAdvisor, node-exporter, Traefik y kube-state-metrics.', en: 'Prometheus v3.5.0, 7 days / 3 GB retention, scraping kubelet, cAdvisor, node-exporter, Traefik and kube-state-metrics.' },
    url: 'http://prometheus.homelab.home.arpa',
    primary: true,
  },
  alertmanager: {
    simple: { es: 'El que avisa cuando algo va mal. Si una regla se cumple, manda un mensaje al móvil por ntfy.', en: 'The one that warns when something is wrong. When a rule fires, it sends a phone message via ntfy.' },
    tech: { es: 'Alertmanager v0.35.0 con 7 reglas y receiver ntfy; el topic vive en un SealedSecret.', en: 'Alertmanager v0.35.0 with 7 rules and an ntfy receiver; the topic lives in a SealedSecret.' },
    url: 'http://alertmanager.homelab.home.arpa',
    primary: true,
  },
  traefik: {
    simple: { es: 'El recepcionista: mira el dominio de la petición y la manda a la aplicación correcta.', en: 'The receptionist: it looks at the request host and sends it to the right application.' },
    tech: { es: 'Traefik 3.7.15 (chart de k3s), Ingress por Host, ServiceLB y métricas Prometheus en el puerto 9100.', en: 'Traefik 3.7.15 (k3s chart), Ingress by Host, ServiceLB and Prometheus metrics on port 9100.' },
    primary: true,
  },
  'argocd-server': {
    simple: { es: 'El panel donde se ve qué hay desplegado y si coincide con lo que dice Git.', en: 'The panel that shows what is deployed and whether it matches Git.' },
    tech: { es: 'Argo CD v3.6.1; la UI interna vive en argocd.homelab.home.arpa y la pública detrás de Cloudflare Access.', en: 'Argo CD v3.6.1; the internal UI lives at argocd.homelab.home.arpa and the public one behind Cloudflare Access.' },
    url: 'https://argocd.dbarroso.dev',
    access: true,
    primary: true,
  },
  'sealed-secrets': {
    simple: { es: 'La caja fuerte: descifra los secretos que están cifrados dentro del repositorio.', en: 'The safe: it decrypts the secrets that are encrypted inside the repository.' },
    tech: { es: 'Controller v0.41.2; la clave privada se guarda fuera del repo y cada SealedSecret se ata a namespace + nombre.', en: 'Controller v0.41.2; the private key is kept outside the repo and every SealedSecret is bound to a namespace + name.' },
    primary: true,
  },
  'image-updater': {
    simple: { es: 'Vigila si hay una imagen nueva del portfolio y actualiza el tag en el cluster sin tocar Git.', en: 'Watches for a new portfolio image and updates the cluster tag without touching Git.' },
    tech: { es: 'argocd-image-updater v1.5.0 con writeBack a la Application, estrategia newest-build y platforms linux/arm64.', en: 'argocd-image-updater v1.5.0 with writeBack to the Application, newest-build strategy and linux/arm64 platforms.' },
    primary: true,
  },
  'node-exporter': {
    simple: { es: 'Un termómetro en cada Raspberry: mide CPU, memoria, disco y temperatura.', en: 'A thermometer on each Raspberry Pi: it measures CPU, memory, disk and temperature.' },
    tech: { es: 'DaemonSet con hostNetwork y textfile collector; tolera el taint de cluster2.', en: 'DaemonSet with hostNetwork and textfile collector; tolerates the cluster2 taint.' },
    primary: true,
  },
  'kube-state-metrics': {
    simple: { es: 'Traduce el estado interno de Kubernetes (pods, deployments, reinicios) a números que Prometheus entiende.', en: 'Translates Kubernetes internal state (pods, deployments, restarts) into numbers Prometheus understands.' },
    tech: { es: 'kube-state-metrics v2.15.0; salud en :8080/healthz.', en: 'kube-state-metrics v2.15.0; health at :8080/healthz.' },
    primary: true,
  },
  'metrics-server': {
    simple: { es: 'Calcula cuánta CPU y memoria usa cada pod para kubectl top y el autoescalado.', en: 'Calculates CPU and memory per pod for kubectl top and autoscaling.' },
    tech: { es: 'metrics-server en kube-system, API de métricas de recursos.', en: 'metrics-server in kube-system, resource metrics API.' },
    primary: true,
  },
  coredns: {
    simple: { es: 'La guía telefónica interna: traduce nombres como prometheus.observability.svc.cluster.local.', en: 'The internal phone book: it resolves names like prometheus.observability.svc.cluster.local.' },
    tech: { es: 'CoreDNS con el plugin kubernetes; resuelve servicios dentro del cluster.', en: 'CoreDNS with the kubernetes plugin; resolves services inside the cluster.' },
  },
  'local-path-provisioner': {
    simple: { es: 'Crea los discos de los pods usando la tarjeta SD del nodo donde caen.', en: 'Creates pod disks using the SD card of the node where they land.' },
    tech: { es: 'local-path-provisioner de k3s; sin replicación: los datos quedan atados a ese nodo.', en: 'k3s local-path-provisioner; no replication: data stays bound to that node.' },
  },
  'argocd-repo-server': {
    simple: { es: 'La pieza de Argo que clona el repositorio y prepara los manifiestos.', en: 'The Argo piece that clones the repository and prepares manifests.' },
    tech: { es: 'argocd-repo-server v3.6.1; lee el repo con la deploy key repo-homelab.', en: 'argocd-repo-server v3.6.1; reads the repo with the repo-homelab deploy key.' },
  },
  'argocd-dex-server': {
    simple: { es: 'Gestiona el inicio de sesión de Argo CD.', en: 'Handles Argo CD login.' },
    tech: { es: 'Dex integrado en Argo CD.', en: 'Dex integrated into Argo CD.' },
  },
  'argocd-redis': {
    simple: { es: 'Una memoria rápida que usa Argo para no repetir trabajo.', en: 'A fast cache Argo uses to avoid repeating work.' },
    tech: { es: 'Redis interno de Argo CD.', en: 'Argo CD internal Redis.' },
  },
  'argocd-applicationset-controller': {
    simple: { es: 'Genera aplicaciones de Argo a partir de plantillas.', en: 'Generates Argo applications from templates.' },
    tech: { es: 'ApplicationSet controller v3.6.1.', en: 'ApplicationSet controller v3.6.1.' },
  },
  'argocd-notifications-controller': {
    simple: { es: 'Envía avisos de Argo si algo cambia.', en: 'Sends Argo notifications when something changes.' },
    tech: { es: 'Notifications controller v3.6.1, sin canales configurados.', en: 'Notifications controller v3.6.1, no channels configured.' },
  },
};

const NODE_INFO = {
  browser: {
    kind: 'drawer.browser',
    title: { es: 'Tú, ahora mismo', en: 'You, right now' },
    simple: { es: 'Estás aquí. Tu navegador pide la página, espera la respuesta y dibuja lo que ves.', en: 'You are here. Your browser asks for the page, waits for the response and draws what you see.' },
    tech: { es: 'HTTPS a dbarroso.dev; CSP sin scripts inline, sin cookies y sin datos personales.', en: 'HTTPS to dbarroso.dev; CSP with no inline scripts, no cookies and no personal data.' },
  },
  edge: {
    kind: 'drawer.edge',
    title: { es: 'Cloudflare', en: 'Cloudflare' },
    simple: { es: 'La puerta de entrada a Internet: comprueba que la conexión es segura y la mete en el túnel que va a casa.', en: 'The internet front door: it checks the connection is secure and puts it into the tunnel to home.' },
    tech: { es: 'TLS en el borde, WAF, Access en grafana/argocd y túnel QUIC hacia cloudflared. El origen es HTTP en la LAN del cluster.', en: 'Edge TLS, WAF, Access on grafana/argocd and a QUIC tunnel to cloudflared. The origin is HTTP inside the cluster network.' },
  },
  traefik: {
    kind: 'drawer.edge',
    title: { es: 'Traefik', en: 'Traefik' },
    simple: { es: 'El recepcionista del cluster: mira el dominio y la ruta, y decide a qué aplicación mandar la petición.', en: 'The cluster receptionist: it looks at the host and path, then decides which application gets the request.' },
    tech: { es: 'Ingress por Host: dbarroso.dev/ → portfolio y /live → observatory. ServiceLB publica 80/443 y las métricas viven en :9100.', en: 'Ingress by Host: dbarroso.dev/ → portfolio and /live → observatory. ServiceLB publishes 80/443 and metrics live on :9100.' },
  },
  cluster: {
    kind: 'drawer.compute',
    title: { es: 'Cluster k3s', en: 'k3s cluster' },
    simple: { es: 'Las tres Raspberry Pi que ejecutan las aplicaciones. Kubernetes decide dónde va cada copia y las mantiene vivas.', en: 'The three Raspberry Pis that run the applications. Kubernetes decides where each copy goes and keeps them alive.' },
    tech: { es: 'k3s v1.37.2: cluster0 (control-plane), cluster1 y cluster2 (workers). cluster2 está limitado a cargas ligeras con un taint.', en: 'k3s v1.37.2: cluster0 (control-plane), cluster1 and cluster2 (workers). cluster2 is limited to light workloads with a taint.' },
  },
  node: {
    kind: 'drawer.compute',
    title: { es: 'Raspberry Pi', en: 'Raspberry Pi' },
    simple: { es: 'Una de las tres Raspberry. Tiene su propia CPU, memoria y tarjeta SD, y comparte el trabajo con las otras.', en: 'One of the three Raspberry Pis. It has its own CPU, memory and SD card, and shares work with the others.' },
    tech: { es: 'Raspberry Pi 4, Raspberry Pi OS Lite (Trixie), kernel 6.18.60. kubelet y node-exporter exponen sus métricas.', en: 'Raspberry Pi 4, Raspberry Pi OS Lite (Trixie), kernel 6.18.60. kubelet and node-exporter expose its metrics.' },
  },
  r2: {
    kind: 'drawer.storage',
    title: { es: 'Cloudflare R2', en: 'Cloudflare R2' },
    simple: { es: 'Una copia de seguridad fuera de casa, por si la tarjeta SD de la Raspberry deja de funcionar.', en: 'An off-site backup, in case a Raspberry SD card stops working.' },
    tech: { es: 'Bucket privado, 14 días de retención y subida diaria con rclone a las 03:15 desde cluster0.', en: 'Private bucket, 14 days retention and a daily rclone upload at 03:15 from cluster0.' },
  },
  obs: {
    kind: 'drawer.observability',
    title: { es: 'Observabilidad', en: 'Observability' },
    simple: { es: 'Los instrumentos que miden el sistema y avisan si algo se sale de lo normal.', en: 'The instruments that measure the system and warn when something is out of range.' },
    tech: { es: 'Prometheus, Alertmanager, Grafana, node-exporter y kube-state-metrics. Prometheus mide cada 30 s y Alertmanager avisa por ntfy.', en: 'Prometheus, Alertmanager, Grafana, node-exporter and kube-state-metrics. Prometheus measures every 30 s and Alertmanager notifies via ntfy.' },
  },
};

const JOURNEY = [
  { target: 'browser', title: { es: 'Paso 1 · Tú pides la página', en: 'Step 1 · You ask for the page' }, text: { es: 'Escribes dbarroso.dev/live. Tu navegador resuelve el nombre, abre una conexión cifrada y pide el contenido.', en: 'You type dbarroso.dev/live. Your browser resolves the name, opens an encrypted connection and asks for the content.' } },
  { target: 'edge', title: { es: 'Paso 2 · Cloudflare contesta', en: 'Step 2 · Cloudflare answers' }, text: { es: 'Cloudflare termina el cifrado, comprueba que la petición es legítima y la envía por el túnel que el cluster mantiene abierto.', en: 'Cloudflare terminates encryption, checks the request is legitimate and sends it through the tunnel the cluster keeps open.' } },
  { target: 'traefik', title: { es: 'Paso 3 · Traefik reparte', en: 'Step 3 · Traefik routes' }, text: { es: 'La petición llega a Traefik dentro del cluster. Mira el dominio y la ruta: /live va al observatorio.', en: 'The request reaches Traefik inside the cluster. It looks at the host and path: /live goes to the observatory.' } },
  { target: 'cluster', title: { es: 'Paso 4 · Un pod responde', en: 'Step 4 · A pod answers' }, text: { es: 'El observatorio corre en un pod, dentro de una de las Raspberry. Pregunta a Prometheus y a la API de Kubernetes y prepara los datos.', en: 'The observatory runs in a pod inside one of the Raspberry Pis. It asks Prometheus and the Kubernetes API and prepares the data.' } },
  { target: 'browser', title: { es: 'Paso 5 · Vuelve la respuesta', en: 'Step 5 · The response returns' }, text: { es: 'El pod devuelve HTML, CSS y JavaScript; Traefik y Cloudflare lo traen de vuelta y ves esta página.', en: 'The pod returns HTML, CSS and JavaScript; Traefik and Cloudflare bring it back and you see this page.' } },
];

const FAQ = [
  ['faq.q1', 'faq.a1'], ['faq.q2', 'faq.a2'], ['faq.q3', 'faq.a3'],
  ['faq.q4', 'faq.a4'], ['faq.q5', 'faq.a5'], ['faq.q6', 'faq.a6'],
  ['faq.q7', 'faq.a7'], ['faq.q8', 'faq.a8'], ['faq.q9', 'faq.a9'],
];

const PRIMARY = [
  'portfolio', 'homepage', 'adguard', 'cloudflared', 'observatory',
  'grafana', 'prometheus', 'alertmanager', 'traefik', 'argocd-server',
  'sealed-secrets', 'image-updater', 'node-exporter', 'kube-state-metrics', 'metrics-server',
];

const PALETTE = ['#00ffa3', '#22d3ee', '#a78bfa', '#ffc857', '#ff5d73'];
const CHART_SPECS = {
  cluster: [
    { key: 'cpu', title: 'dash.chart.cpu', unit: 'percent', min: 0, max: 100 },
    { key: 'memory', title: 'dash.chart.memory', unit: 'percent', min: 0, max: 100 },
    { key: 'temperature', title: 'dash.chart.temperature', unit: 'celsius', min: 0 },
  ],
  web: [
    { key: 'requests', title: 'dash.chart.requests', unit: 'reqps', min: 0 },
    { key: 'errors', title: 'dash.chart.errors', unit: 'percent', min: 0, floorMax: 5 },
    { key: 'latency', title: 'dash.chart.latency', unit: 'ms', min: 0, scale: 1000 },
  ],
  api: [
    { key: 'requests', title: 'dash.chart.apirequests', unit: 'reqps', min: 0 },
    { key: 'errors', title: 'dash.chart.errors', unit: 'percent', min: 0, floorMax: 5 },
    { key: 'latency', title: 'dash.chart.latency', unit: 'ms', min: 0, scale: 1000 },
  ],
};

const state = {
  lang: localStorage.getItem('obs.lang') || (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'),
  data: null,
  lastGood: 0,
  offline: false,
  search: '',
  showInternals: false,
  journey: { step: 0, playing: false, timer: null },
  dash: { tab: 'cluster', range: '1h', cache: {}, loading: false, visible: false },
  drawer: null,
  hiddenSeries: new Set(),
};

const params = new URLSearchParams(location.search);
if (['es', 'en'].includes(params.get('lang'))) state.lang = params.get('lang');

const $ = (id) => document.getElementById(id);

function t(key, vars = {}) {
  let text = (I18N[state.lang] && I18N[state.lang][key]) || I18N.es[key] || key;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

function tx(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[state.lang] || value.es || value.en || '';
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setText(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}

function fmtPct(value) {
  return value == null ? '--' : `${Number(value).toFixed(1)}%`;
}

function fmtCores(value) {
  return value == null ? '--' : Number(value).toFixed(3);
}

function fmtBytes(value) {
  if (value == null) return '--';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = Number(value);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDuration(seconds) {
  if (seconds == null) return '--';
  const sec = Math.max(0, Math.round(Number(seconds)));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtRelative(iso) {
  if (!iso) return '--';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '--';
  let diff = Math.round((then - Date.now()) / 1000);
  if (diff > 0) diff = 0;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(state.lang, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

function fmtClock(ms) {
  const locale = state.lang === 'es' ? 'es-ES' : 'en-GB';
  return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function fmtUnit(value, unit) {
  if (value == null) return '--';
  if (unit === 'percent') return `${Number(value).toFixed(1)}%`;
  if (unit === 'celsius') return `${Number(value).toFixed(1)}°C`;
  if (unit === 'reqps') return `${Number(value).toFixed(2)}/s`;
  if (unit === 'ms') return `${Math.round(value)} ms`;
  return Number(value).toFixed(2);
}

function tone(value) {
  const v = String(value || '').toLowerCase();
  if (['synced', 'healthy', 'ok', 'true'].includes(v)) return 'ok';
  if (['progressing', 'pending', 'unknown'].includes(v)) return 'warn';
  if (!v) return 'idle';
  return 'err';
}

function localizeStatus(value) {
  const map = {
    Synced: 'status.synced',
    Healthy: 'status.healthy',
    Progressing: 'status.progressing',
    OutOfSync: 'status.outofsync',
    Degraded: 'status.degraded',
    Missing: 'status.missing',
    Unknown: 'status.unknown',
  };
  return map[value] ? t(map[value]) : value || '--';
}

function bar(label, value) {
  const v = value == null ? null : Math.max(0, Math.min(100, Number(value)));
  const cls = v == null ? '' : v > 90 ? 'err' : v > 75 ? 'warn' : '';
  return `<div class="bar-row"><span class="k">${esc(label)}</span><span class="bar"><i class="${cls}" style="width:${v == null ? 0 : v}%"></i></span><strong>${fmtPct(v)}</strong></div>`;
}

function tempBar(value) {
  const temp = value == null ? null : Number(value);
  const width = temp == null ? 0 : Math.max(0, Math.min(100, (temp / 90) * 100));
  const cls = temp == null ? '' : temp > 75 ? 'err' : temp > 65 ? 'warn' : '';
  return `<div class="bar-row"><span class="k">TEMP</span><span class="bar"><i class="${cls}" style="width:${width}%"></i></span><strong>${temp == null ? '--' : `${temp.toFixed(1)}°C`}</strong></div>`;
}

function sparkline(values) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const w = 120;
  const h = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * w;
      const y = h - ((value - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"/></svg>`;
}

function workloadText(workload) {
  return WORKLOAD_INFO[workload.id] || {
    simple: {
      es: 'Pieza interna del cluster; no sirve tráfico público directamente.',
      en: 'Internal cluster piece; it does not serve public traffic directly.',
    },
    tech: {
      es: 'Componente de plataforma desplegado por su aplicación de Argo CD.',
      en: 'Platform component deployed by its Argo CD application.',
    },
  };
}

function workloadName(workload) {
  return workload.id;
}

function allWorkloads() {
  return (state.data && state.data.workloads) || [];
}

function findWorkload(id) {
  return allWorkloads().find((workload) => workload.id === id);
}

function workloadTone(workload) {
  if (!workload.desired) return workload.ready > 0 ? 'warn' : 'err';
  if (workload.ready >= workload.desired) return 'ok';
  return workload.ready > 0 ? 'warn' : 'err';
}

// ---------------------------------------------------------------- estado
function renderStatus() {
  const data = state.data;
  if (!data) return;
  const summary = data.summary || {};
  const edge = data.edge || {};
  const backup = data.backup || {};
  const obs = data.observability || {};

  setText('stat-nodes', `${summary.nodesReady ?? '--'}/${summary.nodesTotal ?? '--'}`);
  setText('stat-apps', `${summary.appsHealthy ?? '--'}/${summary.appsTotal ?? '--'}`);
  setText('stat-pods', summary.podsRunning ?? '--');
  setText('stat-backup', backup.ageSeconds == null ? '--' : fmtDuration(backup.ageSeconds));
  setText('stat-alerts', summary.alerts ?? '--');
  setText('stat-uptime', fmtDuration(summary.uptimeSeconds));
  setText('footer-rev', `rev ${summary.revision || '--'}`);

  const tunnelOk = edge.tunnelTotal > 0 && edge.tunnelReady === edge.tunnelTotal;
  const probeOk = edge.probe && edge.probe.status === 200;
  setText('edge-tunnel', `${edge.tunnelReady || 0}/${edge.tunnelTotal || 0}`);
  setText('edge-probe', edge.probe ? `${edge.probe.ms} ms · ${edge.probe.status}` : '--');
  setChip('edge-chip', tunnelOk && probeOk ? t('status.ok') : t('status.check'), tunnelOk ? (probeOk ? 'ok' : 'warn') : 'err');

  setText('backup-age', backup.ageSeconds == null ? '--' : fmtDuration(backup.ageSeconds));
  setText('backup-size', fmtBytes(backup.sizeBytes));
  setText('backup-schedule', `${backup.schedule || '--'} · ${t('unit.daily')}`);
  setText('backup-r2', backup.r2 ? t('status.ok') : t('backup.off'));
  setChip('data-chip', backup.stale ? t('status.stale') : t('status.ok'), backup.stale ? 'warn' : 'ok');

  setText('cluster-note', `${summary.nodesReady ?? '--'}/${summary.nodesTotal ?? '--'} ${t('stat.nodesSub')}`);
  setText('gitops-note', `${summary.appsSynced ?? '--'}/${summary.appsTotal ?? '--'} ${t('status.synced')}`);
  setChip('workloads-chip', `${summary.podsRunning ?? '--'}/${summary.podsTotal ?? '--'} pods`, 'ok');

  setText('obs-targets', `${obs.targetsUp ?? '--'}/${obs.targetsTotal ?? '--'}`);
  setText('obs-alerts', summary.alerts ?? '--');
  setChip('obs-chip', summary.alerts ? t('alerts.activeCount', { n: summary.alerts }) : t('status.ok'), summary.alerts ? 'warn' : 'ok');

  renderNodes(data.nodes || []);
  renderApps(data.apps || []);
  renderCompactWorkloads();
  renderTimeline(data.events || []);
  renderTopology(data);
  renderAlerts(obs.alerts || []);

  if (data.degraded) showDegraded(true, 'partial');
  else if (!state.offline) showDegraded(false);
  updateLiveState();
}

function renderNodes(nodes) {
  const grid = $('node-grid');
  if (!grid) return;
  if (!nodes || nodes.length === 0) {
    grid.innerHTML = '<p class="alert-ok">--</p>';
    return;
  }
  grid.innerHTML = nodes
    .map((node, index) => {
      const readyClass = node.ready ? '' : 'err';
      return `<article class="node-card clickable" data-node="node${index}" tabindex="0" role="button" aria-label="${esc(node.name)}">
        <div class="node-head">
          <span class="status-dot ${readyClass}"></span>
          <span class="node-name">${esc(node.name)}</span>
          <span class="node-role">${esc(node.role)}</span>
        </div>
        ${bar('CPU', node.cpu)}
        ${bar('MEM', node.mem)}
        ${tempBar(node.temp)}
        ${bar('DISK', node.disk)}
        ${sparkline((node.history && node.history.cpu) || [])}
        <div class="node-foot"><span class="k">uptime</span><strong>${fmtDuration(node.uptimeSeconds)}</strong></div>
      </article>`;
    })
    .join('');
}

function renderApps(apps) {
  const grid = $('app-grid');
  if (!grid) return;
  if (!apps || apps.length === 0) {
    grid.innerHTML = '<p class="alert-ok">--</p>';
    return;
  }
  grid.innerHTML = apps
    .map((app) => {
      const syncTone = tone(app.sync);
      const healthTone = tone(app.health);
      return `<div class="app-card">
        <span class="app-sync ${syncTone}"></span>
        <span class="app-main">
          <span class="app-name">${esc(app.name)}</span>
          <span class="app-meta">${esc(app.revision || '--')} · ${esc(fmtRelative(app.lastSync))}</span>
        </span>
        <span class="app-health ${healthTone}">${esc(localizeStatus(app.health))}</span>
      </div>`;
    })
    .join('');
}

function renderCompactWorkloads() {
  const list = $('workload-list');
  if (!list) return;
  const picked = PRIMARY
    .map((id) => findWorkload(id))
    .filter(Boolean)
    .slice(0, 6);
  if (picked.length === 0) {
    list.innerHTML = '<li class="alert-ok">--</li>';
    return;
  }
  list.innerHTML = picked
    .map((workload) => {
      const readyTone = workloadTone(workload);
      return `<li class="workload">
        <span class="workload-name">${esc(workloadName(workload))}</span>
        <span class="workload-ready ${readyTone}">${workload.ready}/${workload.desired}</span>
        <span class="workload-ns">${esc(workload.namespace)}</span>
        <span class="workload-tag">${esc(workload.tag || workload.image || '')}</span>
      </li>`;
    })
    .join('');
}

function renderAlerts(alerts) {
  const list = $('alert-list');
  if (!list) return;
  if (!alerts || alerts.length === 0) {
    list.innerHTML = `<li class="alert-ok">● ${esc(t('alerts.none'))}</li>`;
    return;
  }
  list.innerHTML = alerts
    .map((alert) => `<li class="alert-item ${alert.severity === 'critical' ? 'critical' : ''}">
      <span class="alert-sev">${esc(alert.severity)}</span>
      <span class="alert-summary">${esc(alert.summary || alert.name)}</span>
    </li>`)
    .join('');
}

function renderTimeline(events) {
  const list = $('timeline');
  if (!list) return;
  if (!events || events.length === 0) {
    list.innerHTML = `<li><span class="ev">${esc(t('timeline.empty'))}</span></li>`;
    return;
  }
  list.innerHTML = events
    .map((event) => {
      let text = '';
      if (event.type === 'gitops') {
        text = t('event.gitops', { app: event.app, rev: event.revision || '--' });
      } else if (event.type === 'backup') {
        text = t('event.backup', { size: fmtBytes(event.sizeBytes) });
      } else if (event.type === 'probe') {
        text = t('event.probe', { ms: event.ms });
      } else if (event.type === 'alert') {
        text = t('event.alert', { name: event.name, severity: event.severity });
      }
      return `<li class="${event.type === 'alert' ? 'alert' : ''}"><span class="t">${esc(fmtRelative(event.at))}</span><span class="ev">${esc(text)}</span></li>`;
    })
    .join('');
}

function setTone(id, value) {
  const node = $(id);
  if (!node) return;
  node.classList.remove('tone-ok', 'tone-warn', 'tone-err', 'tone-idle');
  node.classList.add(`tone-${value}`);
}

function shortName(name, max = 9) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function renderTopology(data) {
  const nodes = data.nodes || [];
  const apps = data.apps || [];
  const summary = data.summary || {};
  const edge = data.edge || {};
  const backup = data.backup || {};
  const obs = data.observability || {};

  const nodeIds = ['topo-node0', 'topo-node1', 'topo-node2'];
  const nameIds = ['topo-node0-name', 'topo-node1-name', 'topo-node2-name'];
  for (let i = 0; i < 3; i += 1) {
    const node = nodes[i];
    setText(nameIds[i], node ? node.name : `node${i}`);
    setTone(nodeIds[i], node ? (node.ready ? 'ok' : 'err') : 'idle');
  }

  setTone('topo-browser', data.degraded ? 'warn' : 'ok');
  setTone('topo-edge', edge.tunnelReady > 0 ? (edge.probe && edge.probe.status === 200 ? 'ok' : 'warn') : 'err');
  setTone('topo-traefik', summary.nodesReady > 0 ? 'ok' : 'err');
  setTone('topo-cluster', summary.nodesReady === summary.nodesTotal && summary.nodesTotal > 0 ? 'ok' : summary.nodesReady > 0 ? 'warn' : 'err');
  setTone('topo-r2', backup.lastSuccess && !backup.stale ? 'ok' : backup.lastSuccess ? 'warn' : 'err');
  setTone('topo-obs', obs.targetsUp == null ? 'warn' : obs.targetsUp === obs.targetsTotal && summary.alerts === 0 ? 'ok' : 'warn');

  setText('topo-edge-sub', `tunnel ${edge.tunnelReady || 0}/${edge.tunnelTotal || 0}`);
  setText('topo-cluster-sub', `${summary.nodesReady || 0}/${summary.nodesTotal || 0} ready`);
  setText('topo-pods-sub', `${summary.podsRunning ?? '--'}/${summary.podsTotal ?? '--'} pods`);
  setText('topo-workloads-sub', `${(data.workloads || []).length} apps`);
  setText('topo-r2-sub', backup.lastSuccess ? `backup ${fmtDuration(backup.ageSeconds)}` : 'backup off');
  setText('topo-obs-sub', `Alertmanager · targets ${obs.targetsUp ?? '--'}/${obs.targetsTotal ?? '--'}`);

  const appsGroup = $('topo-apps');
  if (appsGroup) {
    const picks = ['portfolio', 'homepage', 'adguard', 'cloudflared', 'observability', 'sealed-secrets']
      .map((name) => apps.find((app) => app.name === name))
      .filter(Boolean)
      .slice(0, 6);
    appsGroup.innerHTML = picks
      .map((app, index) => {
        const x = 660 + index * 63;
        return `<g class="app-chip" transform="translate(${x},214)">
          <rect width="58" height="20" rx="4"/>
          <text x="29" y="13" text-anchor="middle">${esc(shortName(app.name, 8))}</text>
        </g>`;
      })
      .join('');
  }
}

function setChip(id, text, status) {
  const node = $(id);
  if (!node) return;
  node.textContent = text;
  node.classList.remove('ok', 'warn', 'err');
  if (status) node.classList.add(status);
}

function updateLiveState() {
  const box = $('live-state');
  if (!box) return;
  box.classList.toggle('offline', state.offline);
  setText('live-label', state.offline ? 'OFFLINE' : 'LIVE');
  const age = state.lastGood ? Math.round((Date.now() - state.lastGood) / 1000) : null;
  setText('last-update', age == null ? '--' : fmtDuration(age));
}

function showDegraded(show, mode = 'partial') {
  const node = $('degraded');
  if (!node) return;
  node.hidden = !show;
  if (show) {
    const text = mode === 'offline' ? t('degraded.offline') : t('degraded.text');
    node.innerHTML = `<span class="warn-dot"></span><span>${esc(text)}</span>`;
  }
}

// ---------------------------------------------------------------- workloads
function visibleWorkloads() {
  const query = state.search.trim().toLowerCase();
  const all = allWorkloads();
  const list = state.showInternals ? all : all.filter((workload) => WORKLOAD_INFO[workload.id] && WORKLOAD_INFO[workload.id].primary);
  return list
    .filter((workload) => {
      if (!query) return true;
      const info = workloadText(workload);
      return `${workload.id} ${workload.name} ${workload.namespace} ${tx(info.simple)}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const ai = PRIMARY.indexOf(a.id);
      const bi = PRIMARY.indexOf(b.id);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.id.localeCompare(b.id);
    });
}

function renderWorkloadGrid() {
  const grid = $('workload-grid');
  if (!grid) return;
  if (!state.data) {
    grid.innerHTML = `<p class="alert-ok">${esc(t('dash.loading'))}</p>`;
    return;
  }
  const list = visibleWorkloads();
  const total = allWorkloads().length;
  const primaries = allWorkloads().filter((workload) => WORKLOAD_INFO[workload.id] && WORKLOAD_INFO[workload.id].primary).length;
  setText('workload-count', t('workloads.count', { n: list.length }));
  const toggle = $('workload-toggle');
  if (toggle) {
    toggle.textContent = state.showInternals ? t('workloads.hideInternals') : t('workloads.showInternals');
    toggle.setAttribute('aria-pressed', state.showInternals ? 'true' : 'false');
    toggle.disabled = total === primaries;
  }

  if (list.length === 0) {
    grid.innerHTML = `<p class="alert-ok">${esc(t('workloads.empty'))}</p>`;
    return;
  }

  grid.innerHTML = list
    .map((workload) => {
      const info = workloadText(workload);
      const readyTone = workloadTone(workload);
      return `<button class="workload-card" data-workload="${esc(workload.id)}" aria-haspopup="dialog">
        <span class="wc-top">
          <span class="status-dot ${readyTone === 'ok' ? '' : readyTone}"></span>
          <span class="wc-name">${esc(workloadName(workload))}</span>
          <span class="wc-status ${readyTone}">${workload.ready}/${workload.desired}</span>
        </span>
        <span class="wc-kind">${esc(workload.kind)} · ${esc(workload.namespace)}</span>
        <span class="wc-desc">${esc(tx(info.simple))}</span>
        <span class="wc-foot">
          <span>${esc(t('workloads.ready'))} <strong>${workload.ready}/${workload.desired}</strong></span>
          <span class="wc-mini">
            <span>CPU <strong>${fmtCores(workload.cpu)}</strong></span>
            <span>MEM <strong>${fmtBytes(workload.mem)}</strong></span>
          </span>
        </span>
      </button>`;
    })
    .join('');
}

// ---------------------------------------------------------------- dashboards
function chartSpecFor(tab) {
  return CHART_SPECS[tab] || [];
}

function renderDashboards() {
  const explain = $('dash-explain');
  const body = $('dash-body');
  const meta = $('dash-meta');
  if (!explain || !body || !meta) return;

  explain.textContent = t(`dash.explain.${state.dash.tab}`);
  const hasData = Object.prototype.hasOwnProperty.call(state.dash.cache, state.dash.range);
  const data = state.dash.cache[state.dash.range];
  if (!hasData) {
    meta.textContent = '';
    body.innerHTML = `<div class="chart"><h3>${esc(t('dash.loading'))}</h3><div class="chart-empty">…</div></div>`;
    return;
  }
  if (!data) {
    meta.textContent = '';
    body.innerHTML = `<div class="chart"><h3>${esc(t('dash.noData'))}</h3><div class="chart-empty">${esc(t('dash.noData'))}</div></div>`;
    return;
  }
  meta.textContent = t('dash.updated', { age: fmtRelative(data.generatedAt), range: state.dash.range });

  if (state.dash.tab === 'pods') {
    body.classList.add('top-pods');
    body.innerHTML = topList(data.top.cpu || [], 'dash.top.cpu', 'cores') + topList(data.top.memory || [], 'dash.top.memory', 'bytes');
    return;
  }

  body.classList.remove('top-pods');
  const charts = data.charts[state.dash.tab] || {};
  body.innerHTML = chartSpecFor(state.dash.tab)
    .map((spec) => `<div class="chart" data-chart="${esc(spec.key)}"><h3>${esc(t(spec.title))}</h3><span class="chart-unit">${esc(spec.unit)}</span><div class="chart-plot"></div></div>`)
    .join('');

  for (const spec of chartSpecFor(state.dash.tab)) {
    const host = body.querySelector(`[data-chart="${spec.key}"] .chart-plot`);
    if (!host) continue;
    renderChart(host, {
      id: `${state.dash.tab}-${spec.key}`,
      unit: spec.unit,
      min: spec.min,
      max: spec.max,
      floorMax: spec.floorMax,
      scale: spec.scale || 1,
      series: charts[spec.key] || [],
    });
  }
}

function topList(rows, titleKey, unit) {
  if (!rows.length) {
    return `<div class="chart"><h3>${esc(t(titleKey))}</h3><div class="chart-empty">${esc(t('dash.noData'))}</div></div>`;
  }
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((row) => row.value), 1);
  const items = sorted
    .map((row) => {
      const value = unit === 'bytes' ? fmtBytes(row.value) : fmtCores(row.value);
      const width = (row.value / max) * 100;
      return `<div class="top-row">
        <span class="tr-name" title="${esc(row.label)}">${esc(row.label)}</span>
        <span class="tr-val">${value}</span>
        <span class="tr-bar"><i style="width:${width}%"></i></span>
      </div>`;
    })
    .join('');
  return `<div class="chart"><h3>${esc(t(titleKey))}</h3><div class="top-list">${items}</div></div>`;
}

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * base;
}

function renderChart(host, opts) {
  const all = (opts.series || []).filter((series) => Array.isArray(series.points) && series.points.length > 0);
  let visible = all.filter((series) => !state.hiddenSeries.has(`${opts.id}|${series.label}`));
  if (visible.length === 0) visible = all;
  if (all.length === 0) {
    host.innerHTML = `<div class="chart-empty">${esc(t('dash.noData'))}</div>`;
    return;
  }

  const points = visible.flatMap((series) => series.points);
  if (points.length === 0) {
    host.innerHTML = `<div class="chart-empty">${esc(t('dash.noData'))}</div>`;
    return;
  }

  const width = Math.max(260, host.clientWidth || 320);
  const height = 170;
  const pad = { l: 44, r: 10, t: 10, b: 20 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xMin = Math.min(...points.map((point) => point[0]));
  const xMax = Math.max(...points.map((point) => point[0]));
  const xSpan = xMax - xMin || 1;
  const yValues = points.map((point) => point[1] * (opts.scale || 1));
  const yMin = opts.min ?? 0;
  let yMax = opts.max ?? niceMax(Math.max(...yValues, 0.0001));
  if (opts.floorMax) yMax = Math.max(yMax, opts.floorMax);
  if (yMax <= yMin) yMax = yMin + 1;

  const sx = (ts) => pad.l + ((ts - xMin) / xSpan) * plotW;
  const sy = (value) => pad.t + plotH - ((value - yMin) / (yMax - yMin)) * plotH;

  const grid = [];
  for (let i = 0; i <= 4; i += 1) {
    const value = yMin + ((yMax - yMin) * i) / 4;
    const y = sy(value);
    grid.push(`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${width - pad.r}" y2="${y.toFixed(1)}"/>`);
    grid.push(`<text class="chart-axis" x="${pad.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${esc(fmtAxis(value, opts.unit))}</text>`);
  }

  const xLabels = [xMin, xMin + xSpan / 2, xMax].map((ts, index) => {
    const anchor = index === 0 ? 'start' : index === 2 ? 'end' : 'middle';
    const x = index === 0 ? pad.l : index === 2 ? width - pad.r : sx(ts);
    return `<text class="chart-axis" x="${x.toFixed(1)}" y="${height - 4}" text-anchor="${anchor}">${esc(fmtClock(ts))}</text>`;
  });

  const lines = visible.map((series, index) => {
    const color = PALETTE[all.indexOf(series) % PALETTE.length];
    const path = series.points
      .map((point, i) => `${i === 0 ? 'M' : 'L'} ${sx(point[0]).toFixed(1)} ${sy(point[1] * (opts.scale || 1)).toFixed(1)}`)
      .join(' ');
    return `<path class="chart-line" d="${path}" stroke="${color}"/>`;
  });

  const legend = all
    .map((series, index) => {
      const color = PALETTE[index % PALETTE.length];
      const off = state.hiddenSeries.has(`${opts.id}|${series.label}`);
      const label = series.label === 'total' ? t('dash.total') : series.label;
      return `<button type="button" class="${off ? 'off' : ''}" data-series="${esc(series.label)}"><i style="background:${color}"></i>${esc(label)}</button>`;
    })
    .join('');

  host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(host.closest('.chart').querySelector('h3').textContent)}">
    <g class="chart-grid">${grid.join('')}</g>
    ${lines.join('')}
    <g>${xLabels.join('')}</g>
    <rect class="chart-hover" x="${pad.l}" y="${pad.t}" width="${plotW}" height="${plotH}" fill="transparent"/>
  </svg>
  <div class="chart-legend">${legend}</div>
  <div class="chart-tip"></div>`;

  const svg = host.querySelector('svg');
  const tip = host.querySelector('.chart-tip');
  const hover = host.querySelector('.chart-hover');
  const visibleSeries = visible.map((series) => ({
    label: series.label,
    color: PALETTE[all.indexOf(series) % PALETTE.length],
    points: series.points,
  }));

  const move = (event) => {
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    if (x < pad.l || x > width - pad.r) {
      tip.classList.remove('show');
      return;
    }
    const ts = xMin + ((x - pad.l) / plotW) * xSpan;
    const rows = visibleSeries
      .map((series) => {
        let best = null;
        for (const point of series.points) {
          if (best == null || Math.abs(point[0] - ts) < Math.abs(best[0] - ts)) best = point;
        }
        return best ? { label: series.label === 'total' ? t('dash.total') : series.label, value: best[1] * (opts.scale || 1), color: series.color } : null;
      })
      .filter(Boolean);
    if (!rows.length) return;
    tip.innerHTML = `<span class="tt">${esc(fmtClock(ts))}</span>${rows
      .map((row) => `<span class="tv"><span><i style="display:inline-block;width:7px;height:2px;background:${row.color};margin-right:5px"></i>${esc(row.label)}</span><strong>${esc(fmtUnit(row.value, opts.unit))}</strong></span>`)
      .join('')}`;
    const hostRect = host.getBoundingClientRect();
    const left = Math.min(Math.max(event.clientX - hostRect.left, 64), hostRect.width - 64);
    const top = Math.max(18, event.clientY - hostRect.top - 12);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.classList.add('show');
  };

  hover.addEventListener('pointermove', move);
  hover.addEventListener('pointerleave', () => tip.classList.remove('show'));
  host.querySelectorAll('.chart-legend button').forEach((button) => {
    button.addEventListener('click', () => {
      const key = `${opts.id}|${button.dataset.series}`;
      if (state.hiddenSeries.has(key)) {
        state.hiddenSeries.delete(key);
      } else {
        const shown = all.filter((series) => !state.hiddenSeries.has(`${opts.id}|${series.label}`));
        if (shown.length <= 1) return;
        state.hiddenSeries.add(key);
      }
      renderDashboards();
    });
  });
}

function fmtAxis(value, unit) {
  if (unit === 'percent') return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`;
  if (unit === 'celsius') return `${Math.round(value)}°`;
  if (unit === 'reqps') return value.toFixed(value < 1 ? 2 : 1);
  if (unit === 'ms') return `${Math.round(value)}`;
  return String(Math.round(value));
}

async function loadDashboards(force = false) {
  const range = state.dash.range;
  if (!force && Object.prototype.hasOwnProperty.call(state.dash.cache, range)) {
    renderDashboards();
    return;
  }
  state.dash.loading = true;
  if (!Object.prototype.hasOwnProperty.call(state.dash.cache, range)) renderDashboards();
  try {
    const res = await fetch(`/live/api/dashboards?range=${encodeURIComponent(range)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.dash.cache[range] = await res.json();
  } catch {
    state.dash.cache[range] = null;
  } finally {
    state.dash.loading = false;
    renderDashboards();
  }
}

// ---------------------------------------------------------------- recorrido
function renderJourney() {
  const step = JOURNEY[state.journey.step] || JOURNEY[0];
  const box = $('journey-text');
  if (box) {
    box.innerHTML = `<span class="step-k">${esc(step.title[state.lang] || step.title.es)}</span>${esc(step.text[state.lang] || step.text.es)}`;
  }
  setText('journey-step', `${state.journey.step + 1}/${JOURNEY.length}`);
  document.querySelectorAll('[data-node]').forEach((node) => {
    node.classList.toggle('journey-on', node.dataset.node === step.target);
  });
  const play = $('journey-play');
  if (play) {
    play.textContent = state.journey.playing ? '❚❚' : '▶';
    play.setAttribute('aria-label', state.journey.playing ? t('journey.pause') : t('journey.play'));
  }
}

function setJourneyStep(index, autoplay = false) {
  state.journey.step = (index + JOURNEY.length) % JOURNEY.length;
  if (autoplay) {
    state.journey.playing = true;
    clearInterval(state.journey.timer);
    state.journey.timer = setInterval(() => {
      if (state.journey.step >= JOURNEY.length - 1) {
        stopJourney();
        return;
      }
      state.journey.step += 1;
      renderJourney();
    }, 4500);
  }
  renderJourney();
  const section = $('como-funciona');
  if (section && autoplay) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function stopJourney() {
  state.journey.playing = false;
  clearInterval(state.journey.timer);
  state.journey.timer = null;
  renderJourney();
}

function toggleJourney() {
  if (state.journey.playing) {
    stopJourney();
    return;
  }
  if (state.journey.step >= JOURNEY.length - 1) state.journey.step = 0;
  state.journey.playing = true;
  renderJourney();
  state.journey.timer = setInterval(() => {
    if (state.journey.step >= JOURNEY.length - 1) {
      stopJourney();
      return;
    }
    state.journey.step += 1;
    renderJourney();
  }, 4500);
}

// ---------------------------------------------------------------- cajón
function openDrawer(type, id, trigger = null) {
  state.drawer = { type, id, trigger };
  renderDrawer();
  const drawer = $('drawer');
  if (!drawer) return;
  drawer.hidden = false;
  document.body.style.overflow = 'hidden';
  const close = $('drawer-close');
  if (close) close.focus();
  if (history.replaceState) {
    const url = new URL(location.href);
    url.searchParams.set(type === 'node' ? 'node' : 'workload', id);
    history.replaceState(null, '', url);
  }
}

function closeDrawer() {
  const trigger = state.drawer && state.drawer.trigger;
  state.drawer = null;
  const drawer = $('drawer');
  if (drawer) drawer.hidden = true;
  document.body.style.overflow = '';
  if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) trigger.focus();
  if (history.replaceState) {
    const url = new URL(location.href);
    url.searchParams.delete('node');
    url.searchParams.delete('workload');
    history.replaceState(null, '', url);
  }
}

function drawerStat(label, value, toneClass = '') {
  return `<div class="drawer-stat"><span class="k">${esc(label)}</span><strong class="${toneClass}">${esc(value)}</strong></div>`;
}

function renderDrawer() {
  if (!state.drawer) return;
  const body = $('drawer-body');
  const title = $('drawer-title');
  const kind = $('drawer-kind');
  if (!body || !title || !kind) return;

  if (!state.data) {
    title.textContent = '…';
    kind.textContent = '';
    body.innerHTML = `<p>${esc(t('dash.loading'))}</p>`;
    return;
  }

  if (state.drawer.type === 'workload') {
    const workload = findWorkload(state.drawer.id);
    if (!workload) {
      title.textContent = state.drawer.id;
      kind.textContent = t('drawer.workload');
      body.innerHTML = `<p>${esc(t('drawer.noPods'))}</p>`;
      return;
    }
    const info = workloadText(workload);
    const isPrimary = Boolean(WORKLOAD_INFO[workload.id] && WORKLOAD_INFO[workload.id].primary);
    title.textContent = workloadName(workload);
    kind.textContent = `${t('drawer.workload')} · ${workload.kind}`;
    const resource = workload.resources || {};
    const pods = (workload.pods || []).slice(0, 8);
    const links = [];
    if (info.url) {
      links.push(`<a href="${esc(info.url)}" target="_blank" rel="noopener">${esc(info.url)}${info.access ? ` · ${esc(t('drawer.access'))}` : ''}</a>`);
    }
    body.innerHTML = `
      <p>${esc(tx(info.simple))}</p>
      <p class="drawer-note">${esc(workload.namespace)} · ${esc(workload.kind)}</p>
      <h3>${esc(t('drawer.live'))}</h3>
      <div class="drawer-stats">
        ${drawerStat(t('drawer.status'), `${workload.ready}/${workload.desired}`, workloadTone(workload) === 'ok' ? 'ok' : workloadTone(workload))}
        ${drawerStat(t('drawer.cpu'), fmtCores(workload.cpu))}
        ${drawerStat(t('drawer.memory'), fmtBytes(workload.mem))}
        ${drawerStat(t('drawer.restarts'), String(workload.restarts || 0))}
      </div>
      <h3>${esc(t('drawer.technical'))}</h3>
      <p>${esc(tx(info.tech))}</p>
      <p class="drawer-note">${esc(t('drawer.image'))}: ${esc(workload.image || '--')}</p>
      <h3>${esc(t('drawer.resources'))}</h3>
      <div class="drawer-stats">
        ${drawerStat(`${t('drawer.requests')} CPU`, resource.cpuRequestMillis ? `${resource.cpuRequestMillis}m` : '--')}
        ${drawerStat(`${t('drawer.requests')} MEM`, resource.memRequestBytes ? fmtBytes(resource.memRequestBytes) : '--')}
        ${drawerStat(`${t('drawer.limits')} CPU`, resource.cpuLimitMillis ? `${resource.cpuLimitMillis}m` : '--')}
        ${drawerStat(`${t('drawer.limits')} MEM`, resource.memLimitBytes ? fmtBytes(resource.memLimitBytes) : t('drawer.noLimits'))}
      </div>
      <h3>${esc(t('drawer.pods'))} (${pods.length}/${(workload.pods || []).length})</h3>
      ${pods.length === 0 ? `<p>${esc(t('drawer.noPods'))}</p>` : `
        <table class="drawer-pods">
          <thead><tr><th>${esc(t('drawer.pod'))}</th><th>${esc(t('drawer.node'))}</th><th>${esc(t('drawer.status'))}</th><th>${esc(t('drawer.restarts'))}</th><th>CPU</th><th>MEM</th></tr></thead>
          <tbody>${pods.map((pod) => `<tr>
            <td>${esc(pod.name)}</td>
            <td>${esc(pod.node)}</td>
            <td class="${pod.phase === 'Running' ? 'ok' : 'warn'}">${esc(pod.phase)} ${pod.ready}/${pod.containers}</td>
            <td>${pod.restarts}</td>
            <td>${fmtCores(pod.cpu)}</td>
            <td>${fmtBytes(pod.mem)}</td>
          </tr>`).join('')}</tbody>
        </table>`}
      <h3>${esc(t('drawer.links'))}</h3>
      ${links.length ? `<div class="drawer-links">${links.join('')}</div>` : `<p class="drawer-note">${esc(t('drawer.noPublic'))}</p>`}
      ${isPrimary ? '' : `<p class="drawer-note">${esc(t('drawer.internals'))}</p>`}
    `;
    return;
  }

  // Nodo de la topología o de la lista de nodos.
  const id = state.drawer.id;
  const data = state.data;
  const info = id.startsWith('node') ? NODE_INFO.node : NODE_INFO[id];
  if (!info) return;
  const nodeIndex = id.startsWith('node') ? Number(id.replace('node', '')) : -1;
  const node = nodeIndex >= 0 ? (data.nodes || [])[nodeIndex] : null;
  title.textContent = node ? node.name : tx(info.title);
  kind.textContent = t(info.kind);
  const stats = [];
  let tech = tx(info.tech);
  let simple = tx(info.simple);

  if (node) {
    stats.push(drawerStat(t('drawer.status'), node.ready ? 'Ready' : 'NotReady', node.ready ? 'ok' : 'err'));
    stats.push(drawerStat(t('drawer.cpu'), fmtPct(node.cpu)));
    stats.push(drawerStat(t('drawer.memory'), fmtPct(node.mem)));
    stats.push(drawerStat(t('drawer.temp'), node.temp == null ? '--' : `${node.temp.toFixed(1)}°C`));
    stats.push(drawerStat(t('drawer.disk'), fmtPct(node.disk)));
    stats.push(drawerStat(t('drawer.uptime'), fmtDuration(node.uptimeSeconds)));
  } else if (id === 'cluster') {
    const summary = data.summary || {};
    stats.push(drawerStat(t('stat.nodes'), `${summary.nodesReady ?? '--'}/${summary.nodesTotal ?? '--'}`));
    stats.push(drawerStat(t('stat.pods'), `${summary.podsRunning ?? '--'}/${summary.podsTotal ?? '--'}`));
    stats.push(drawerStat(t('stat.apps'), `${summary.appsHealthy ?? '--'}/${summary.appsTotal ?? '--'}`));
    stats.push(drawerStat(t('drawer.workload'), String((data.workloads || []).length)));
  } else if (id === 'edge') {
    const edge = data.edge || {};
    stats.push(drawerStat(t('drawer.tunnel'), `${edge.tunnelReady || 0}/${edge.tunnelTotal || 0}`));
    stats.push(drawerStat(t('drawer.probe'), edge.probe ? `${edge.probe.ms} ms · ${edge.probe.status}` : '--'));
    stats.push(drawerStat(t('layer.edge.tls'), 'Cloudflare'));
    stats.push(drawerStat(t('layer.edge.host'), 'dbarroso.dev'));
  } else if (id === 'r2') {
    const backup = data.backup || {};
    stats.push(drawerStat(t('stat.backup'), fmtDuration(backup.ageSeconds)));
    stats.push(drawerStat(t('drawer.size'), fmtBytes(backup.sizeBytes)));
    stats.push(drawerStat(t('drawer.schedule'), `${backup.schedule || '--'} · ${t('unit.daily')}`));
    stats.push(drawerStat(t('drawer.retention'), '14d'));
    if (backup.stale) simple = `${simple} ${t('drawer.stale')}.`;
  } else if (id === 'obs') {
    const obs = data.observability || {};
    const summary = data.summary || {};
    stats.push(drawerStat(t('drawer.targets'), `${obs.targetsUp ?? '--'}/${obs.targetsTotal ?? '--'}`));
    stats.push(drawerStat(t('drawer.alerts'), String(summary.alerts ?? '--')));
    stats.push(drawerStat(t('drawer.rules'), '7'));
    stats.push(drawerStat(t('layer.obs.notify'), 'ntfy'));
  } else if (id === 'traefik') {
    stats.push(drawerStat(t('drawer.route'), '/ → portfolio'));
    stats.push(drawerStat(t('drawer.route'), '/live → observatory'));
    stats.push(drawerStat(t('drawer.status'), 'Ready', 'ok'));
  } else if (id === 'browser') {
    const probe = data.edge && data.edge.probe;
    stats.push(drawerStat(t('drawer.probe'), probe ? `${probe.ms} ms · ${probe.status}` : '--'));
    stats.push(drawerStat(t('layer.edge.host'), 'dbarroso.dev'));
  }

  body.innerHTML = `
    <p>${esc(simple)}</p>
    ${stats.length ? `<h3>${esc(t('drawer.live'))}</h3><div class="drawer-stats">${stats.join('')}</div>` : ''}
    <h3>${esc(t('drawer.technical'))}</h3>
    <p>${esc(tech)}</p>
    ${state.drawer.id === 'cluster' ? `<div class="drawer-links"><a href="#workloads" data-close="1">${esc(t('layer.workloads.more'))}</a><a href="#dashboards" data-close="1">${esc(t('dash.title'))}</a></div>` : ''}
  `;
}

// ---------------------------------------------------------------- FAQ
function renderFaq() {
  const list = $('faq-list');
  if (!list) return;
  list.innerHTML = FAQ
    .map(([question, answer]) => `<details class="faq-item"><summary>${esc(t(question))}</summary><p>${esc(t(answer))}</p></details>`)
    .join('');
}

// ---------------------------------------------------------------- idioma
function applyLang() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === state.lang);
    btn.setAttribute('aria-pressed', btn.dataset.lang === state.lang ? 'true' : 'false');
  });
  if (state.data) {
    renderStatus();
    renderWorkloadGrid();
    if (state.drawer) renderDrawer();
  }
  renderFaq();
  renderJourney();
  renderDashboards();
  updateLiveState();
}

// ---------------------------------------------------------------- datos
async function refresh() {
  if (document.hidden) return;
  try {
    const res = await fetch('/live/api/status', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.offline = false;
    state.lastGood = Date.now();
    state.data = data;
    renderStatus();
    renderWorkloadGrid();
    if (state.drawer) renderDrawer();
  } catch {
    state.offline = true;
    showDegraded(true, 'offline');
    updateLiveState();
  }
}

function setupNav() {
  const links = [...document.querySelectorAll('.nav a')];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`);
      });
    },
    { rootMargin: '-30% 0px -55% 0px', threshold: [0.05, 0.25, 0.5] },
  );
  sections.forEach((section) => observer.observe(section));

  const dash = $('dashboards');
  if (dash) {
    const dashObserver = new IntersectionObserver((entries) => {
      state.dash.visible = entries.some((entry) => entry.isIntersecting);
    });
    dashObserver.observe(dash);
  }
}

function init() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lang = btn.dataset.lang;
      localStorage.setItem('obs.lang', state.lang);
      applyLang();
    });
  });

  const journeyBtn = $('journey-btn');
  if (journeyBtn) journeyBtn.addEventListener('click', () => setJourneyStep(0, true));
  const prev = $('journey-prev');
  if (prev) prev.addEventListener('click', () => { stopJourney(); setJourneyStep(state.journey.step - 1); });
  const next = $('journey-next');
  if (next) next.addEventListener('click', () => { stopJourney(); setJourneyStep(state.journey.step + 1); });
  const play = $('journey-play');
  if (play) play.addEventListener('click', toggleJourney);

  const search = $('workload-search');
  if (search) search.addEventListener('input', () => { state.search = search.value; renderWorkloadGrid(); });
  const toggle = $('workload-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    state.showInternals = !state.showInternals;
    renderWorkloadGrid();
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.dash.tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((other) => {
        const active = other === btn;
        other.classList.toggle('active', active);
        other.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderDashboards();
    });
  });

  document.querySelectorAll('.range-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.dash.range = btn.dataset.range;
      document.querySelectorAll('.range-btn').forEach((other) => other.classList.toggle('active', other === btn));
      loadDashboards(true);
    });
  });

  document.addEventListener('click', (event) => {
    const workload = event.target.closest('[data-workload]');
    if (workload) {
      openDrawer('workload', workload.dataset.workload, workload);
      return;
    }
    const node = event.target.closest('[data-node]');
    if (node) {
      openDrawer('node', node.dataset.node, node);
      return;
    }
    if (event.target.closest('[data-close]')) closeDrawer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.drawer) {
      closeDrawer();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-node]')) {
      event.preventDefault();
      openDrawer('node', event.target.dataset.node, event.target);
    }
  });

  const close = $('drawer-close');
  if (close) close.addEventListener('click', closeDrawer);
  const drawer = $('drawer');
  if (drawer) {
    drawer.addEventListener('click', (event) => {
      if (event.target === drawer || event.target.classList.contains('drawer-backdrop')) closeDrawer();
    });
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderDashboards, 180);
  });

  // Enlace directo: ?node=edge o ?workload=portfolio
  const deepNode = params.get('node');
  const deepWorkload = params.get('workload');
  if (deepNode || deepWorkload) {
    setTimeout(() => {
      if (deepWorkload) openDrawer('workload', deepWorkload);
      else openDrawer('node', deepNode);
    }, 600);
  }

  applyLang();
  refresh();
  loadDashboards();
  setInterval(refresh, 15000);
  setInterval(() => { if (state.dash.visible && !document.hidden) loadDashboards(true); }, 60000);
  setInterval(updateLiveState, 1000);
  setupNav();
}

document.addEventListener('DOMContentLoaded', init);
