import { type ReactNode, useEffect, useState } from 'react';
import { ApiError, api, getAdminToken, setAdminToken } from './api/client.ts';
import type { Me, Review } from './api/types.ts';
import {
  IconAlert,
  IconBox,
  IconClipboard,
  IconFeed,
  IconGauge,
  IconHistory,
  IconLink,
  IconLogout,
  IconMenu,
  IconMoon,
  IconShield,
  IconSun,
  IconTag,
  IconUsers,
} from './components/icons.tsx';
import { useResource } from './lib/useResource.ts';
import { AdminsPage } from './pages/AdminsPage.tsx';
import { AuditPage } from './pages/AuditPage.tsx';
import { BrandsPage } from './pages/BrandsPage.tsx';
import { CrawlRunsPage } from './pages/CrawlRunsPage.tsx';
import { MappingsPage } from './pages/MappingsPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { ProductsPage } from './pages/ProductsPage.tsx';
import { ReviewsPage } from './pages/ReviewsPage.tsx';
import { SourcesPage } from './pages/SourcesPage.tsx';

type Role = Me['role'];

interface NavItem {
  path: string;
  label: string;
  minRole: Role;
  icon: (p: { size?: number }) => ReactNode;
  /// Hiển thị badge số (vd số review chờ).
  badgeKey?: 'reviews';
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: 'Tổng quan',
    items: [{ path: 'overview', label: 'Bảng điều khiển', minRole: 'viewer', icon: IconGauge }],
  },
  {
    title: 'Danh mục',
    items: [
      { path: 'brands', label: 'Thương hiệu', minRole: 'viewer', icon: IconTag },
      { path: 'products', label: 'Sản phẩm', minRole: 'viewer', icon: IconBox },
    ],
  },
  {
    title: 'Dữ liệu & nguồn',
    items: [
      { path: 'sources', label: 'Nguồn dữ liệu', minRole: 'viewer', icon: IconFeed },
      { path: 'mappings', label: 'Gán nhãn', minRole: 'viewer', icon: IconLink },
      { path: 'crawl-runs', label: 'Nhật ký crawl', minRole: 'viewer', icon: IconHistory },
    ],
  },
  {
    title: 'Kiểm duyệt',
    items: [
      {
        path: 'reviews',
        label: 'Duyệt giá',
        minRole: 'viewer',
        icon: IconAlert,
        badgeKey: 'reviews',
      },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { path: 'admins', label: 'Quản trị viên', minRole: 'owner', icon: IconUsers },
      { path: 'audit', label: 'Audit log', minRole: 'owner', icon: IconClipboard },
    ],
  },
];

const RANK = { viewer: 1, editor: 2, owner: 3 } as const;
const ALL_ITEMS = NAV.flatMap((g) => g.items);

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || 'overview');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || 'overview');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => localStorage.getItem('admin_theme') ?? 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('admin_theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export function App() {
  const route = useHashRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setNeedLogin(false);
    api
      .get<Me>('/admin/v1/me')
      .then((m) => !cancelled && setMe(m))
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setNeedLogin(true);
        else setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (needLogin) return <TokenGate onSubmit={() => setAttempt((a) => a + 1)} />;
  if (error)
    return (
      <div className="gate">
        <div className="card">
          <h2>Không truy cập được</h2>
          <p className="error">{error}</p>
        </div>
      </div>
    );
  if (!me) return <Spinner />;

  return <Shell me={me} route={route} onLogout={() => setAttempt((a) => a + 1)} />;
}

function Shell({ me, route, onLogout }: { me: Me; route: string; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('admin_collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();

  // Badge số review chờ duyệt — hiển thị cạnh mục "Duyệt giá".
  const reviews = useResource<Review[]>('/admin/v1/reviews?status=pending');
  const pendingReviews = reviews.data?.length ?? 0;

  const canSee = (it: NavItem) => RANK[me.role] >= RANK[it.minRole];
  const current = ALL_ITEMS.find((n) => n.path === route && canSee(n)) ?? ALL_ITEMS[0]!;
  const canEdit = RANK[me.role] >= RANK.editor;

  function toggleCollapse() {
    setCollapsed((c) => {
      localStorage.setItem('admin_collapsed', c ? '0' : '1');
      return !c;
    });
  }

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
      {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo" aria-hidden>
            <IconGauge size={18} />
          </span>
          <span className="sidebar-title">
            Giá Vàng
            <small>Trang quản trị</small>
          </span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((group) => {
            const items = group.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="nav-section-label">{group.title}</div>
                {items.map((it) => {
                  const Icon = it.icon;
                  const badge = it.badgeKey === 'reviews' && pendingReviews > 0 ? pendingReviews : null;
                  return (
                    <a
                      key={it.path}
                      href={`#${it.path}`}
                      className={`nav-link ${it.path === current.path ? 'active' : ''}`}
                      data-label={it.label}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="nav-icon" aria-hidden>
                        <Icon size={18} />
                      </span>
                      <span>{it.label}</span>
                      {badge != null && <span className="nav-badge">{badge}</span>}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-avatar">{me.email.charAt(0)}</span>
            <span className="sidebar-user-info">
              <span className="email">{me.email}</span>
              <span className="role">Vai trò: {me.role}</span>
            </span>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <button
          className="btn icon ghost menu-toggle"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Mở menu"
        >
          <IconMenu size={18} />
        </button>
        <button
          className="btn icon ghost"
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          title="Thu gọn / mở rộng menu"
          style={{ display: 'none' }}
        />
        <div className="topbar-crumb">
          Quản trị <span aria-hidden>/</span> <strong>{current.label}</strong>
        </div>
        <span className="topbar-spacer" />
        <button
          className="btn icon ghost"
          onClick={toggleCollapse}
          aria-label="Thu gọn menu"
          title="Thu gọn / mở rộng menu"
        >
          <IconMenu size={18} />
        </button>
        <button
          className="btn icon ghost"
          onClick={toggleTheme}
          aria-label="Đổi giao diện sáng/tối"
          title="Sáng / tối"
        >
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
        <button
          className="btn sm ghost"
          onClick={() => {
            setAdminToken('');
            onLogout();
          }}
          title="Đăng xuất"
        >
          <IconLogout size={16} />
          <span style={{ marginLeft: 4 }}>Đăng xuất</span>
        </button>
      </header>

      <main className="main">
        <Page route={current.path} role={me.role} canEdit={canEdit} />
      </main>
    </div>
  );
}

function Page({ route, role, canEdit }: { route: string; role: Role; canEdit: boolean }) {
  void role;
  switch (route) {
    case 'overview':
      return <OverviewPage />;
    case 'brands':
      return <BrandsPage canEdit={canEdit} />;
    case 'products':
      return <ProductsPage canEdit={canEdit} />;
    case 'sources':
      return <SourcesPage canEdit={canEdit} />;
    case 'mappings':
      return <MappingsPage canEdit={canEdit} />;
    case 'reviews':
      return <ReviewsPage canEdit={canEdit} />;
    case 'crawl-runs':
      return <CrawlRunsPage />;
    case 'admins':
      return <AdminsPage />;
    case 'audit':
      return <AuditPage />;
    default:
      return <OverviewPage />;
  }
}

function TokenGate({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState(getAdminToken());
  return (
    <div className="gate">
      <div className="card">
        <div className="logo-lg" aria-hidden>
          <IconShield size={26} />
        </div>
        <h2>Đăng nhập quản trị</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Nhập token quản trị để truy cập bảng điều khiển.
        </p>
        <label htmlFor="tok">Token</label>
        <input
          id="tok"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="X-Admin-Token"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              setAdminToken(value.trim());
              onSubmit();
            }
          }}
        />
        <button
          className="btn primary"
          style={{ width: '100%', marginTop: 16 }}
          onClick={() => {
            setAdminToken(value.trim());
            onSubmit();
          }}
          disabled={!value.trim()}
        >
          Vào bảng điều khiển
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="center-pad" style={{ minHeight: '100vh' }}>
      <div className="spinner" role="status" aria-label="Đang tải" />
    </div>
  );
}
