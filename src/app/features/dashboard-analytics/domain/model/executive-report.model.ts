import type { HerdIndicators } from './herd-indicators.model';

/** The JSON form of the executive report, which the PDF and Excel downloads are built from. */
export interface ExecutiveReportDocument {
  readonly generatedAt: string;
  readonly indicators: HerdIndicators;
}

/** A file the API generated; the app names it, because the server name carries the ranch identifier. */
export interface DownloadedFile {
  readonly content: Blob;
}
