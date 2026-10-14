/// Chuẩn hóa một chuỗi để so khớp ổn định: bỏ dấu tiếng Việt, chữ thường,
/// gộp khoảng trắng, bỏ ký tự lạ. Nhờ vậy nhãn đổi nhẹ định dạng không tạo
/// mapping mới ("Vàng SJC 1L" ~ "vang sjc 1l").
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu kết hợp
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/// Tạo raw_key từ template, vd '{label}|{region}'. Field thiếu → chuỗi rỗng.
export function buildRawKey(
  template: string,
  values: { label: string; region?: string },
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = key === 'label' ? values.label : key === 'region' ? values.region : '';
    return normalize(v ?? '');
  });
}
