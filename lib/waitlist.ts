import { sendSMS } from './twilio';
import { appendRow, getRows, updateRow, deleteRow } from './google-sheets';
import { getClientConfig, interpolateMessage } from './client-config';
import moment from 'moment-timezone';

export interface WaitlistEntry {
  waitlistId: string;
  clientId: string;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  createdAt: string;
  status: 'waiting' | 'confirmed' | 'expired';
}

export async function addToWaitlist(data: {
  clientId: string;
  customerName: string;
  customerPhone: string;
  serviceType: string;
}): Promise<WaitlistEntry> {
  const waitlistId = `wl_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date().toISOString();

  const entry: WaitlistEntry = {
    waitlistId,
    clientId: data.clientId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    serviceType: data.serviceType,
    createdAt: now,
    status: 'waiting',
  };

  await appendRow(`${data.clientId}_waitlist`, {
    waitlistId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    serviceType: data.serviceType,
    status: 'waiting',
    createdAt: now,
    contacted: false,
  });

  return entry;
}

export async function getWaitlistForService(clientId: string, serviceType: string) {
  const rows = await getRows(`${clientId}_waitlist`);
  return rows.filter((r: any) => r.serviceType === serviceType && r.status === 'waiting');
}

export async function notifyNextOnWaitlist(clientId: string, serviceType: string, slotDateTime: string) {
  const waitlist = await getWaitlistForService(clientId, serviceType);

  if (waitlist.length === 0) {
    console.log(`No one on waitlist for ${serviceType}`);
    return null;
  }

  const nextPerson = waitlist[0];
  const config = getClientConfig(clientId);
  const slotTime = moment(slotDateTime).tz(config.timezone).format('MMM DD [at] h:mm A');

  const message = `Hi ${nextPerson.customerName}, great news! We have an opening for ${serviceType} on ${slotTime}. Reply YES to confirm or call us at ${config.businessPhone}.`;

  try {
    await sendSMS(nextPerson.customerPhone, message);
    console.log(`Waitlist notification sent to ${nextPerson.customerName}`);

    // Mark as contacted
    const allWaitlist = await getRows(`${clientId}_waitlist`);
    const rowIndex = allWaitlist.findIndex((r: any) => r.waitlistId === nextPerson.waitlistId);
    if (rowIndex !== -1) {
      await updateRow(`${clientId}_waitlist`, rowIndex, { contacted: true });
    }

    return nextPerson;
  } catch (error) {
    console.error('Failed to notify waitlist:', error);
    return null;
  }
}

export async function confirmWaitlistCustomer(clientId: string, waitlistId: string) {
  const rows = await getRows(`${clientId}_waitlist`);
  const rowIndex = rows.findIndex((r: any) => r.waitlistId === waitlistId);

  if (rowIndex === -1) {
    throw new Error('Waitlist entry not found');
  }

  await updateRow(`${clientId}_waitlist`, rowIndex, { status: 'confirmed' });
}

export async function removeFromWaitlist(clientId: string, waitlistId: string) {
  const rows = await getRows(`${clientId}_waitlist`);
  const rowIndex = rows.findIndex((r: any) => r.waitlistId === waitlistId);

  if (rowIndex === -1) {
    throw new Error('Waitlist entry not found');
  }

  await deleteRow(`${clientId}_waitlist`, rowIndex);
}
