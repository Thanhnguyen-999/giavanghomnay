import { useEffect, useState } from 'react';
import { ApiError, api, getAdminToken, setAdminToken } from './api/client.ts';
import type { Me } from './api/types.ts';
import { AdminsPage } from './pages/AdminsPage.tsx';
import { AuditPage } from './pages/AuditPage.tsx';
import { BrandsPage } from './pages/BrandsPage.tsx';
import { CrawlRunsPage } from './pages/CrawlRunsPage.tsx';
import { MappingsPage } from './pages/MappingsPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { ProductsPage } from './pages/ProductsPage.tsx';
import { ReviewsPage } from './pages/ReviewsPage.tsx';
import { SourcesPage } from './pages/SourcesPage.tsx';

interface NavItem {
  path: string;
  label: string;
  minRole: Me['role'];
}

const NAV: NavItem[] = [
  { path: 'overview', label: 'Tổng quan', minRole: 'viewer' },
  { path: 'brands', label: 'Thương hiệu', minRole: 'viewer' },
  { path: 'products', label: 'Sản phẩm', minRole: 'viewer' },
  { path: 'sources', label: 'Nguồn dữ liệu', minRole: 'viewer' },
  { path: 'mappings', label: 'Gán nhãn', minRole: 'viewer' },
  { path: 'reviews', label: 'Kiểm duyệt giá', minRole: 'viewer' },
  { path: 'crawl-runs', label: 'Nhật ký crawl', minRole: 'viewer' },
  { path: 'admins', label: 'Quản trị viên', minRole: 'owner' },
  { path: 'audit', label: 'Audit log', minRole: 'owner' },
];

const RANK = { viewer: 1, editor: 2, owner: 3 } as const;

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || 'overview');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || 'overview');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
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
      .then((m) => {
        if (!cancelled) setMe(m);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setNeedLogin(true); // cần nhập token
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (needLogin) {
    return <TokenGate onSubmit={() => setAttempt((a) => a + 1)} />;
  }
  if (error) {
    return (
      <div className="main">
        <h2>Không truy cập được</h2>
        <p className="error">{error}</p>
      </div>
    );
  }
  if (!me) return <div className="main">Đang tải…</div>;

  const canSee = (item: NavItem) => RANK[me.role] >= RANK[item.minRole];
  const current = NAV.find((n) => n.path === route && canSee(n)) ?? NAV[0]!;

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Giá Vàng · Quản trị</h1>
        <nav>
          {NAV.filter(canSee).map((n) => (
            <a key={n.path} href={`#${n.path}`} className={n.path === current.path ? 'active' : ''}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="me">
          {me.email}
          <br />
          vai trò: {me.role}
          <br />
          <button
            style={{ marginTop: 8, fontSize: 12, padding: '4px 8px' }}
            onClick={() => {
              setAdminToken('');
              setMe(null);
              setAttempt((a) => a + 1);
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="main">
        <Page route={current.path} role={me.role} />
      </main>
    </div>
  );
}

function TokenGate({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState(getAdminToken());
  return (
    <div className="main" style={{ maxWidth: 420 }}>
      <h2>Đăng nhập quản trị</h2>
      <p className="muted">Nhập token quản trị để truy cập dashboard.</p>
      <div className="card">
        <label>Token</label>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="X-Admin-Token"
        />
        <p style={{ marginTop: 12 }}>
          <button
            className="primary"
            onClick={() => {
              setAdminToken(value.trim());
              onSubmit();
            }}
            disabled={!value.trim()}
          >
            Vào dashboard
          </button>
        </p>
      </div>
    </div>
  );
}

function Page({ route, role }: { route: string; role: Me['role'] }) {
  const canEdit = RANK[role] >= RANK.editor;
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
