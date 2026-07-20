import { prisma } from './db';

export interface BusinessConfig {
  id: number;
  businessName: string;
  businessPhone: string;
  ownerPhone: string;
  ownerEmail: string;
  missedCallMessage: string;
  leadSubmissionMsg: string;
  // Per-business channel behavior ("voice, text, or both")
  smsEnabled: boolean;
  voiceEnabled: boolean;
  recordVoicemail: boolean;
  voiceGreeting: string;
  airtableApiKey?: string;
  airtableBaseId?: string;
  airtableMissedTable?: string;
  airtableLeadsTable?: string;
}

const defaultConfig: Omit<BusinessConfig, 'id'> = {
  businessName: process.env.BUSINESS_NAME || 'Service Business',
  businessPhone: process.env.TWILIO_PHONE_NUMBER || '',
  ownerPhone: process.env.BUSINESS_OWNER_PHONE || '',
  ownerEmail: process.env.BUSINESS_OWNER_EMAIL || '',
  missedCallMessage: process.env.MISSED_CALL_MESSAGE || 'Sorry we missed your call! {BUSINESS_NAME} will call you back shortly. Reply here if you\'d like to send details now.',
  leadSubmissionMsg: process.env.LEAD_SUBMISSION_MESSAGE || 'Hi {NAME}! Thanks for reaching out to {BUSINESS_NAME}. We got your message and will reply shortly.',
  smsEnabled: true,
  voiceEnabled: false,
  recordVoicemail: false,
  voiceGreeting: 'Thank you for calling. We\'re not available right now, but we\'ll text you shortly.',
  airtableApiKey: process.env.AIRTABLE_API_KEY,
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  airtableMissedTable: process.env.AIRTABLE_MISSED_CALLS_TABLE_ID,
  airtableLeadsTable: process.env.AIRTABLE_LEADS_TABLE_ID,
};

// Map a Prisma BusinessConfig row onto our config shape, falling back to
// environment defaults for empty string fields. Booleans use ?? so an
// explicit `false` is respected.
type BusinessConfigRow = NonNullable<Awaited<ReturnType<typeof prisma.businessConfig.findFirst>>>;

function mapRow(config: BusinessConfigRow): BusinessConfig {
  return {
    id: config.id,
    businessName: config.businessName || defaultConfig.businessName,
    businessPhone: config.businessPhone || defaultConfig.businessPhone,
    ownerPhone: config.ownerPhone || defaultConfig.ownerPhone,
    ownerEmail: config.ownerEmail || defaultConfig.ownerEmail,
    missedCallMessage: config.missedCallMessage || defaultConfig.missedCallMessage,
    leadSubmissionMsg: config.leadSubmissionMsg || defaultConfig.leadSubmissionMsg,
    smsEnabled: config.smsEnabled ?? defaultConfig.smsEnabled,
    voiceEnabled: config.voiceEnabled ?? defaultConfig.voiceEnabled,
    recordVoicemail: config.recordVoicemail ?? defaultConfig.recordVoicemail,
    voiceGreeting: config.voiceGreeting || defaultConfig.voiceGreeting,
    airtableApiKey: config.airtableApiKey || defaultConfig.airtableApiKey,
    airtableBaseId: config.airtableBaseId || defaultConfig.airtableBaseId,
    airtableMissedTable: config.airtableMissedTable || defaultConfig.airtableMissedTable,
    airtableLeadsTable: config.airtableLeadsTable || defaultConfig.airtableLeadsTable,
  };
}

export const loadBusinessConfig = async (businessId?: number): Promise<BusinessConfig> => {
  if (businessId) {
    try {
      const config = await prisma.businessConfig.findUnique({
        where: { id: businessId },
      });
      if (config) {
        return mapRow(config);
      }
    } catch (error) {
      console.error(`Error loading business config for ID ${businessId}:`, error);
    }
  }

  // Fallback to environment variables
  return { id: 0, ...defaultConfig };
};

// Multi-tenant lookup: find the business that owns the number that was dialed
// (Twilio's `To` field on an incoming call/status webhook). Returns null when
// no business matches, so the caller can decide how to handle unknown numbers.
export const loadBusinessConfigByPhone = async (phone: string): Promise<BusinessConfig | null> => {
  if (!phone) return null;
  try {
    const config = await prisma.businessConfig.findUnique({
      where: { businessPhone: phone },
    });
    return config ? mapRow(config) : null;
  } catch (error) {
    console.error(`Error loading business config for phone ${phone}:`, error);
    return null;
  }
};

export const renderTemplate = (template: string, values: Record<string, string>): string => {
  let result = template;
  Object.entries(values).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return result;
};

export const validateConfig = (config: BusinessConfig): string[] => {
  const errors: string[] = [];

  if (!config.businessName) errors.push('businessName is required');
  if (!config.businessPhone) errors.push('businessPhone is required');
  if (!config.ownerPhone) errors.push('ownerPhone is required');
  if (!config.ownerEmail) errors.push('ownerEmail is required');

  return errors;
};
