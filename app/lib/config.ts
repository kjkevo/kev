import { prisma } from './db';

export interface BusinessConfig {
  id: number;
  businessName: string;
  businessPhone: string;
  ownerPhone: string;
  ownerEmail: string;
  missedCallMessage: string;
  leadSubmissionMsg: string;
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
  airtableApiKey: process.env.AIRTABLE_API_KEY,
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  airtableMissedTable: process.env.AIRTABLE_MISSED_CALLS_TABLE_ID,
  airtableLeadsTable: process.env.AIRTABLE_LEADS_TABLE_ID,
};

export const loadBusinessConfig = async (businessId?: number): Promise<BusinessConfig> => {
  if (businessId) {
    try {
      const config = await prisma.businessConfig.findUnique({
        where: { id: businessId },
      });
      if (config) {
        return {
          id: config.id,
          businessName: config.businessName,
          businessPhone: config.businessPhone,
          ownerPhone: config.ownerPhone,
          ownerEmail: config.ownerEmail,
          missedCallMessage: config.missedCallMessage,
          leadSubmissionMsg: config.leadSubmissionMsg,
          airtableApiKey: config.airtableApiKey || undefined,
          airtableBaseId: config.airtableBaseId || undefined,
          airtableMissedTable: config.airtableMissedTable || undefined,
          airtableLeadsTable: config.airtableLeadsTable || undefined,
        };
      }
    } catch (error) {
      console.error(`Error loading business config for ID ${businessId}:`, error);
    }
  }

  // Fallback to environment variables
  return { id: 1, ...defaultConfig };
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
