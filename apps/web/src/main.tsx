import { lazy, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './state';
import { Shell } from './layout';
import { AuthPage, Landing, VerifyPage } from './public-pages';
import { Dashboard } from './dashboard';
import { MatchesPage, ProfileEditor, StudentPage } from './profile-pages';
import { ExchangesPage } from './pages/exchanges';
import { AdminPage, NotificationsPage } from './other-pages';
import { Loading } from './ui';
import { ThemeProvider } from './theme';
import '@fontsource-variable/inter';
import './styles.css';
const NewExchange = lazy(() => import('./pages/new-exchange').then(module => ({ default: module.NewExchange })));
const ExchangeDetail = lazy(() => import('./pages/exchange-detail').then(module => ({ default: module.ExchangeDetail })));
const ReviewsPage = lazy(() => import('./pages/reviews').then(module => ({ default: module.ReviewsPage })));
const SettingsPage = lazy(() => import('./pages/settings').then(module => ({ default: module.SettingsPage })));
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
function App() {
  return <ThemeProvider><BrowserRouter><ScrollToTop/><AuthProvider><a href="#main" className="skip-link">Skip to content</a><Suspense fallback={<div className="public-container py-12"><Loading/></div>}><Routes><Route path="/" element={<Landing/>}/><Route path="/register" element={<AuthPage register/>}/><Route path="/login" element={<AuthPage/>}/><Route path="/verify" element={<VerifyPage/>}/><Route element={<Shell/>}><Route path="/dashboard" element={<Dashboard/>}/><Route path="/profile" element={<ProfileEditor/>}/><Route path="/skills" element={<ProfileEditor skillsOnly/>}/><Route path="/matches" element={<MatchesPage/>}/><Route path="/students/:id" element={<StudentPage/>}/><Route path="/exchanges" element={<ExchangesPage/>}/><Route path="/exchanges/new" element={<NewExchange/>}/><Route path="/exchanges/:id" element={<ExchangeDetail/>}/><Route path="/notifications" element={<NotificationsPage/>}/><Route path="/reviews" element={<ReviewsPage/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="/admin" element={<AdminPage/>}/></Route><Route path="*" element={<main id="main" className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-5 text-center"><h1 className="text-4xl font-bold tracking-tight">A little lost?</h1><p className="text-sm text-muted">This page doesn’t exist.</p><Link className="btn btn-primary" to="/">Back home</Link></main>}/></Routes></Suspense></AuthProvider></BrowserRouter></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<App/>);
