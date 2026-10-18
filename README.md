# KAA Associates – Loan Enquiry Website

Public website (`/`) + enquiry forms for 13 loan types + password-protected admin (`/admin`) with lead list, search/filter, status tracking, notes and CSV export.

## Run
```
npm install
ADMIN_PASSWORD='choose-a-strong-password' npm start      # optional: ADMIN_USER, PORT, DB_PATH
```
Site: http://localhost:3000   Admin: http://localhost:3000/admin (user `admin`)

## Deploy
Any Node 18+ host (VPS, Render, Railway…). Put it behind HTTPS (required – the admin login and customer data travel over it) and keep `leads.db` on a persistent disk (set `DB_PATH`). Back up `leads.db` regularly.
Edit your phone/email in `public/index.html` (`CONTACT`). Loan types/fields are in the `L` array in the same file.
