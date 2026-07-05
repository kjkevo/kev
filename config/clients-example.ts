import { registerClientConfig } from '../lib/client-config';

// Example configurations for different service businesses
// Copy this file to clients.ts and customize for your actual clients

// Dental Office
registerClientConfig({
  clientId: 'dental-office-1',
  businessName: 'Bright Smile Dental',
  businessPhone: '+1555123456',
  timezone: 'America/New_York',
  reminders: {
    confirmationMessage:
      'Hi {{customerName}}, your appointment is confirmed for {{appointmentTime}} at {{businessName}}. Reply STOP to cancel.',
    reminderMessage24h:
      'Hi {{customerName}}, reminder: you have an appointment with {{businessName}} tomorrow at {{appointmentTime}}. Looking forward to seeing you!',
    reminderMessage2h:
      'Hi {{customerName}}, your appointment at {{businessName}} is in 2 hours at {{appointmentTime}}. See you soon!',
    noshowMessage:
      "We missed you at {{businessName}}! We'd love to reschedule. Call {{businessPhone}} or click here: {{rebookLink}}",
    rebookLink: 'https://calendly.com/bright-smile/rebook',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});

// Hair Salon
registerClientConfig({
  clientId: 'salon-1',
  businessName: 'The Hair Studio',
  businessPhone: '+1555234567',
  timezone: 'America/Chicago',
  reminders: {
    confirmationMessage:
      "Hey {{customerName}}! Your appointment is booked at {{businessName}} for {{appointmentTime}}. Can't wait to see you! 💇‍♀️",
    reminderMessage24h:
      'Hi {{customerName}}! Just a friendly reminder: you have your appointment tomorrow at {{appointmentTime}}. We look forward to pampering you!',
    reminderMessage2h: 'Hi {{customerName}}, you have your appointment in 2 hours! See you soon! ✨',
    noshowMessage:
      "We missed you! We'd love to reschedule your appointment at {{businessName}}. Call us at {{businessPhone}} or book directly: {{rebookLink}}",
    rebookLink: 'https://calendly.com/the-hair-studio/rebook',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});

// Med Spa
registerClientConfig({
  clientId: 'medspa-1',
  businessName: 'Glow Medical Spa',
  businessPhone: '+1555345678',
  timezone: 'America/Los_Angeles',
  reminders: {
    confirmationMessage:
      'Hi {{customerName}}, welcome to {{businessName}}! Your appointment is confirmed for {{appointmentTime}}. We look forward to helping you glow! ✨',
    reminderMessage24h:
      'Hi {{customerName}}, reminder: you have an appointment with us tomorrow at {{appointmentTime}}. Please arrive 10 minutes early.',
    reminderMessage2h:
      'Hi {{customerName}}, see you in 2 hours! Remember to avoid sun exposure before your appointment at {{appointmentTime}}.',
    noshowMessage:
      "We missed seeing you at {{businessName}}! We have special availability coming up. Call {{businessPhone}} to reschedule: {{rebookLink}}",
    rebookLink: 'https://calendly.com/glow-medspa/rebook',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});

// Fitness Studio (24h reminders only)
registerClientConfig({
  clientId: 'fitness-studio-1',
  businessName: 'PowerFit Gym',
  businessPhone: '+1555456789',
  timezone: 'America/Denver',
  reminders: {
    confirmationMessage:
      'Hi {{customerName}}, your class is booked! See you at {{businessName}} on {{appointmentTime}}. 💪',
    reminderMessage24h:
      "Hey {{customerName}}, don't forget your class with us tomorrow at {{appointmentTime}}! Let's get it! 🏋️",
    reminderMessage2h:
      "Your {{businessName}} class is coming up in 2 hours at {{appointmentTime}}! Don't miss out!",
    noshowMessage:
      "We missed you in class! We'd love to see you next time. Come back! Call {{businessPhone}} or reserve your next class: {{rebookLink}}",
    rebookLink: 'https://calendly.com/powerfit/classes',
  },
  schedules: {
    reminder24h: true,
    reminder2h: false, // Only 24h reminders
  },
});

// Veterinary Clinic
registerClientConfig({
  clientId: 'vet-clinic-1',
  businessName: 'Pawsitive Care Vet',
  businessPhone: '+1555567890',
  timezone: 'America/Austin',
  reminders: {
    confirmationMessage:
      'Hi {{customerName}}, your pet\'s appointment is confirmed at {{businessName}} for {{appointmentTime}}. See you soon! 🐾',
    reminderMessage24h:
      'Hi {{customerName}}, reminder: your pet has an appointment tomorrow at {{appointmentTime}}. Please bring vaccination records!',
    reminderMessage2h:
      'Hi {{customerName}}, your appointment is in 2 hours at {{appointmentTime}}. We\'re ready to take care of your furry friend!',
    noshowMessage:
      'We missed your furry friend at {{businessName}}! Please reschedule soon. Call {{businessPhone}}: {{rebookLink}}',
    rebookLink: 'https://calendly.com/pawsitive-care/reschedule',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});

export {};
