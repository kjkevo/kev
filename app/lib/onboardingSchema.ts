// Shared onboarding questionnaire schema. Imported by BOTH the client form
// (/welcome) and the server-side operator alert email, so the questions and
// their labels never drift apart. Answers are stored as a flat { id: value }
// object in TrialSignup.onboardingDetails (JSON); chip fields store their picks
// as a comma-joined string so this stays a flat string map. This schema also
// drives the /welcome multi-step wizard: section order = step order, and
// `optional` sections can be skipped. `channel` hides a field unless the
// client's chosen service matches (voice-only / text-only questions).

export type FieldType = 'text' | 'textarea' | 'radio' | 'chips';
export type Channel = 'voice' | 'text' | 'both';

export interface OnboardingField {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  // 'both' (or unset) always shows; 'voice'/'text' show only when the service
  // includes that channel.
  channel?: Channel;
}

export interface OnboardingSection {
  title: string;
  // Optional sections can be skipped in the wizard (deferred to "finish later").
  optional?: boolean;
  // Short wizard label for the progress bar.
  stepLabel: string;
  fields: OnboardingField[];
}

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    title: 'Business basics',
    stepLabel: 'Business',
    fields: [
      { id: 'industry', label: 'What industry or trade are you in?', type: 'text', placeholder: 'Plumbing, salon, law firm', required: true },
      { id: 'description', label: 'Describe your business in 1 or 2 sentences', type: 'textarea', placeholder: 'e.g. Family owned HVAC company serving the Dallas metro since 2009.' },
      { id: 'websiteUrl', label: 'Website (we can pull details from it later)', type: 'text', placeholder: 'yoursite.com' },
      { id: 'address', label: 'Street address', type: 'text', placeholder: '123 Main St' },
      { id: 'city', label: 'City', type: 'text', placeholder: 'Chicago' },
      { id: 'state', label: 'State', type: 'text', placeholder: 'IL' },
      { id: 'zip', label: 'Zip code', type: 'text', placeholder: '60601' },
      { id: 'country', label: 'Country', type: 'text', placeholder: 'United States' },
      { id: 'additionalInfo', label: 'Any additional information', type: 'textarea', placeholder: 'Anything else we should know about your business' },
    ],
  },
  {
    title: 'How we handle your calls',
    stepLabel: 'Polish',
    optional: true,
    fields: [
      { id: 'businessPhone', label: 'Business phone number', type: 'text', placeholder: 'The number your customers call', channel: 'both' },
      { id: 'personalPhone', label: 'Your personal phone number', type: 'text', placeholder: 'Where we send you alerts', channel: 'both' },
      { id: 'personalEmail', label: 'Your personal email', type: 'text', placeholder: 'you@gmail.com', channel: 'both' },
      { id: 'exampleMessages', label: 'An example message you would like customers to get', type: 'textarea', placeholder: 'Sorry we missed your call! We will be right with you. What do you need?', channel: 'text' },
      { id: 'hours', label: 'Hours of operation', type: 'text', placeholder: 'Mon to Fri 8am to 6pm, closed weekends', channel: 'both' },
      { id: 'emergencyNotify', label: 'What counts as an emergency, and who should we notify?', type: 'textarea', placeholder: 'Anyone saying no heat or leak, text Mike within 2 minutes', channel: 'both' },
      { id: 'leadInfo', label: 'What should we collect from callers?', type: 'chips', options: ['Name', 'Phone', 'Reason for call', 'Address'], channel: 'both' },
      { id: 'leadDestination', label: 'Where should leads go?', type: 'chips', options: ['Text me', 'Email'], channel: 'both' },
      { id: 'capabilities', label: 'Requested capabilities (what should your assistant be able to do?)', type: 'chips', options: ['Transfer to a person', 'Schedule appointments', 'Reschedule appointments', 'Cancel appointments', 'Answer common questions', 'Take a message'], channel: 'both' },
    ],
  },
];

// Flatten to id -> {section, label} for rendering stored answers with context.
export const FIELD_LABELS: Record<string, { section: string; label: string }> = (() => {
  const map: Record<string, { section: string; label: string }> = {};
  for (const section of ONBOARDING_SECTIONS) {
    for (const f of section.fields) map[f.id] = { section: section.title, label: f.label };
  }
  return map;
})();
