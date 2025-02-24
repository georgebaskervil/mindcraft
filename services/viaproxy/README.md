# Viaproxy Service

Use this service to connect your bot to unsupported Minecraft server versions.

Run:

```bash
docker-compose --profile viaproxy up
```

After the first start, it will create the config file `services/viaproxy/viaproxy.yml`.

Edit this file to change your desired target `target-address`, then update your `settings.js` with the following `host` and `port` for the viaproxy endpoint:

```javascript
    "host": "host.docker.internal",
    "port": 25568,
```

This easily works with "offline" servers.

Connecting to "online" servers via viaproxy involves more effort: see `auth-method` in `services/viaproxy/viaproxy.yml` (TODO describe)
