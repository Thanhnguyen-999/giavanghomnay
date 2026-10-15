import { useState } from 'react';
import { api } from '../api/client.ts';
import type { PreviewResult, Source } from '../api/types.ts';
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
      <h2>Nguồn dữ liệu</h2>
      {sources.error && <p className="error">{sources.error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Loại</th>
              <th>Chu kỳ (s)</th>
              <th>Config active</th>
              <th>Bật</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {(sources.data ?? []).map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.name}</td>
                <td>{s.kind}</td>
                <td>{s.interval_sec}</td>
                <td>{s.active_config_version ?? '—'}</td>
                <td>
                  <span className={`badge ${s.enabled ? 'ok' : ''}`}>
                    {s.enabled ? 'Bật' : 'Tắt'}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    <button onClick={() => setEditor(s.id)}>Cấu hình</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
  const [text, setText] = useState(JSON.stringify(sampleConfig, null, 2));
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!sourceId) return null;

  function parse(): unknown {
    return JSON.parse(text);
  }

  async function run(action: 'preview' | 'save' | 'activate-latest') {
    setErr(null);
    setMsg(null);
    setPreview(null);
    try {
      const config = parse();
      if (action === 'preview') {
        const res = await api.post<PreviewResult>(`/admin/v1/sources/${sourceId}/preview`, {
          config,
        });
        setPreview(res);
      } else if (action === 'save') {
        const r = await api.post<{ version: number }>(`/admin/v1/sources/${sourceId}/configs`, {
          config,
        });
        setMsg(`Đã lưu version ${r.version}. Dùng "Kích hoạt version mới nhất" để áp dụng.`);
        onSaved();
      } else {
        const configs = await api.get<{ version: number }[]>(
          `/admin/v1/sources/${sourceId}/configs`,
        );
        const latest = configs[0]?.version;
        if (!latest) throw new Error('Chưa có version nào để kích hoạt');
        await api.post(`/admin/v1/sources/${sourceId}/activate`, { version: latest });
        setMsg(`Đã kích hoạt version ${latest}.`);
        onSaved();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card">
      <h3>Cấu hình nguồn: {sourceId}</h3>
      <p className="muted">
        Sửa cấu hình JSON, bấm <b>Chạy thử</b> để xem kết quả (không ghi), rồi <b>Lưu version</b> và{' '}
        <b>Kích hoạt</b>.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <p className="row">
        <button onClick={() => run('preview')}>Chạy thử</button>
        <button onClick={() => run('save')}>Lưu version</button>
        <button onClick={() => run('activate-latest')}>Kích hoạt version mới nhất</button>
      </p>
      {msg && <p className="muted">{msg}</p>}
      {err && <p className="error">{err}</p>}
      {preview && <PreviewTable result={preview} />}
    </div>
  );
}

function PreviewTable({ result }: { result: PreviewResult }) {
  return (
    <div>
      <p className="muted">
        HTTP {result.status} · {result.rows.length} dòng · {result.mappedCount} dòng có mua/bán
      </p>
      {result.warnings.length > 0 && (
        <div className="warnings">
          {result.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>rawKey</th>
            <th>Nhãn</th>
            <th>Khu vực</th>
            <th>Mua</th>
            <th>Bán</th>
            <th>Giá</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, 50).map((r, i) => (
            <tr key={i}>
              <td>{r.rawKey}</td>
              <td>{r.label}</td>
              <td>{r.region ?? '—'}</td>
              <td>{r.buy ?? '—'}</td>
              <td>{r.sell ?? '—'}</td>
              <td>{r.price ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
