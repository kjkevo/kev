import { sendSMS } from './twilio';
import { appendRow, getRows, updateRow } from './google-sheets';
import { getClientConfig, interpolateMessage } from './client-config';
import moment from 'moment-timezone';

export interface Appointment {
  appointmentId: string;
  clientId: string;
  customerName: string;
  customerPhone: string;
  appointmentDateTime: string;
  serviceType: string;
  status: 'scheduled' | 'completed' | 'noshow' | 'cancelled';
  createdAt: string;
}

export async function createAppointment(data: {
  clientId: string;
  customerName: string;
  customerPhone: string;
  appointmentDateTime: string;
  serviceType: string;
}): Promise<Appointment> {
  const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date().toISOString();

  const appointment: Appointment = {
    appointmentId,
    clientId: data.clientId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    appointmentDateTime: data.appointmentDateTime,
    serviceType: data.serviceType,
    status: 'scheduled',
    createdAt: now,
  };

  // Store in Google Sheets
  await appendRow(`${data.clientId}_appointments`, {
    appointmentId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    appointmentDateTime: data.appointmentDateTime,
    serviceType: data.serviceType,
    status: 'scheduled',
    createdAt: now,
  });

  // Send confirmation text
  await sendConfirmationText(data.clientId, appointment);

  return appointment;
}

export async function sendConfirmationText(clientId: string, appointment: Appointment) {
  const config = getClientConfig(clientId);
  const appointmentTime = moment(appointment.appointmentDateTime).tz(config.timezone).format('MMM DD [at] h:mm A');

  const message = interpolateMessage(config.reminders.confirmationMessage, {
    customerName: appointment.customerName,
    appointmentTime,
    businessName: config.businessName,
  });

  try {
    await sendSMS(appointment.customerPhone, message);
    console.log(`Confirmation text sent to ${appointment.customerPhone}`);
  } catch (error) {
    console.error('Failed to send confirmation text:', error);
  }
}

export async function markAsNoshow(clientId: string, appointmentId: string) {
  const rows = await getRows(`${clientId}_appointments`);
  const rowIndex = rows.findIndex((r: any) => r.appointmentId === appointmentId);

  if (rowIndex === -1) {
    throw new Error('Appointment not found');
  }

  const row = rows[rowIndex];
  await updateRow(`${clientId}_appointments`, rowIndex, { status: 'noshow' });

  // Send no-show follow-up text
  const config = getClientConfig(clientId);
  const message = interpolateMessage(config.reminders.noshowMessage, {
    customerName: row.customerName,
    businessPhone: config.businessPhone,
    rebookLink: config.reminders.rebookLink,
  });

  try {
    await sendSMS(row.customerPhone, message);
    console.log(`No-show follow-up text sent to ${row.customerPhone}`);
  } catch (error) {
    console.error('Failed to send no-show follow-up text:', error);
  }
}

export async function getAppointmentsByStatus(clientId: string, status: string) {
  const rows = await getRows(`${clientId}_appointments`);
  return rows.filter((r: any) => r.status === status);
}

export async function getRemindersDue(clientId: string, hoursUntil: number) {
  const rows = await getRows(`${clientId}_appointments`);
  const config = getClientConfig(clientId);
  const now = moment().tz(config.timezone);

  return rows.filter((row: any) => {
    if (row.status !== 'scheduled') return false;

    const appointmentTime = moment(row.appointmentDateTime).tz(config.timezone);
    const hoursUntilAppointment = appointmentTime.diff(now, 'hours', true);

    // Within the window and not already sent
    const reminderSent = row[`reminder${hoursUntil}h_sent`] === 'true' || row[`reminder${hoursUntil}h_sent`] === true;
    return hoursUntilAppointment <= hoursUntil + 0.5 && hoursUntilAppointment > hoursUntil - 0.5 && !reminderSent;
  });
}

export async function sendReminderText(
  clientId: string,
  appointmentId: string,
  hoursUntil: 24 | 2,
) {
  const rows = await getRows(`${clientId}_appointments`);
  const rowIndex = rows.findIndex((r: any) => r.appointmentId === appointmentId);

  if (rowIndex === -1) {
    throw new Error('Appointment not found');
  }

  const row = rows[rowIndex];
  const config = getClientConfig(clientId);
  const appointmentTime = moment(row.appointmentDateTime).tz(config.timezone).format('MMM DD [at] h:mm A');

  const messageKey = hoursUntil === 24 ? 'reminderMessage24h' : 'reminderMessage2h';
  const message = interpolateMessage(config.reminders[messageKey], {
    customerName: row.customerName,
    appointmentTime,
    businessName: config.businessName,
  });

  try {
    await sendSMS(row.customerPhone, message);
    console.log(`${hoursUntil}h reminder text sent to ${row.customerPhone}`);

    // Mark as sent
    await updateRow(`${clientId}_appointments`, rowIndex, {
      [`reminder${hoursUntil}h_sent`]: true,
    });
  } catch (error) {
    console.error(`Failed to send ${hoursUntil}h reminder text:`, error);
  }
}
