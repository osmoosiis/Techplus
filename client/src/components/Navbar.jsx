import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import NewsSidebar from './NewsSidebar';
// import ClubsPanel from './ClubsPanel';

/* SVG Icons */
const Icons = {
    Home: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg>,
    Roadmaps: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 17l4-8 4 4 4-6 4 6" /><circle cx="3" cy="17" r="1.5" /><circle cx="7" cy="9" r="1.5" /><circle cx="11" cy="13" r="1.5" /><circle cx="15" cy="7" r="1.5" /><circle cx="21" cy="13" r="1.5" /></svg>,
    Hackathons: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    Jobs: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
    Resources: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
    About: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="8" /><path d="M10 12h2v4h2" /></svg>,
    Profile: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>,
    Bookmarks: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>,
    Admin: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>,
    Logout: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
    Menu: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
    Close: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    Fire: () => (
        <m.svg 
            width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            initial="initial" animate="animate"
        >
            <m.path 
                d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.291 1-3a2.5 2.5 0 0 0 2.5 2.5z" 
                animate={{ 
                    scale: [1, 1.05, 1],
                    stroke: ['#a855f7', '#d8b4fe', '#a855f7'],
                }}
                transition={{ repeat: Infinity, duration: 2 }}
            />
        </m.svg>
    ),
    Flame: () => <svg width="20" height="20" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2c0 1.66-1.34 3-3 3S6 3.66 6 2M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    Moon: () => <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
    Sun: () => <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
};

const BASE_NAV_ITEMS = [
    { label: 'Home', path: '/', icon: Icons.Home },
    { label: 'Roadmaps', path: '/roadmaps', icon: Icons.Roadmaps },
    { label: 'Hackathons', path: '/hackathons', icon: Icons.Hackathons },
    { label: 'Jobs', path: '/jobs', icon: Icons.Jobs },
    { label: 'Resources', path: '/resources', icon: Icons.Resources },
    { label: 'About', path: '/about', icon: Icons.About },
    { label: 'Profile', path: '/profile', icon: Icons.Profile },
];

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [newsOpen, setNewsOpen] = useState(false);
    // const [clubsOpen, setClubsOpen] = useState(false);
 
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Listen for custom events to open sidebars from other components
    useEffect(() => {
        const handleOpenNews = () => setNewsOpen(true);
        // const handleOpenClubs = () => setClubsOpen(true);

        window.addEventListener('open-news-sidebar', handleOpenNews);
        // window.addEventListener('open-clubs-panel', handleOpenClubs);

        return () => {
            window.removeEventListener('open-news-sidebar', handleOpenNews);
            // window.removeEventListener('open-clubs-panel', handleOpenClubs);
        };
    }, []);

    const navItems = useMemo(() => {
        const items = [...BASE_NAV_ITEMS];
        if (user?.role === 'admin') {
            items.push({ label: 'Admin', path: '/admin', icon: Icons.Admin });
        }
        return items;
    }, [user]);

    const displayName = user?.username || user?.name || 'Explorer';
    const profileImageSrc = user?.profileImage || user?.avatar || null;
    const DEFAULT_AVATAR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%237c3aed' rx='8'/%3E%3Ccircle cx='16' cy='12' r='5.5' fill='%23ffffff40'/%3E%3Cellipse cx='16' cy='28' rx='9' ry='7' fill='%23ffffff30'/%3E%3C/svg%3E";

    return (
        <>
            {/* ──────── DESKTOP TOP NAVBAR ──────── */}
            <header
                className="fixed top-0 left-0 right-0 z-50 h-[64px] flex items-center shadow-lg"
                style={{
                    background: 'rgba(10, 10, 12, 0.7)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    paddingLeft: 'max(24px, calc(50vw - 550px))',
                    paddingRight: 'max(24px, calc(50vw - 550px))'
                }}
            >
                <div className="w-full flex items-center justify-between">
                    {/* LEFT: Logo Section */}
                    <div className="flex items-center gap-6">
                        <Link to="/" className="flex items-center gap-2 shrink-0 group">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-black text-sm transition-transform duration-300 group-hover:scale-110"
                                style={{ background: 'white' }}
                            >
                                T+
                            </div>
                            <span className="text-xl font-black tracking-tighter text-white uppercase leading-none mt-0.5" style={{ letterSpacing: '0.05em' }}>TECHPLUS</span>
                        </Link>

                        {/* LEFT: Quick Actions (Icons) */}
                        <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-white/10">
                            <button 
                                onClick={() => setNewsOpen(true)}
                                className="p-2 rounded-xl bg-purple-500/10 text-[#a855f7] hover:bg-purple-500/20 transition-all group relative"
                                title="Top Trading News"
                            >
                                <Icons.Fire />
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#a855f7] rounded-full animate-ping" />
                            </button>

    

                        </div>
                    </div>

                    {/* RIGHT: Nav & Profile Section */}
                    <div className="flex items-center gap-10">
                        {/* Nav Items - Icon to Text Expand */}
                        <nav className="hidden md:flex items-center h-[64px] gap-2">
                            {navItems.map(({ label, path, icon: Icon }) => {
                                const isActive = path === '/'
                                    ? location.pathname === '/'
                                    : location.pathname.startsWith(path);
                                return (
                                    <Link
                                        key={path}
                                        to={path}
                                        className={`relative flex items-center gap-2 h-full px-4 text-sm font-bold tracking-tight transition-all duration-200 group ${isActive
                                            ? 'text-white'
                                            : 'text-white/40 hover:text-[#a855f7]'
                                            }`}
                                    >
                                        <Icon />
                                        {isActive && (
                                            <m.span
                                                initial={{ opacity: 0, width: 0 }}
                                                animate={{ opacity: 1, width: 'auto' }}
                                                className="whitespace-nowrap overflow-hidden"
                                            >
                                                {label}
                                            </m.span>
                                        )}
                                        {/* Active Underline Effect */}
                                        {isActive && (
                                            <m.div
                                                layoutId="nav-underline-active"
                                                className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-[#a855f7]"
                                                style={{ boxShadow: '0 -2px 10px rgba(168,85,247,0.4)', borderRadius: '2px 2px 0 0' }}
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* User Actions */}
                        <div className="flex items-center gap-3 sm:gap-6">
                            {/* Mobile-only About/Logout in top bar */}
                            <div className="flex md:hidden items-center gap-1">
                                <Link
                                    to="/about"
                                    className={`p-2 rounded-xl transition-all ${location.pathname === '/about' ? 'text-white bg-white/5' : 'text-white/30'}`}
                                    title="About"
                                >
                                    <Icons.About />
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 rounded-xl text-white/30 hover:text-red-400 transition-all"
                                    title="Sign Out"
                                >
                                    <Icons.Logout />
                                </button>
                            </div>

                            <div className="hidden md:flex items-center gap-3 pl-6 border-l border-white/10 h-8">
                                <div
                                    className="w-8 h-8 rounded-xl overflow-hidden transition-transform hover:rotate-3 shadow-[0_0_15px_rgba(124,58,237,0.4)] border border-white/10 shrink-0"
                                >
                                    <img
                                        src={profileImageSrc || DEFAULT_AVATAR_SVG}
                                        alt={displayName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_SVG; }}
                                    />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="text-xs font-bold text-white leading-none">{displayName}</span>
                                    <span className="text-[10px] text-white/40 font-semibold mt-1 leading-none tracking-wide uppercase">Elite</span>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="hidden md:block p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
                                title="Sign Out"
                            >
                                <Icons.Logout />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ──────── MOBILE BOTTOM NAVIGATION ──────── */}
            <nav className="md:hidden fixed bottom-6 inset-x-4 z-[100]">
                <div className="mx-auto max-w-[400px] h-[64px] rounded-[24px] border border-white/10 bg-[#0a0a0c]/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-around px-2 relative overflow-hidden">
                    {/* Inner active marker (glow) */}
                    <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at 50% 120%, var(--accent-purple), transparent 70%)' }} />
                    
                    {navItems.filter(item => item.label !== 'About').map(({ label, path, icon: Icon }) => {
                        const isActive = location.pathname === path;
                        return (
                            <Link
                                key={path}
                                to={path}
                                className={`flex flex-col items-center justify-center gap-1 w-full h-full rounded-2xl transition-all duration-300 relative group`}
                            >
                                <div className={`transition-all duration-300 ${isActive ? 'text-[#a855f7] -translate-y-1' : 'text-white/40 group-hover:text-white/70'}`}>
                                    <Icon />
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-white opacity-100' : 'text-white/20 opacity-0 group-hover:opacity-40'}`}>
                                    {label}
                                </span>
                                
                                {isActive && (
                                    <m.div
                                        layoutId="bottom-nav-active"
                                        className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#a855f7] shadow-[0_0_10px_#a855f7]"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>
            <NewsSidebar isOpen={newsOpen} onClose={() => setNewsOpen(false)} />
           
        </>
    );
}
