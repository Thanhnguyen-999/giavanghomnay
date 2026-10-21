import { useState } from 'react';
import { api } from '../api/client.ts';
import type { PreviewResult, Source } from '../api/types.ts';
import { formatVnd } from '../components/ui.tsx';
import { useUi } from '../components/UiProvider.tsx';
import { useResource } from '../lib/useResource.ts';

const sampleConfig = {
  request: { url: 'https://example.com/gia-vang' },
  format: 'html',
  rows: 'table tbody tr',
  fields: {
    label: { path: 'td:nth-child(1)' },
    buy: { path: 'td:nth-child(2)' },
    sell: { path: 'td:nth-child(3)' },
  },
  number: { thousandSeparator: '.', decimalSeparator: ',', multiplier: 1000 },
  keyTemplate: '{label}',
};

export function SourcesPage({ canEdit }: { canEdit: boolean }) {
  const sources = useResource<Source[]>('/admin/v1/sources');
  const [editor, setEditor] = useState<string | null>(null);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Nguồn dữ liệu</h2>
          <div className="sub">
            Cấu hình động — thêm nguồn giá mới mà không cần sửa code. Có "Chạy thử" trước khi bật.
          </div>
        </div>
      </div>
      {sources.error && <p className="error">{sources.error}</p>}

      <div className="card">
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Nguồn</th>
                <th>Loại</th>
                <th className="num">Chu kỳ</th>
                <th className="num">Config</th>
                <th>Trạng thái</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {(sources.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      {s.id}
                    </div>
                  </td>
                  <td>
                    <span className="badge plain">{s.kind}</span>
                  </td>
                  <td className="num mono">{s.interval_sec}s</td>
                  <td className="num mono">{s.active_config_version ?? '—'}</td>
                  <td>
                    <span className={`badge ${s.enabled ? 'ok' : 'plain'}`}>
                      {s.enabled ? 'Đang chạy' : 'Tắt'}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <button className="btn sm" onClick={() => setEditor(s.id)}>
                        Cấu hình
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {(sources.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="table-empty">
                    Chưa có nguồn nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && (
        <>
          <SourceConfigEditor
            key={editor ?? 'none'}
            sourceId={editor}
            onSaved={() => sources.reload()}
          />
          <CreateSource onCreated={() => sources.reload()} />
        </>
      )}
    </>
  );
}

function SourceConfigEditor({
  sourceId,
  onSaved,
}: {
  sourceId: string | null;
  onSaved: () => void;
}) {
  const { toast } = useUi();
  const [text, setText] = useState(JSON.stringify(sampleConfig, null, 2));
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!sourceId) return null;

  function parse(): unknown {
    return JSON.parse(text);
  }

  async function run(action: 'preview' | 'save' | 'activate-latest') {
    setErr(null);
    setPreview(null);
    setBusy(true);
    try {
      const config = parse();
      if (action === 'preview') {
        const res = await api.post<PreviewResult>(`/admin/v1/sources/${sourceId}/preview`, {
          config,
        });
        setPreview(res);
        toast(`Chạy thử xong: ${res.rows.length} dòng, ${res.mappedCount} có giá.`, 'info');
      } else if (action === 'save') {
        const r = await api.post<{ version: number }>(`/admin/v1/sources/${sourceId}/configs`, {
          config,
        });
        onSaved();
        toast(`Đã lưu cấu hình version ${r.version}. Nhớ kích hoạt để áp dụng.`, 'success');
      } else {
        const configs = await api.get<{ version: number }[]>(
          `/admin/v1/sources/${sourceId}/configs`,
        );
        const latest = configs[0]?.version;
        if (!latest) throw new Error('Chưa có version nào để kích hoạt');
        await api.post(`/admin/v1/sources/${sourceId}/activate`, { version: latest });
        onSaved();
        toast(`Đã kích hoạt version ${latest}.`, 'success');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>
          Cấu hình nguồn: <span className="mono">{sourceId}</span>
        </h3>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Sửa cấu hình JSON, bấm <b>Chạy thử</b> để xem kết quả (không ghi), rồi <b>Lưu version</b> và{' '}
        <b>Kích hoạt</b>.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" disabled={busy} onClick={() => run('preview')}>
          Chạy thử
        </button>
        <button className="btn" disabled={busy} onClick={() => run('save')}>
          Lưu version
        </button>
        <button className="btn primary" disabled={busy} onClick={() => run('activate-latest')}>
          Kích hoạt version mới nhất
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {preview && <PreviewTable result={preview} />}
    </div>
  );
}

function PreviewTable({ result }: { result: PreviewResult }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <span className={`badge ${result.status >= 200 && result.status < 300 ? 'ok' : 'err'}`}>
          HTTP {result.status}
        </span>
        <span className="badge plain">{result.rows.length} dòng</span>
        <span className="badge info">{result.mappedCount} có mua/bán</span>
      </div>
      {result.warnings.length > 0 && (
        <div className="warnings" style={{ marginBottom: 8 }}>
          {result.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>rawKey</th>
              <th>Nhãn</th>
              <th>Khu vực</th>
              <th className="num">Mua</th>
              <th className="num">Bán</th>
              <th className="num">Giá</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 50).map((r, i) => (
              <tr key={i}>
                <td className="mono">{r.rawKey}</td>
                <td>{r.label}</td>
                <td>{r.region ?? '—'}</td>
                <td className="num mono">{r.buy != null ? formatVnd(r.buy) : '—'}</td>
                <td className="num mono">{r.sell != null ? formatVnd(r.sell) : '—'}</td>
                <td className="num mono">{r.price != null ? formatVnd(r.price) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateSource({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ id: '', name: '', kind: 'domestic', intervalSec: 300 });
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    try {
      await api.post('/admin/v1/sources', { ...form, intervalSec: Number(form.intervalSec) });
      setForm({ id: '', name: '', kind: 'domestic', intervalSec: 300 });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card">
      <h3>Thêm nguồn</h3>
      <div className="row">
        <div>
          <label>ID</label>
          <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
        </div>
        <div>
          <label>Tên</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label>Loại</label>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="domestic">Trong nước</option>
            <option value="world">Thế giới</option>
            <option value="fx">Tỷ giá</option>
          </select>
        </div>
        <div>
          <label>Chu kỳ (giây, ≥ 60)</label>
          <input
            type="number"
            value={form.intervalSec}
            onChange={(e) => setForm({ ...form, intervalSec: Number(e.target.value) })}
          />
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      <p>
        <button className="primary" onClick={create} disabled={!form.id || !form.name}>
          Tạo nguồn
        </button>
      </p>
    </div>
  );
}
