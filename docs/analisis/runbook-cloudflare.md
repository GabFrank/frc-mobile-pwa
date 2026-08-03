# Runbook — HTTPS con Cloudflare para el central

Pasos para exponer las instancias del central por HTTPS y WSS. **Es la Fase 0 del [plan de migración](plan-migracion-pwa.md), pero se justifica sola:** cierra el hallazgo de credenciales en texto plano de `REPORTE_VULNERABILIDADES.md`.

## Arquitectura objetivo

```
Navegador / app
   │  https:// · wss://
   ▼
Cloudflare  (certificado público, termina TLS del lado del usuario)
   │  https://  ← Full (strict), con certificado Origin CA
   ▼
159.203.86.103:443   nginx (reverse proxy)  ← rutea por nombre de host
   ├─ bodega.<dominio>    → http://127.0.0.1:8081
   ├─ farmacia.<dominio>  → http://127.0.0.1:8082
   └─ alpha.<dominio>     → http://127.0.0.1:8083
```

**Spring Boot no se toca.** Sigue escuchando HTTP en su puerto, pero solo en loopback.

> **Nota:** el plan original mencionaba Origin Rules de Cloudflare para mapear los puertos 8081/8082. **Con el reverse proxy no hacen falta**: Cloudflare habla siempre al 443 y nginx resuelve el puerto interno según el `Host`. Menos piezas, menos configuración que mantener.

---

## Orden de ejecución

**Empezar por `alpha` (8083).** Es la instancia de pruebas: si algo sale mal, no afecta a farmacia ni a bodega. Recién con alpha validada, repetir para las otras dos.

---

## Paso 1 — Relevar el origen

En el servidor `159.203.86.103`:

```bash
sudo ss -tlnp | grep -E ':(80|443|8081|8082|8083)'
```

Anotar:
- [ ] ¿Hay algo escuchando en 443? Si ya hay un proxy, se agrega un `server` block en vez de instalar uno nuevo
- [ ] Confirmar que 8081/8082/8083 son efectivamente las tres instancias
- [ ] Qué distribución y si ya está nginx o Caddy

---

## Paso 2 — DNS en Cloudflare

Panel de Cloudflare → **DNS → Records**. Crear tres registros:

| Type | Name | Content | Proxy status |
|---|---|---|---|
| A | `alpha` | `159.203.86.103` | **Proxied** (nube naranja) |
| A | `farmacia` | `159.203.86.103` | **Proxied** |
| A | `bodega` | `159.203.86.103` | **Proxied** |

> ⚠️ **La nube tiene que quedar naranja.** En gris (DNS only) Cloudflare no termina TLS ni proxea WebSockets: solo resuelve el nombre, y el tráfico va directo al origen sin cifrar.

---

## Paso 3 — Certificado de origen

Panel → **SSL/TLS → Origin Server → Create Certificate**.

- Tipo de clave: **RSA (2048)**
- Hostnames: `*.<dominio>` y `<dominio>`
- Validez: **15 años**

Cloudflare muestra dos bloques **una sola vez**. Copiarlos al servidor:

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/origin.pem   # pegar el Origin Certificate
sudo nano /etc/ssl/cloudflare/origin.key   # pegar la Private Key
sudo chmod 600 /etc/ssl/cloudflare/origin.key
```

> Este certificado **solo lo acepta Cloudflare**, no un navegador. Está bien: el navegador nunca habla directo con el origen. Lo que el usuario ve es el certificado público de Cloudflare.

---

## Paso 4 — Modo SSL

Panel → **SSL/TLS → Overview → Full (strict)**.

| Modo | Cloudflare → origen | Veredicto |
|---|---|---|
| Off / Flexible | **HTTP plano** | ❌ Las credenciales siguen viajando sin cifrar. No arregla nada |
| Full | HTTPS sin validar el cert | ⚠️ Mejor, pero acepta cualquier certificado |
| **Full (strict)** | HTTPS con cert válido | ✅ **El correcto** |

También activar:
- [ ] **SSL/TLS → Edge Certificates → Always Use HTTPS**: `On`
- [ ] **Minimum TLS Version**: `1.2`

---

## Paso 5 — Reverse proxy

`/etc/nginx/sites-available/frc-central`:

```nginx
# ── Mapa para el upgrade a WebSocket ──
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# ── ALPHA ──
server {
    listen 443 ssl http2;
    server_name alpha.<dominio>;

    ssl_certificate     /etc/ssl/cloudflare/origin.pem;
    ssl_certificate_key /etc/ssl/cloudflare/origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 25m;          # fotos de rendición y cupones

    location / {
        proxy_pass http://127.0.0.1:8083;

        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;      # WebSocket
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;       # Spring debe saber que hay TLS
        proxy_set_header X-Forwarded-Host  $host;

        proxy_read_timeout  3600s;      # suscripciones GraphQL de larga duración
        proxy_send_timeout  3600s;
        proxy_buffering off;
    }
}

# ── FARMACIA (8082) y BODEGA (8081): mismo bloque, cambiando
#    server_name y el puerto de proxy_pass ──

# ── Redirigir HTTP a HTTPS ──
server {
    listen 80;
    server_name alpha.<dominio> farmacia.<dominio> bodega.<dominio>;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/frc-central /etc/nginx/sites-enabled/
sudo nginx -t          # valida la sintaxis antes de recargar
sudo systemctl reload nginx
```

> ⚠️ **`proxy_read_timeout 3600s` es necesario.** El default de nginx (60 s) cortaría las suscripciones GraphQL cada minuto.

---

## Paso 6 — Spring Boot detrás del proxy

En `application.properties` de cada instancia:

```properties
server.forward-headers-strategy=NATIVE
```

Sin esto, Spring cree que la request llegó por HTTP y puede generar redirecciones o URLs absolutas con `http://`, que el navegador bloquea como mixed content.

- [ ] Revisar la configuración de **CORS** del central: los orígenes nuevos (`https://bodega.<dominio>`, etc.) tienen que estar permitidos
- [ ] Reiniciar cada instancia

---

## Paso 7 — WebSockets y caché en Cloudflare

**Network → WebSockets:** confirmar que está en `On` (viene activado por defecto).

**Caching → Cache Rules:** crear una regla que evite cachear la API.

```
Si  hostname está en {alpha, farmacia, bodega}.<dominio>
Entonces  Cache eligibility: Bypass cache
```

> Cloudflare no cachea `POST` por defecto, así que GraphQL no debería verse afectado. La regla es una red de seguridad barata: un `GET` cacheado por error devolvería datos de otro usuario.

---

## Paso 8 — Cerrar los puertos viejos

**Este paso es el que convierte el trabajo en una mejora de seguridad real.** Sin él, los puertos en texto plano siguen abiertos y todo lo anterior es opcional para un atacante.

1. **Coordinarlo:** la app instalada hoy apunta a `159.203.86.103:8081/8082`. Cerrar esos puertos **deja fuera de servicio a la flota actual**.

   Dos caminos:
   - **(a) Recomendado** — actualizar primero la app actual para que apunte a los subdominios HTTPS, publicar esa versión, esperar a que la flota se actualice, y recién ahí cerrar los puertos.
   - **(b)** Mantener 8081/8082 abiertos hasta que la PWA reemplace a la app. Más simple, pero la vulnerabilidad sigue abierta mientras tanto.

2. Una vez que nadie use los puertos directos:

```bash
# Permitir 443 solo desde las IPs de Cloudflare
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo ufw allow from $ip to any port 443 proto tcp
done

sudo ufw deny 8081/tcp
sudo ufw deny 8082/tcp
sudo ufw deny 8083/tcp
```

Y en cada instancia de Spring Boot, hacer que escuche **solo en loopback**:

```properties
server.address=127.0.0.1
```

---

## Paso 9 — Validación

Con `alpha` primero. **No pasar a farmacia/bodega hasta que los seis pasen.**

```bash
# 1 · HTTPS responde
curl -sI https://alpha.<dominio>/graphql | head -3

# 2 · Cadena de certificados válida
curl -sv https://alpha.<dominio>/ 2>&1 | grep -E 'SSL|subject|issuer'

# 3 · GraphQL responde
curl -s https://alpha.<dominio>/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ __typename }"}'

# 4 · Login REST responde
curl -si https://alpha.<dominio>/login \
  -H 'Content-Type: application/json' \
  -d '{"nickname":"test","password":"test"}' | head -3

# 5 · WebSocket conecta y SOBREVIVE 3 minutos sin tráfico
npx wscat -c wss://alpha.<dominio>/subscriptions
```

- [ ] 1-5 pasan
- [ ] **6 · En un celular Android real**, abrir `https://alpha.<dominio>/graphql` en Chrome: candado sin advertencias
- [ ] **7 · En un iPhone**, lo mismo en Safari — iOS es más estricto con las cadenas de certificados
- [ ] 8 · Latencia comparada contra el acceso directo por IP, medida desde una sucursal

> **El punto 5 es el que más suele fallar.** Cloudflare corta WebSockets inactivos alrededor de los 100 s. Si la conexión se cae, hay que configurar keepalive/ping del lado del servidor GraphQL. Es lo que en producción se manifiesta como "las notificaciones a veces no llegan".

---

## Paso 10 — Repetir para farmacia y bodega

Mismo `server` block cambiando `server_name` y el puerto de `proxy_pass`. **Fuera de horario comercial**: implica reiniciar Spring Boot para aplicar `forward-headers-strategy`.

---

## Checklist final

- [ ] Tres subdominios en DNS, proxied
- [ ] SSL/TLS en Full (strict) + Always Use HTTPS + TLS mínimo 1.2
- [ ] Certificado Origin CA instalado
- [ ] nginx ruteando por host, con headers de WebSocket y timeouts largos
- [ ] `server.forward-headers-strategy=NATIVE` en las tres instancias
- [ ] CORS actualizado con los orígenes nuevos
- [ ] WebSockets activos, caché en bypass para la API
- [ ] Validación 1-8 en verde en alpha
- [ ] Plan definido para cerrar 8081/8082 sin dejar la flota afuera

## Después

- Las IPs hardcodeadas de `change-server-ip-dialog.component.ts` y `precio-config.component.ts` pasan a ser subdominios (ítem 44 del `TODO_TECNICO.md`)
- Cloudflare da métricas de tráfico y errores por instancia, que hoy no existen
- Queda desbloqueada la Fase 2 del plan de migración

> Cuando esto esté funcionando, conviene mover este runbook a la skill `frc-cicd`, junto al resto del conocimiento de infraestructura.
