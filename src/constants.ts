// Google's export endpoint sends Content-Disposition: attachment, which forces
// a file download instead of opening the Sheets viewer. Same file, different action.
export const EXCEL_TEMPLATE_URL =
  'https://docs.google.com/spreadsheets/d/12bYMhMRwOSN26mmT6CdmT3cc8VklsITm/export?format=xlsx';
