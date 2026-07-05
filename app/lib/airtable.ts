import Airtable from 'airtable';

interface AirtableConfig {
  apiKey: string;
  baseId: string;
  tableId: string;
}

export const logMissedCallToAirtable = async (
  config: AirtableConfig,
  data: {
    businessName: string;
    callerPhone: string;
    callerName?: string;
    missedAt: string;
    textSent: boolean;
  }
) => {
  if (!config.apiKey || !config.baseId || !config.tableId) {
    console.warn('Airtable not configured, skipping log');
    return null;
  }

  try {
    const base = new Airtable({ apiKey: config.apiKey }).base(config.baseId);

    const records = await base(config.tableId).create([
      {
        fields: {
          'Timestamp': new Date().toISOString(),
          'Phone': config.callerPhone,
          'Name': data.callerName || 'Unknown',
          'Business': data.businessName,
          'Type': 'Missed Call',
          'Status': data.textSent ? 'Texted' : 'Pending',
          'MissedAt': data.missedAt,
        },
      },
    ]);

    return records[0]?.id || null;
  } catch (error) {
    console.error('Error logging to Airtable:', error);
    throw error;
  }
};

export const logLeadToAirtable = async (
  config: AirtableConfig,
  data: {
    businessName: string;
    name: string;
    phone: string;
    serviceRequested: string;
    textSent: boolean;
  }
) => {
  if (!config.apiKey || !config.baseId || !config.tableId) {
    console.warn('Airtable not configured, skipping log');
    return null;
  }

  try {
    const base = new Airtable({ apiKey: config.apiKey }).base(config.baseId);

    const records = await base(config.tableId).create([
      {
        fields: {
          'Timestamp': new Date().toISOString(),
          'Phone': data.phone,
          'Name': data.name,
          'Business': data.businessName,
          'Service': data.serviceRequested,
          'Type': 'Lead Submission',
          'Status': data.textSent ? 'Texted' : 'Pending',
        },
      },
    ]);

    return records[0]?.id || null;
  } catch (error) {
    console.error('Error logging lead to Airtable:', error);
    throw error;
  }
};

export const logSmsResponseToAirtable = async (
  config: AirtableConfig,
  recordId: string,
  response: string
) => {
  if (!config.apiKey || !config.baseId || !config.tableId) {
    console.warn('Airtable not configured, skipping update');
    return null;
  }

  try {
    const base = new Airtable({ apiKey: config.apiKey }).base(config.baseId);

    const record = await base(config.tableId).update(recordId, {
      'Response': response,
      'ResponseReceivedAt': new Date().toISOString(),
      'Status': 'Responded',
    });

    return record;
  } catch (error) {
    console.error('Error updating Airtable record:', error);
    throw error;
  }
};
