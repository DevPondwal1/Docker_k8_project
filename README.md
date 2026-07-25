# Visitor Counter

A tiny Node.js/Express app that increments and returns a hit counter stored in Redis.

## Files

- `app.js` — Express server; connects to Redis at `redis-service:6379` (overridable via `REDIS_HOST` / `REDIS_PORT` env vars), serves the static frontend from `public/`, and increments a `hits` key on every request to `/api/hits`.
- `public/index.html`, `public/style.css`, `public/script.js` — simple dark-themed frontend that calls `/api/hits` on load and on button click, and displays the live count.
- `Dockerfile` — builds the app on `node:18-alpine`, exposes port `3000`.
- `docker-compose.yml` — spins up the app plus a `redis-service` container on a shared network, for local testing before deploying to Kubernetes.

## Routes

- `GET /` — the HTML frontend (from `public/index.html`)
- `GET /api/hits` — JSON endpoint, increments and returns `{ "hits": N }` (used by the frontend)
- `GET /hits` — plain-text version, handy for `curl`
- `GET /healthz` — health check, pings Redis

## Test locally with Docker Compose

From this directory:

```bash
docker compose up --build
```

This will:
1. Build the `app` image from the `Dockerfile`.
2. Start `redis-service` (official `redis:7-alpine` image).
3. Start `app`, which connects to Redis using the service name `redis-service` — the same kind of DNS name Kubernetes gives you for a Service, so the code doesn't need to change later.

Once it's up, open **http://localhost:3000/** in a browser. You'll see the counter page — it fetches `/api/hits` on load, and the "Visit again" button re-fetches (and increments) it.

Or test from the terminal:

```bash
curl http://localhost:3000/hits
# This page has been visited 1 time(s).

curl http://localhost:3000/api/hits
# {"hits":2}

curl http://localhost:3000/healthz
# ok
```

Each refresh should increment the counter, confirming the app and Redis are talking to each other correctly.

To stop and clean up:

```bash
docker compose down
```

To also wipe the Redis data volume (none is defined here by default, so a `docker compose down` already resets counts — data lives only in the container's memory unless you add a volume).

## Moving to Kubernetes (minikube)

Manifests are in the `k8s/` folder:

- `k8s/redis-deployment.yaml` + `k8s/redis-service.yaml` — runs Redis and exposes it internally as `redis-service` (matches `REDIS_HOST` in `app.js`, so no code changes needed).
- `k8s/app-deployment.yaml` + `k8s/app-service.yaml` — runs 2 replicas of the app, with readiness/liveness probes hitting `/healthz`, and exposes it outside the cluster via a `NodePort` service on port `30080`.

Steps below use PowerShell on Windows with minikube; adjust as needed for your OS/cluster.

### 0. Check your folder structure first

```powershell
cd "path\to\this\project"
dir
dir public
dir k8s
```
You need `app.js`, `Dockerfile`, `docker-compose.yml`, `package.json` at the top; `index.html`, `style.css`, `script.js` inside `public`; and 4 `.yaml` files inside `k8s`. Fix this first if anything's missing — nothing else below will work otherwise.

### 1. Start minikube

```powershell
minikube start
```

Confirm:
```powershell
minikube status
```

### 2. Point Docker at minikube's internal daemon, then build the image there

```powershell
minikube docker-env | Invoke-Expression
docker build -t visitor-counter-app:latest .
```

Confirm the image landed inside minikube:
```powershell
docker images | findstr visitor-counter-app
```

> ⚠️ Every new PowerShell window loses this Docker pointer. If you open a new terminal and need to rebuild, re-run `minikube docker-env | Invoke-Expression` first.

### 3. Apply the Kubernetes manifests

```powershell
kubectl apply -f k8s/
```
Expect 4 lines ending in `created`.

### 4. Wait for pods to be ready

```powershell
kubectl get pods
```
Run this a few times until both rows show `1/1` and `Running`. If stuck, get details:
```powershell
kubectl describe pod -l app=visitor-counter-app
kubectl logs -l app=visitor-counter-app
```

### 5. Confirm the service exists

```powershell
kubectl get svc
```
Look for `visitor-counter-app-service`.

### 6. Open the app

```powershell
minikube service visitor-counter-app-service --url
```
This opens a tunnel and prints a URL like `http://127.0.0.1:xxxxx`. Open that exact URL in your browser — **not** `localhost:3000` (that only works with Docker Compose). Keep this terminal window open the whole time; closing it kills the tunnel.

### 7. Clean up

```powershell
kubectl delete -f k8s/
minikube stop
```
