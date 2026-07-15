# Hostly Admin Frontend

React/Vite Admin-Webseite fuer die Hostly-App. Die Seite nutzt die Django-API aus dem Repository `../hostly/backend` und ist fuer administrative Datenpflege gedacht.

Enthalten sind unter anderem Moderation, Nutzer- und Eventdetails, Verifizierungen, Safety Operations fuer Safe Walk und Meeting Safety, Infrastruktur-Health, Audit-Protokolle sowie ein optionales aggregiertes Firebase/GA4-Produkt-Dashboard.

## Login

- Admin-Login laeuft ueber `POST /api/admin/login/`.
- Zugelassen sind nur Datenbank-Accounts mit `is_superuser=True`.
- Normale App-User und reine `is_staff`-User duerfen die Admin-Webseite nicht nutzen.
- Alternativ steht ein gehaerteter Apple-Web-Login mit einmaligem `state` und `nonce` zur Verfuegung.
- Ein separater Passkey-Login ist nicht notwendig; Apple nutzt auf unterstuetzten Geraeten Face ID oder Touch ID.

## Konfiguration

`.env` muss auf das Backend zeigen:

```env
VITE_API_URL=http://localhost:8000
```

In Produktion muss `VITE_API_URL` auf die Railway/API-Domain des Hostly-Backends zeigen. Das Backend muss die Admin-Frontend-Origin in `CORS_ALLOWED_ORIGINS` erlauben.

Apple Login wird ausschliesslich im Backend ueber `APPLE_WEB_CLIENT_ID` (Apple Services ID), `ADMIN_FRONTEND_URL=https://admin.meet-hostly.com` und `APPLE_ADMIN_REDIRECT_URI=https://admin.meet-hostly.com/login` eingerichtet. Die Redirect-URL muss im Apple Developer Portal exakt registriert sein. `localhost` kann fuer Apple Login nicht verwendet werden.

Fuer das optionale Produkt-Analytics-Dashboard werden nur im Backend `GA4_PROPERTY_ID` und `GA4_SERVICE_ACCOUNT_JSON` konfiguriert. Service-Account-Daten duerfen nicht als `VITE_*`-Variable im Frontend hinterlegt werden.

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
