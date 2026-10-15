import { type ExtractResult, extract, parseSourceConfig } from '@giavang/extractor';
import { safeFetch } from './fetcher.ts';

export interface PreviewResult extends ExtractResult {
  status: number;
  mappedCount: number; // số dòng domestic có cả buy & sell
}

/// Chạy thử một cấu hình nguồn: fetch + extract, KHÔNG ghi gì vào D1/KV.
/// Dùng cho nút "Chạy thử" của admin trước khi lưu/bật nguồn.
/// Ném nếu config sai (zod) hoặc fetch lỗi — lớp gọi bắt và trả lỗi cho UI.
export async function previewSource(rawConfig: unknown): Promise<PreviewResult> {
  const config = parseSourceConfig(rawConfig);
  const fetched = await safeFetch(config.request);
  const { rows, warnings } = await extract(config, fetched.body);
  const mappedCount = rows.filter((r) => r.buy !== undefined && r.sell !== undefined).length;
  return { rows, warnings, status: fetched.status, mappedCount };
}
