import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

/// Chuyển XML thành object JSON thuần để dùng chung bộ đọc json.ts.
/// Attribute có tiền tố '@_', nên config json trỏ tới chúng bằng '@_name'.
export function xmlToJson(xml: string): unknown {
  return parser.parse(xml);
}
