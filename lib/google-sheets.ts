import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

let doc: GoogleSpreadsheet | null = null;

async function initializeDoc() {
  if (doc) return doc;

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;

  if (!spreadsheetId || !privateKey || !clientEmail) {
    throw new Error('Google Sheets credentials not configured');
  }

  const jwt = new JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  doc = new GoogleSpreadsheet(spreadsheetId, jwt);
  await doc.loadInfo();
  return doc;
}

export async function getOrCreateSheet(title: string) {
  const spreadsheet = await initializeDoc();
  let sheet = spreadsheet.sheetsByTitle[title];

  if (!sheet) {
    sheet = await spreadsheet.addSheet({ title });
  }

  return sheet;
}

export async function appendRow(sheetTitle: string, row: Record<string, string | number | boolean>) {
  const sheet = await getOrCreateSheet(sheetTitle);
  await sheet.addRow(row);
}

export async function getRows(sheetTitle: string) {
  const sheet = await getOrCreateSheet(sheetTitle);
  return await sheet.getRows();
}

export async function updateRow(sheetTitle: string, rowIndex: number, updates: Record<string, any>) {
  const sheet = await getOrCreateSheet(sheetTitle);
  const rows = await sheet.getRows();

  if (rows[rowIndex]) {
    Object.assign(rows[rowIndex], updates);
    await rows[rowIndex].save();
  }
}

export async function deleteRow(sheetTitle: string, rowIndex: number) {
  const sheet = await getOrCreateSheet(sheetTitle);
  const rows = await sheet.getRows();

  if (rows[rowIndex]) {
    await rows[rowIndex].delete();
  }
}
