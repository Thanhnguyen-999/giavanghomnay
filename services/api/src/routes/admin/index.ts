import { Hono } from 'hono';
import { requireAdmin } from '../../auth/access.ts';
import type { AppEnv } from '../../types.ts';
import { adminUserRoutes } from './admins.ts';
import { brandRoutes } from './brands.ts';
import { mappingRoutes } from './mappings.ts';
import { monitoringRoutes } from './monitoring.ts';
import { productRoutes } from './products.ts';
import { reviewRoutes } from './reviews.ts';
import { sourceRoutes } from './sources.ts';

export const adminRoutes = new Hono<AppEnv>();

// Danh tính + role của admin đang đăng nhập (UI dùng để ẩn/hiện chức năng).
// viewer là role tối thiểu, nên mọi admin hợp lệ đều gọi được.
adminRoutes.get('/me', requireAdmin('viewer'), (c) => {
  return c.json({ data: { email: c.get('adminEmail'), role: c.get('adminRole') } });
});

adminRoutes.route('/brands', brandRoutes);
adminRoutes.route('/products', productRoutes);
adminRoutes.route('/sources', sourceRoutes);
adminRoutes.route('/mappings', mappingRoutes);
adminRoutes.route('/reviews', reviewRoutes);
adminRoutes.route('/admins', adminUserRoutes);
adminRoutes.route('/', monitoringRoutes);
