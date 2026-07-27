// Shared onboarding questionnaire schema. Imported by BOTH the client form
// (/welcome) and the server-side operator alert email, so the questions and
// their labels never drift apart. Answers are stored as a flat { id: value }
// object in TrialSignup.onboardingDetails (JSON); this schema supplies the
// labels/grouping for rendering.

export type FieldType = 'text' | 'textarea' | 'radio' | 'select';

export interface OnboardingField {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
}

export interface OnboardingSection {
  title: string;
  fields: OnboardingField[];
}

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    title: 'Business basics',
    fields: [
      { id: 'description', label: 'Describe your business in 1–2 sentences', type: 'textarea', placeholder: 'e.g. Family-owned HVAC company serving the Dallas metro since 2009.' },
      { id: 'industry', label: 'What industry / trade are you in?', type: 'text', placeholder: 'Plumbing, salon, law firm…' },
      { id: 'hours', label: 'Hours of operation (include holidays / closures)', type: 'textarea', placeholder: 'Mon–Fri 8am–6pm, closed weekends & major holidays' },
      { id: 'webSocial', label: 'Website and social links', type: 'text', placeholder: 'yoursite.com, instagram.com/you' },
    ],
  },
  {
    title: 'Services & products',
    fields: [
      { id: 'services', label: 'List your services / products (add prices if you want them quoted)', type: 'textarea', placeholder: 'AC repair from $89, install quotes free…' },
      { id: 'notOffered', label: 'Anything you do NOT offer (so we never over-promise)', type: 'textarea', placeholder: 'We don’t do commercial jobs or duct cleaning' },
      { id: 'faqs', label: 'Common customer questions + your answers', type: 'textarea', placeholder: 'Q: Do you offer free estimates? A: Yes, always.' },
    ],
  },
  {
    title: 'Booking & scheduling',
    fields: [
      { id: 'takesAppointments', label: 'Do you take appointments?', type: 'radio', options: ['Yes', 'No'] },
      { id: 'bookingSystem', label: 'If yes, what system? (Calendly, Square, phone only…)', type: 'text', placeholder: 'Calendly' },
      { id: 'bookingMode', label: 'Should we book directly, or just collect info for staff to follow up?', type: 'radio', options: ['Book directly', 'Collect info only'] },
      { id: 'apptDuration', label: 'Typical appointment length / buffer rules', type: 'text', placeholder: '1 hr, 15 min buffer' },
    ],
  },
  {
    title: 'Lead capture',
    fields: [
      { id: 'leadInfo', label: 'What info should we collect from callers?', type: 'text', placeholder: 'Name, phone, reason for call, address' },
      { id: 'leadDestination', label: 'Where should leads go?', type: 'text', placeholder: 'Text to owner + email + Google Sheet' },
      { id: 'urgency', label: 'How should we flag emergencies vs routine calls?', type: 'textarea', placeholder: 'Water leak = call me immediately; everything else = daily summary' },
    ],
  },
  {
    title: 'Escalation',
    fields: [
      { id: 'escalation', label: 'When should we hand off to a live person immediately?', type: 'textarea', placeholder: 'Anyone mentioning “emergency” or “no heat”' },
      { id: 'notifyWho', label: 'Who gets notified, and how fast?', type: 'text', placeholder: 'Text Mike within 2 minutes' },
    ],
  },
  {
    title: 'Sample messages & scenarios',
    fields: [
      { id: 'exampleMessages', label: 'Example messages you’d like your customers to get', type: 'textarea', placeholder: 'Sorry we missed your call! We’ll be right with you — what do you need help with?' },
      { id: 'scenarios', label: 'Roleplay 2–3 real calls in your own words — a great lead, a tire-kicker, an angry customer — and how you’d ideally respond.', type: 'textarea', placeholder: 'Great lead: “Hi, my AC died”… I’d say…' },
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
