import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DarkModeProvider } from './context/DarkModeContext';
import SplashScreen from './components/SplashScreen';

const Login         = lazy(() => import('./pages/Login'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Roadmaps      = lazy(() => import('./pages/Roadmaps'));
const RoadmapDetail  = lazy(() => import('./pages/RoadmapDetail'));
const Resources     = lazy(() => import('./pages/Resources'));
const Hackathons    = lazy(() => import('./pages/Hackathons'));
const About         = lazy(() => import('./pages/About'));
const Profile       = lazy(() => import('./pages/Profile'));
const Bookmarks     = lazy(() => import('./pages/Bookmarks'));
const PasswordReset  = lazy(() => import('./pages/PasswordReset'));
const AdminPanel    = lazy(() => import('./pages/AdminPanel'));
const AllUsers      = lazy(() => import('./pages/AllUsers'));
const ClubDetail    = lazy(() => import('./pages/ClubDetail'));
const NotFound      = lazy(() => import('./pages/NotFound'));
const NewsDetail    = lazy(() => import('./pages/NewsDetail'));
const JobBoard = lazy(()=>import('./pages/JobBoard'));


import Layout from './components/Layout';
import Toast from './components/Toast';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { LazyMotion, domAnimation } from 'framer-motion';

// Simple spinner — used for page-to-page lazy chunk loading
function PageSpinner() {
    return (
        <div className="h-screen flex items-center justify-center bg-[#050505]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#7c3aed]" />
        </div>
    );
}

// Splash timeout — show skip button after 3s, force redirect after 7s
function SplashWithTimeout() {
    const [showSkip, setShowSkip] = useState(false);
    const [forceRedirect, setForceRedirect] = useState(false);

    useEffect(() => {
        const skipTimer = setTimeout(() => setShowSkip(true), 3000);
        const redirectTimer = setTimeout(() => setForceRedirect(true), 7000);
        return () => { clearTimeout(skipTimer); clearTimeout(redirectTimer); };
    }, []);

    if (forceRedirect) return <Navigate to="/login" replace />;

    return (
        <div className="relative">
            <SplashScreen />
            {showSkip && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
                    <button
                        onClick={() => setForceRedirect(true)}
                        className="px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/70 text-sm font-bold hover:bg-white/20 transition-all"
                    >
                        Server waking up — Skip to Login
                    </button>
                </div>
            )}
        </div>
    );
}

// ProtectedRoute with Suspense to prevent flash of unstyled content during lazy load
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <SplashWithTimeout />;
    if (!user) return <Navigate to="/login" replace />;
    return <Layout>{children}</Layout>;
}

function AdminRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <SplashWithTimeout />;
    if (!user || user.role !== 'admin') return <Navigate to={user ? "/" : "/login"} replace />;
    return <Layout>{children}</Layout>;
}

function AppContent() {
    const { user } = useAuth();
    return (
        <ErrorBoundary>
            <LazyMotion features={domAnimation}>
                <Suspense fallback={<PageSpinner />}>
                    <Routes>
                        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
                        {/* FIX #8: Deep-link for sign up and email verification */}
                        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Login initialStep="signup" />} />
                        <Route path="/verify-email" element={user ? <Navigate to="/" replace /> : <Login initialStep="verify-otp" />} />
                        <Route path="/password-reset" element={<PasswordReset />} />
                        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        <Route path="/roadmaps" element={<ProtectedRoute><Roadmaps /></ProtectedRoute>} />
                        <Route path="/roadmaps/:id" element={<ProtectedRoute><RoadmapDetail /></ProtectedRoute>} />
                        <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
                        <Route path="/hackathons" element={<ProtectedRoute><Hackathons /></ProtectedRoute>} />
                        <Route path="/bookmarks" element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
                        <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
                        <Route path="/news/:id" element={<ProtectedRoute><NewsDetail /></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><Profile user={user} /></ProtectedRoute>} />
                        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
                        <Route path="/admin/users" element={<AdminRoute><AllUsers /></AdminRoute>} />
                        <Route path="/clubs/:slug" element={<Layout><ClubDetail /></Layout>} />
                        <Route path="/jobs" element={<JobBoard />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            <Toast />
        </LazyMotion>
    </ErrorBoundary>
    );
}

export default function App() {
    return (
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
            <AuthProvider>
                <DarkModeProvider>
                    <ToastProvider>
                        <AppContent />
                    </ToastProvider>
                </DarkModeProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
