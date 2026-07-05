import cron from 'node-cron';
import { getRemindersDue, sendReminderText } from './appointments';
import { getRows } from './google-sheets';
import { getClientConfig } from './client-config';

// Store in-memory set of clients to process
const activeClients = new Set<string>();

export function registerClient(clientId: string) {
  activeClients.add(clientId);
  console.log(`Registered client: ${clientId}`);
}

export function unregisterClient(clientId: string) {
  activeClients.delete(clientId);
  console.log(`Unregistered client: ${clientId}`);
}

async function sendReminders(hoursUntil: 24 | 2) {
  console.log(`\n[${new Date().toISOString()}] Running ${hoursUntil}h reminder check...`);

  for (const clientId of activeClients) {
    try {
      const config = getClientConfig(clientId);

      // Skip if this reminder is disabled for the client
      const reminderKey = hoursUntil === 24 ? 'reminder24h' : 'reminder2h';
      if (!config.schedules[reminderKey as keyof typeof config.schedules]) {
        continue;
      }

      const duReminders = await getRemindersDue(clientId, hoursUntil);

      for (const reminder of duReminders) {
        try {
          await sendReminderText(clientId, reminder.appointmentId, hoursUntil);
        } catch (error) {
          console.error(`Failed to send reminder for ${reminder.appointmentId}:`, error);
        }
      }

      if (duReminders.length > 0) {
        console.log(`Sent ${duReminders.length} ${hoursUntil}h reminders for client ${clientId}`);
      }
    } catch (error) {
      console.error(`Error processing reminders for client ${clientId}:`, error);
    }
  }
}

// Schedule reminder jobs
// Run 24-hour reminders every hour at minute 0
cron.schedule('0 * * * *', () => {
  sendReminders(24);
});

// Run 2-hour reminders every 30 minutes
cron.schedule('*/30 * * * *', () => {
  sendReminders(2);
});

console.log('Appointment reminder service started');
console.log('24-hour reminders: Every hour at :00');
console.log('2-hour reminders: Every 30 minutes');

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export { sendReminders };
