export interface ClientConfig {
  clientId: string;
  businessName: string;
  businessPhone: string;
  timezone: string;
  reminders: {
    confirmationMessage: string;
    reminderMessage24h: string;
    reminderMessage2h: string;
    noshowMessage: string;
    rebookLink: string;
  };
  schedules: {
    reminder24h: boolean;
    reminder2h: boolean;
  };
}

// In-memory config storage - in production, load from database
const configs = new Map<string, ClientConfig>();

export function registerClientConfig(config: ClientConfig) {
  configs.set(config.clientId, config);
}

export function getClientConfig(clientId: string): ClientConfig {
  let config = configs.get(clientId);

  if (!config) {
    // Return default config if not registered
    config = {
      clientId,
      businessName: 'Our Business',
      businessPhone: '+1234567890',
      timezone: 'America/New_York',
      reminders: {
        confirmationMessage: 'Hi {{customerName}}, your appointment is confirmed for {{appointmentTime}}. Reply STOP to cancel.',
        reminderMessage24h:
          'Hi {{customerName}}, reminder: you have an appointment tomorrow at {{appointmentTime}}. See you then!',
        reminderMessage2h:
          'Hi {{customerName}}, your appointment is in 2 hours at {{appointmentTime}}. We look forward to seeing you!',
        noshowMessage:
          "We noticed you missed your appointment. We'd love to reschedule! Call {{businessPhone}} or click here: {{rebookLink}}",
        rebookLink: 'https://calendly.com/your-business',
      },
      schedules: {
        reminder24h: true,
        reminder2h: true,
      },
    };
  }

  return config;
}

export function interpolateMessage(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] || ''));
}
