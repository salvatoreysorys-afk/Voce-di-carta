# Come mettere online "Voce di Carta" (nessun terminale richiesto)

Segui questi passaggi con calma, uno alla volta. In tutto ci vogliono circa 10 minuti.

## Passo 1 — Crea un account GitHub (gratis)
1. Vai su https://github.com e clicca "Sign up".
2. Crea l'account con la tua email.

## Passo 2 — Crea un nuovo repository
1. Una volta dentro, clicca il pulsante verde "New" (o il "+" in alto a destra → "New repository").
2. Dai un nome, ad esempio `voce-di-carta`.
3. Lascialo "Public".
4. Clicca "Create repository".

## Passo 3 — Carica i file del progetto
1. Nella pagina del repository appena creato, clicca "uploading an existing file" (o "Add file" → "Upload files").
2. Trascina dentro **tutti i file e le cartelle** che trovi nella cartella `lettore-vocale` che ti ho consegnato (compresa la cartella `app`).
3. Scorri in basso e clicca "Commit changes".

## Passo 4 — Crea un account Vercel (gratis) e collega GitHub
1. Vai su https://vercel.com e clicca "Sign Up".
2. Scegli "Continue with GitHub" e autorizza l'accesso.

## Passo 5 — Pubblica il progetto
1. Nella dashboard di Vercel, clicca "Add New..." → "Project".
2. Trova e seleziona il repository `voce-di-carta` che hai appena caricato.
3. Vercel riconosce da solo che è un progetto Next.js: non devi cambiare nessuna impostazione.
4. Clicca "Deploy" e aspetta circa un minuto.

## Passo 6 — Fatto!
Vercel ti darà un indirizzo tipo `https://voce-di-carta.vercel.app`.
Questo è il link della tua app: apribile da telefono, tablet o computer, ovunque tu sia.

---

### Se in futuro vuoi modificare qualcosa
Basta modificare i file direttamente su GitHub (matita ✏️ accanto a ogni file) e salvare:
Vercel ripubblica automaticamente l'app ogni volta che salvi una modifica.

### Nota sui costi
Sia GitHub che Vercel, in questa configurazione, restano gratuiti: nessuna carta di credito richiesta per iniziare.
