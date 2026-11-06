import { Link, Route, Routes } from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import Home from './pages/Home';
import Services from './pages/Services';
import { RealisationDetail, Realisations } from './pages/Realisations';
import APropos from './pages/APropos';
import Contact from './pages/Contact';
import Devis from './pages/Devis';
import Reservation from './pages/Reservation';
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLeads from './pages/admin/AdminLeads';
import AdminBookings from './pages/admin/AdminBookings';
import AdminServices from './pages/admin/AdminServices';
import AdminProjects from './pages/admin/AdminProjects';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAI from './pages/admin/AdminAI';
import AdminEmails from './pages/admin/AdminEmails';
import AdminNewsletter from './pages/admin/AdminNewsletter';
import AdminAutomations from './pages/admin/AdminAutomations';

function NotFound() {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">404</p>
        <h1 className="mt-3 text-3xl font-black">Cette page n’existe pas</h1>
        <p className="mt-3 text-sm text-ink/60">Le lien est peut-être ancien, ou l’adresse mal saisie.</p>
        <Link to="/" className="btn-primary mt-7">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/realisations" element={<Realisations />} />
        <Route path="/realisations/:slug" element={<RealisationDetail />} />
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/devis" element={<Devis />} />
        <Route path="/reservation" element={<Reservation />} />
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
        <Route path="ia" element={<AdminAI />} />
        <Route path="emails" element={<AdminEmails />} />
        <Route path="newsletter" element={<AdminNewsletter />} />
        <Route path="automatisations" element={<AdminAutomations />} />
      </Route>
    </Routes>
  );
}
