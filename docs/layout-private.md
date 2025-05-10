🖼 Wireframe ASCII
css
Copia
Modifica
┌───────────────────────────────────────────────────────────────────┐
│ Topbar │
│ ┌────────┐ ┌──────────────────────────────┐ ┌─────────────┐ │
│ │ Logo │ │ Breadcrumb / Page Title │ │ User ▾ │ │
│ └────────┘ └──────────────────────────────┘ └─────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│┌──────────┐┌────────────────────────────────────────────────────┐│
││ Sidebar ││ Content ││
││ ┌──────┐ ││ ┌────────────────────────────────────────────┐ ││
││ │🏠 Dash│ ││ │ • Panoramica stampante │ ││
││ ├──────┤ ││ │ • Stato temperatura / avanzamento │ ││
││ │🖨️ Queue│││ └────────────────────────────────────────────┘ ││
││ ├──────┤ ││ ┌────────────────────────────────────────────┐ ││
││ │📦Models│││ │ • Lista modelli caricati │ ││
││ ├──────┤ ││ └────────────────────────────────────────────┘ ││
││ │📊 Stats│││ … ││
││ └──────┘ ││ ││
│└──────────┘└────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────┘
📘 Documentazione UI – Dashboard 3DP

1. Layout Principale
   Container Root (AppPrivateLayout):

display: flex; height: 100vh; width: 100vw;

Figlio 1: Sidebar (larghezza fissa, scroll interno)

Figlio 2: Main (flex-1; display: flex; flex-direction: column;)

Topbar (altezza fissa)

Content Area (scroll, padding)

2. Sidebar
   Funzione: navigazione tra sezioni protette

Struttura: elenco verticale di voci (icona + label)

Voci tipiche:

Dashboard (/dashboard)

Queue (/queue)

Models (/models)

Stats (/stats)

Logs (/logs)

Settings (/settings)

Users (/users) [solo Admin]

Stato attivo: evidenzia con colore di sfondo o bordo

Responsive:

lg: sempre visibile

md/sm: collassabile in hamburger drawer

3. Topbar
   Funzione: informazioni globali e azioni utente

Contenuti:

Logo/brand (opzionale)

Titolo o breadcrumb dinamico

Stato stampante (es. cerchio verde/rosso)

Toggle tema (light/dark)

Avatar e nome utente + menu (Profilo, Logout)

Layout: flex justify-between items-center px-4 h-14 border-b

4. Content Area
   Scopo: render di pagine via <router-outlet>

Styling:

sfondo chiaro/scuro (bg-gray-100 / bg-gray-900)

padding generico p-4

scroll gestionato su asse Y (overflow-y-auto)

5. Sezioni e Route
   Route Componente Descrizione
   /dashboard DashboardPage Panoramica stato e statistiche immediate
   /queue QueuePage Lista e gestione lavori di stampa
   /models ModelsPage Gestione file STL, slicing, anteprime 3D
   /stats StatsPage Grafici e metriche (successo, tempi, usi)
   /logs LogsPage Cronologia eventi, errori, debugging
   /settings SettingsPage Configurazioni globali e profilazioni
   /users UsersPage (admin)    Gestione account, ruoli e permessi

6. Styling e Componenti
   Framework: Angular + TailwindCSS + PrimeNG + Lucide Icons

Theme: supporto light/dark (toggle + localStorage)

Grafici: PrimeNG Charts o Recharts (linee, barre, donut)

Tabella: PrimeNG Table (p-table) per liste (Queue, Logs, Users)

Form: PrimeNG Forms + Reactive Forms per Settings e Models

Icone: lucide-angular per coerenza e performance

7. UX & Accessibilità
   Loading skeletons nelle tabelle e nei grafici

Tooltips sulle icone della sidebar

Modali di conferma per azioni distruttive (es. cancel print)

Shortcut (es. g + d → Dashboard) e navigazione da tastiera

Feedback in tempo reale (toasts) su operazioni async

8. Modularizzazione (Nx)
   cpp
   Copia
   Modifica
   libs/
   └── ui/
   └── layout/
   ├── private-layout/
   ├── sidebar/
   └── topbar/
   apps/
   └── 3dp-frontend/
   └── src/
   └── app/
   ├── core/
   ├── pages/ // Dashboard, Queue, ecc.
   └── app.routes.ts
   Con questa struttura avrai una base solida, scalabile e dal look moderno.
   Fammi sapere se vuoi partire con i componenti (Sidebar, Topbar, Layout) o approfondire qualche sezione!