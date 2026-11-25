import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath = process.argv[2];
const previewDirectory = process.argv[3];
if (!inputPath || !previewDirectory) throw new Error('usage: verify-sample-xlsx.mjs <xlsx> <preview-dir>');

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const overview = await workbook.inspect({
  kind: 'sheet,table',
  maxChars: 5000,
  tableMaxRows: 8,
  tableMaxCols: 14,
  tableMaxCellChars: 100
});
console.log(overview.ndjson);

const errorScan = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'formula error scan'
});
console.log(errorScan.ndjson);

await fs.mkdir(previewDirectory, { recursive: true });
for (const sheetName of ['达人主表', '字段明细', '导出说明']) {
  const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
  const outputPath = path.join(previewDirectory, `${sheetName}.png`);
  await fs.writeFile(outputPath, new Uint8Array(await preview.arrayBuffer()));
  console.log(outputPath);
}
