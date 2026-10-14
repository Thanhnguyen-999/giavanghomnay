import { z } from 'zod';

/// Một trường được trích từ mỗi dòng. Lấy theo thứ tự: text của phần tử (hoặc
/// attribute nếu có `attr`), rồi áp `regex` (capture group 1) nếu có.
const Field = z.object({
  /// html/xml: CSS selector *tương đối trong một dòng*. json: đường dẫn 'a.b[0]'.
  path: z.string().min(1).max(200),
  /// html: lấy giá trị attribute thay vì text.
  attr: z.string().max(50).optional(),
  /// Áp lên chuỗi đã lấy; dùng capture group 1 nếu khớp.
  regex: z.string().max(200).optional(),
});

export type Field = z.infer<typeof Field>;

export const SourceConfig = z
  .object({
    request: z.object({
      url: z.string().url().startsWith('https://'),
      method: z.enum(['GET', 'POST']).default('GET'),
      headers: z.record(z.string(), z.string().max(500)).default({}),
      body: z.string().max(10_000).optional(),
      timeoutMs: z.number().int().min(1_000).max(15_000).default(8_000),
      maxBytes: z
        .number()
        .int()
        .min(1_000)
        .max(5_000_000)
        .default(2_000_000),
    }),
    format: z.enum(['html', 'json', 'xml']),
    /// Selector (html/xml) hoặc đường dẫn tới mảng (json) trỏ tới danh sách dòng.
    rows: z.string().min(1).max(200),
    fields: z.object({
      label: Field,
      region: Field.optional(),
      /// domestic: cần buy + sell. world/fx: cần price.
      buy: Field.optional(),
      sell: Field.optional(),
      price: Field.optional(),
    }),
    number: z
      .object({
        thousandSeparator: z.enum(['.', ',', ' ', '']).default('.'),
        decimalSeparator: z.enum(['.', ',']).default(','),
        /// Hệ số đưa về đồng/lượng. Vd: nguồn ghi "nghìn đồng/lượng" → 1000;
        /// "nghìn đồng/chỉ" → 10000 (1 lượng = 10 chỉ). world/fx thường = 1.
        multiplier: z.number().positive().default(1),
      })
      .default({ thousandSeparator: '.', decimalSeparator: ',', multiplier: 1 }),
    /// Mẫu tạo raw_key từ các trường, vd '{label}|{region}'.
    keyTemplate: z.string().max(100).default('{label}|{region}'),
  })
  .refine((c) => c.number.thousandSeparator !== c.number.decimalSeparator, {
    message: 'Dấu phân cách hàng nghìn và thập phân phải khác nhau',
  });

export type SourceConfig = z.infer<typeof SourceConfig>;
export type SourceConfigInput = z.input<typeof SourceConfig>;

/// Phân tích + điền default. Ném ZodError nếu cấu hình sai (lớp gọi bắt).
export function parseSourceConfig(raw: unknown): SourceConfig {
  return SourceConfig.parse(raw);
}
