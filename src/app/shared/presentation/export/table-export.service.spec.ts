import { type ExportColumn, TableExportService } from './table-export.service';

const mocks = vi.hoisted(() => {
  const document = {
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    setFontSize: vi.fn(),
    text: vi.fn(),
    setPage: vi.fn(),
    getNumberOfPages: vi.fn(() => 2),
    save: vi.fn(),
  };
  return {
    document,
    toFile: vi.fn(async (_fileName: string) => undefined),
    writeXlsxFile: vi.fn(),
    jsPDF: vi.fn(function () {
      return document;
    }),
    autoTable: vi.fn(),
  };
});

vi.mock('write-excel-file/browser', () => ({ default: mocks.writeXlsxFile }));
vi.mock('jspdf', () => ({ jsPDF: mocks.jsPDF }));
vi.mock('jspdf-autotable', () => ({ default: mocks.autoTable }));

interface Row {
  readonly name: string;
  readonly weight: number | null;
  readonly birthDate: Date | null;
}

const columns: ExportColumn<Row>[] = [
  { header: 'Name', value: row => row.name },
  { header: 'Weight', value: row => row.weight },
  { header: 'Birth date', value: row => row.birthDate },
];

const rows: Row[] = [
  { name: 'Lot A', weight: 320, birthDate: new Date(2026, 0, 5) },
  { name: 'Lot B', weight: null, birthDate: null },
];

describe('TableExportService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 11, 12));
    vi.clearAllMocks();
    mocks.writeXlsxFile.mockReturnValue({ toFile: mocks.toFile });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes bold headers and the mapped rows to an Excel file named by area and day', async () => {
    await new TableExportService().exportExcel('ichu-cattle', columns, rows);

    const [sheet] = mocks.writeXlsxFile.mock.calls[0];
    expect(sheet[0]).toEqual([
      { value: 'Name', fontWeight: 'bold' },
      { value: 'Weight', fontWeight: 'bold' },
      { value: 'Birth date', fontWeight: 'bold' },
    ]);
    expect(sheet[1]).toEqual(['Lot A', 320, { value: new Date(2026, 0, 5), format: 'yyyy-mm-dd' }]);
    expect(sheet[2]).toEqual(['Lot B', null, null]);
    expect(mocks.toFile).toHaveBeenCalledWith('ichu-cattle-2026-11-11.xlsx');
  });

  it('writes an A4 landscape PDF with title, subtitle, rows and page numbers', async () => {
    await new TableExportService().exportPdf(
      'ichu-cattle', 'ICHU · Animals', columns, rows, 'North Pasture · Nov 11, 2026',
    );

    expect(mocks.jsPDF).toHaveBeenCalledWith({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    expect(mocks.document.text).toHaveBeenCalledWith('ICHU · Animals', 14, 16);
    expect(mocks.document.text).toHaveBeenCalledWith('North Pasture · Nov 11, 2026', 14, 23);
    const [, options] = mocks.autoTable.mock.calls[0];
    expect(options).toMatchObject({
      head: [['Name', 'Weight', 'Birth date']],
      body: [['Lot A', '320', '2026-01-05'], ['Lot B', '', '']],
    });
    expect(mocks.document.setPage).toHaveBeenCalledWith(1);
    expect(mocks.document.setPage).toHaveBeenCalledWith(2);
    expect(mocks.document.text).toHaveBeenCalledWith('2 / 2', 283, 202, { align: 'right' });
    expect(mocks.document.save).toHaveBeenCalledWith('ichu-cattle-2026-11-11.pdf');
  });
});
