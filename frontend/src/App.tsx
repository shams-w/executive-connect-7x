
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  PartyPopper,
  MessageSquareText,
  History,
  TriangleAlert,
  Settings,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Languages,
  SlidersHorizontal,
  UserCog,
  KeyRound
} from 'lucide-react';

import { api, setToken, hasToken, onAuthChange } from './lib/api';
import { useI18n, roleLabel } from './lib/i18n';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import ImportEmployees from './pages/ImportEmployees';
import Celebrations from './pages/Celebrations';
import Messages from './pages/Messages';
import Templates from './pages/Templates';
import WhatsApp from './pages/WhatsApp';
import Audit from './pages/Audit';
import AdminSettings from './pages/AdminSettings';
import UsersPage from './pages/Users';
import ChangePassword from './pages/ChangePassword';

export type Me = {
  id: string;
  username: string;
  displayName: string;
  role:
    | 'SUPER_ADMIN'
    | 'HR_ADMIN'
    | 'COMMUNICATIONS_ADMIN'
    | 'VIEWER';
  mustChangePassword: boolean;
};

const nav = [
  ['/dashboard', 'Dashboard', LayoutDashboard, null],
  ['/employees', 'Employees', Users, null],
  ['/employees/import', 'Excel Imports', FileSpreadsheet, null],
  ['/celebrations', 'Celebrations', PartyPopper, null],
  ['/messages/pending', 'Scheduled Messages', MessageSquareText, null],
  ['/messages/history', 'Delivery History', History, null],
  ['/messages/failed', 'Failed Messages', TriangleAlert, null],
  ['/templates', 'Message Templates', MessageSquareText, null],
  ['/whatsapp', 'WhatsApp Configuration', Settings, null],
  ['/users', 'Users', UserCog, 'SUPER_ADMIN'],
  ['/audit', 'Audit Logs', ShieldCheck, 'SUPER_ADMIN'],
  ['/settings', 'Admin Settings', SlidersHorizontal, 'SUPER_ADMIN']
] as const;

function AlertBanner() {
  const { t, fmtDateTime } = useI18n();
  const go = useNavigate();

  const { data } = useQuery({
    queryKey: ['alerts'],
    queryFn: () =>
      api.get('/dashboard/alerts').then(r => r.data),
    refetchInterval: 60_000
  });

  if (!data || (!data.failedLast7 && !data.lastAlert)) {
    return null;
  }

  const a = data.lastAlert;

  return (
    <div className="mb-4 rounded-xl border border-red-300 bg-red-50 text-red-900 px-4 py-3 text-sm flex flex-wrap gap-3 justify-between items-center">
      <div>
        {a && (
          <div>
            <b>{t(a.subject)}</b>{' '}
            <span className="text-red-700">
              · {fmtDateTime(a.at)}
            </span>
          </div>
        )}

        {data.failedLast7 > 0 && (
          <div>
            {t('{n} message(s) failed in the last 7 days.', {
              n: data.failedLast7
            })}
          </div>
        )}

        {!data.emailConfigured && (
          <div className="text-xs text-red-700 mt-1">
            {t(
              'Email alerts are not configured, so this banner is the only notification.'
            )}
          </div>
        )}
      </div>

      <button
        className="btn"
        onClick={() => go('/messages/failed')}
      >
        {t('View failed messages')}
      </button>
    </div>
  );
}

function ModeBanner() {
  const { t } = useI18n();

  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () =>
      api.get('/health').then(r => r.data),
    staleTime: 300_000
  });

  if (!data || data.mode === 'META_PRODUCTION' || data.mode === 'DIALOG360_PRODUCTION') {
    return null;
  }

  const mode = data.mode;

  let message = '';

  if (mode === 'MOCK') {
    message =
      'MOCK mode sends no real WhatsApp messages; delivery is simulated.';
  } else if (mode === 'META_TEST') {
    message =
      'Meta test mode only sends to approved test numbers.';
  } else if (mode === 'DIALOG360_TEST') {
    message =
      '360dialog test mode only sends to approved test numbers.';
  } else {
    message =
      `WhatsApp is running in ${String(mode)} mode.`;
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
      <b>{t('Test mode:')}</b>{' '}
      {t(message)}
    </div>
  );
}

function Shell({ me }: { me: Me }) {
  const loc = useLocation();
  const go = useNavigate();

  const { t, lang, setLang } = useI18n();

  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('ec.theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);

    try {
      localStorage.setItem(
        'ec.theme',
        dark ? 'dark' : 'light'
      );
    } catch {
      // Ignore unavailable local storage.
    }
  }, [dark]);

  const qc = useQueryClient();

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setToken(null);
      qc.clear();
      go('/login');
    }
  }

  const items = nav.filter(
    ([, , , role]) => !role || role === me.role
  );

  const isActive = (p: string) =>
    loc.pathname === p ||
    (
      loc.pathname.startsWith(p + '/') &&
      !items.some(
        ([q]) =>
          q !== p &&
          q.startsWith(p + '/') &&
          loc.pathname.startsWith(q)
      )
    );

  return (
    <div className="min-h-screen">
      <aside className="w-72 bg-slate-950 text-white p-5 fixed inset-y-0 start-0 overflow-y-auto">
        <div className="mb-8">
          <div className="text-xl font-bold">
            EXECUTIVE CONNECT
          </div>

          <div className="text-xs text-slate-400 mt-1">
            {t('Employee Celebration Platform')}
          </div>
        </div>

        <nav className="space-y-1">
          {items.map(([p, l, I]) => (
            <button
              key={p}
              onClick={() => go(p)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-start ${
                isActive(p)
                  ? 'bg-blue-600'
                  : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <I size={17} />
              {t(l)}
            </button>
          ))}
        </nav>

        <div className="mt-8 pt-5 border-t border-slate-800 space-y-2">
          <div className="px-3 pb-2">
            <div className="text-sm font-semibold">
              {me.displayName}
            </div>

            <div className="text-xs text-slate-400">
              {me.username} · {roleLabel(t, me.role)}
            </div>
          </div>

          <button
            onClick={() => go('/account/password')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300"
          >
            <KeyRound size={17} />
            {t('Change password')}
          </button>

          <button
            onClick={() =>
              setLang(lang === 'ar' ? 'en' : 'ar')
            }
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300"
          >
            <Languages size={17} />
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>

          <button
            onClick={() => setDark(!dark)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300"
          >
            {dark ? (
              <Sun size={17} />
            ) : (
              <Moon size={17} />
            )}

            {t('Theme')}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300"
          >
            <LogOut size={17} />
            {t('Logout')}
          </button>
        </div>
      </aside>

      <main className="ms-72 p-8">
        <ModeBanner />
        <AlertBanner />

        <Routes>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/employees"
            element={<Employees />}
          />

          <Route
            path="/employees/import"
            element={<ImportEmployees />}
          />

          <Route
            path="/celebrations/*"
            element={<Celebrations />}
          />

          <Route
            path="/messages/*"
            element={<Messages />}
          />

          <Route
            path="/templates"
            element={<Templates />}
          />

          <Route
            path="/whatsapp"
            element={<WhatsApp />}
          />

          <Route
            path="/account/password"
            element={<ChangePassword />}
          />

          {me.role === 'SUPER_ADMIN' && (
            <Route
              path="/users"
              element={<UsersPage me={me} />}
            />
          )}

          {me.role === 'SUPER_ADMIN' && (
            <Route
              path="/settings"
              element={<AdminSettings />}
            />
          )}

          {me.role === 'SUPER_ADMIN' && (
            <Route
              path="/audit"
              element={<Audit />}
            />
          )}

          <Route
            path="*"
            element={
              <Navigate to="/dashboard" replace />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function Authenticated() {
  const { t } = useI18n();

  const { data: me, isLoading } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () =>
      api.get('/auth/me').then(r => r.data)
  });

  if (isLoading || !me) {
    return (
      <div className="min-h-screen grid place-items-center muted">
        {t('Loading…')}
      </div>
    );
  }

  if (me.mustChangePassword) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-md">
          <ChangePassword forced />
        </div>
      </div>
    );
  }

  return <Shell me={me} />;
}

export default function App() {
  const { t } = useI18n();

  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(hasToken());

  useEffect(() => {
    const off = onAuthChange(setLoggedIn);

    api
      .post('/auth/refresh')
      .then(r => setToken(r.data.accessToken))
      .catch(() => setToken(null))
      .finally(() => setReady(true));

    return () => {
      off();
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center muted">
        {t('Loading Executive Connect…')}
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loggedIn
            ? <Navigate to="/dashboard" replace />
            : <Login />
        }
      />

      <Route
        path="/*"
        element={
          loggedIn
            ? <Authenticated />
            : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}
