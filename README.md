# Hostly Admin Frontend

React/Vite Admin-Webseite fuer die Hostly-App. Die Seite nutzt die Django-API aus dem Repository `../hostly/backend` und ist fuer administrative Datenpflege gedacht.

## Login

- Admin-Login laeuft ueber `POST /api/admin/login/`.
- Zugelassen sind nur Datenbank-Accounts mit `is_superuser=True`.
- Normale App-User und reine `is_staff`-User duerfen die Admin-Webseite nicht nutzen.
- Apple-Login und passwortlose Apple-Setup-Flows gehoeren nicht zur Admin-Webseite.

## Konfiguration

`.env` muss auf das Backend zeigen:

```env
VITE_API_URL=http://localhost:8000
```

In Produktion muss `VITE_API_URL` auf die Railway/API-Domain des Hostly-Backends zeigen. Das Backend muss die Admin-Frontend-Origin in `CORS_ALLOWED_ORIGINS` erlauben.

## Entwicklung

```bash
npm install
npm run dev
```

## Pruefung

```bash
npm run build
npm run lint
```
