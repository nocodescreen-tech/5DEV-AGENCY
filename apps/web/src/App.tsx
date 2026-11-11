import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import Home from './pages/Home';

/* Le site public est chargé tout de suite ; la console est découpée en morceaux
   séparés pour ne pas alourdir la première visite (mobile / réseau limité). */
const Services = lazy(() => import('./pages/Services'));
const Realisations = lazy(() => import('./pages/Realisations').then((m) => ({ default: m.Realisations })));
const RealisationDetail = lazy(() => import('./pages/Realisations').then((m) => ({ default: m.RealisationDetail })));
const APropos = lazy(() => import('./pages/APropos'));
const Contact = lazy(() => import('./pages/Contact'));
const Devis = lazy(() => import('./pages/Devis'));
const Reservation = lazy(() => import('./pages/Reservation'));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminLeads = lazy(() => import('./pages/admin/AdminLeads'));
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'));
const AdminServices = lazy(() => import('./pages/admin/AdminServices'));
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminAI = lazy(() => import('./pages/admin/AdminAI'));
const AdminAIChat = lazy(() => import('./pages/admin/AdminAIChat'));
const AdminAIModels = lazy(() => import('./pages/admin/AdminAIModels'));
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'));
const AdminPlanning = lazy(() => import('./pages/admin/AdminPlanning'));
const AdminTemplates = lazy(() => import('./pages/admin/AdminTemplates'));
const AdminEmails = lazy(() => import('./pages/admin/AdminEmails'));
const AdminNewsletter = lazy(() => import('./pages/admin/AdminNewsletter'));
const AdminAutomations = lazy(() => import('./pages/admin/AdminAutomations'));
const AdminGitHub = lazy(() => import('./pages/admin/AdminGitHub'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminSecrets = lazy(() => import('./pages/admin/AdminSecrets'));
const AdminDev = lazy(() => import('./pages/admin/AdminDev'));
const AdminMarket = lazy(() => import('./pages/admin/AdminMarket'));
const AdminWorkspace = lazy(() => import('./pages/admin/AdminWorkspace'));
const AdminWorkspaceProjects = lazy(() => import('./pages/admin/AdminWorkspaceProjects'));
const AdminClients = lazy(() => import('./pages/admin/AdminClients'));
const AdminProjectDetail = lazy(() => import('./pages/admin/AdminProjectDetail'));
const AdminTasks = lazy(() => import('./pages/admin/AdminTasks'));
const AdminTime = lazy(() => import('./pages/admin/AdminTime'));

function Loading() {
  return (
    <div className="mx-auto max-w-[1240px] px-5 py-20" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 animate-pulse rounded bg-ink/10" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-ink/[0.06]" />
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col items-start px-5 py-24">
      <p className="eyebrow text-brand">Erreur 404</p>
      <h1 className="display-2 mt-3">Cette page n’existe pas.</h1>
      <p className="lead mt-3 max-w-[46ch]">
        Le lien est peut-être ancien, ou l’adresse contient une faute. Les pages ci-dessous sont,
        elles, bien réelles.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link to="/" className="btn-primary">
          Retour à l’accueil
        </Link>
        <Link to="/services" className="btn-ghost">
          Voir les services
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="services" element={<Services />} />
            <Route path="realisations" element={<Realisations />} />
            <Route path="realisations/:slug" element={<RealisationDetail />} />
            <Route path="a-propos" element={<APropos />} />
            <Route path="contact" element={<Contact />} />
            <Route path="devis" element={<Devis />} />
            <Route path="reservation" element={<Reservation />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="/admin/connexion" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="demandes" element={<AdminLeads />} />
            <Route path="reservations" element={<AdminBookings />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="realisations" element={<AdminProjects />} />
            <Route path="reglages" element={<AdminSettings />} />
            <Route path="profil" element={<AdminProfile />} />
            <Route path="ia" element={<AdminAI />} />
            <Route path="ia/chat" element={<AdminAIChat />} />
            <Route path="ia/modeles" element={<AdminAIModels />} />
            <Route path="emails" element={<AdminEmails />} />
            <Route path="newsletter" element={<AdminNewsletter />} />
            <Route path="automatisations" element={<AdminAutomations />} />
            <Route path="analytique" element={<AdminAnalytics />} />
            <Route path="utilisateurs" element={<AdminUsers />} />
            <Route path="cles" element={<AdminSecrets />} />
            <Route path="dev" element={<AdminDev />} />
            <Route path="marche" element={<AdminMarket />} />
            <Route path="github" element={<AdminGitHub />} />
            <Route path="workspace" element={<AdminWorkspace />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="projets" element={<AdminWorkspaceProjects />} />
            <Route path="projets/:id" element={<AdminProjectDetail />} />
            <Route path="taches" element={<AdminTasks />} />
            <Route path="temps" element={<AdminTime />} />
            <Route path="planning" element={<AdminPlanning />} />
            <Route path="modeles" element={<AdminTemplates />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
}
