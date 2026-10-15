import { useEffect, useState } from 'react';
import { ApiError, api } from './api/client.ts';
import type { Me } from './api/types.ts';
import { AdminsPage } from './pages/AdminsPage.tsx';
import { AuditPage } from './pages/AuditPage.tsx';
import { BrandsPage } from './pages/BrandsPage.tsx';
import { CrawlRunsPage } from './pages/CrawlRunsPage.tsx';
import { MappingsPage } from './pages/MappingsPage.tsx';
import { ProductsPage } from './pages/ProductsPage.tsx';
import { ReviewsPage } from './pages/ReviewsPage.tsx';
import { SourcesPage } from './pages/SourcesPage.tsx';

interface NavItem {
  path: string;
  label: string;
  minRole: Me['role'];
}

const NAV: NavItem[] = [
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
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || 'brands');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || 'brands');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const route = useHashRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Me>('/admin/v1/me')
      .then(setMe)
      .catch((e: unknown) => {
        if (e instanceof ApiError) {
          setError(
            e.status === 403 || e.status === 401
              ? 'Bạn chưa có quyền quản trị. Liên hệ owner để được cấp quyền.'
              : e.message,
          );
        } else setError(String(e));
      });
  }, []);

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
        </div>
      </aside>
      <main className="main">
        <Page route={current.path} role={me.role} />
      </main>
    </div>
  );
}

function Page({ route, role }: { route: string; role: Me['role'] }) {
  const canEdit = RANK[role] >= RANK.editor;
  switch (route) {
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
      return <BrandsPage canEdit={canEdit} />;
  }
}
