import { prisma } from '../app/lib/db';

/**
 * Seed test businesses for multi-tenant configuration testing
 * This creates 3 fake businesses with distinct configurations
 * to verify the system works for different clients
 */
async function seedTestBusinesses() {
  try {
    console.log('\n🌱 === Creating Test Businesses ===\n');

    // Business 1: Acme Plumbing Co
    const business1 = await prisma.businessConfig.upsert({
      where: { id: 1 },
      update: {
        businessName: 'Acme Plumbing Co',
        businessPhone: '+15551111111',
        ownerPhone: '+15559999999',
        ownerEmail: 'owner@acmeplumbing.com',
        missedCallMessage:
          'Sorry we missed your call! Acme Plumbing will call you back shortly. Reply here if you'd like to send details now. [ACME]',
        leadSubmissionMsg:
          'Hi {NAME}! Thanks for reaching out to Acme Plumbing Co. We got your message and will reply shortly. [ACME]',
      },
      create: {
        id: 1,
        businessName: 'Acme Plumbing Co',
        businessPhone: '+15551111111',
        ownerPhone: '+15559999999',
        ownerEmail: 'owner@acmeplumbing.com',
        missedCallMessage:
          'Sorry we missed your call! Acme Plumbing will call you back shortly. Reply here if you'd like to send details now. [ACME]',
        leadSubmissionMsg:
          'Hi {NAME}! Thanks for reaching out to Acme Plumbing Co. We got your message and will reply shortly. [ACME]',
      },
    });
    console.log('✓ Business 1 (ID 1):', business1.businessName);
    console.log('  Phone:', business1.businessPhone);
    console.log('  Email:', business1.ownerEmail);
    console.log('  Message suffix: [ACME]\n');

    // Business 2: Superior HVAC Services (SECOND BUSINESS - different config)
    let business2;
    try {
      business2 = await prisma.businessConfig.create({
        data: {
          businessName: 'Superior HVAC Services',
          businessPhone: '+15552222222',
          ownerPhone: '+15558888888',
          ownerEmail: 'owner@superiorhvac.com',
          missedCallMessage:
            'We missed your call! Superior HVAC will call you back shortly. Reply here to send your details. [SUPERIOR]',
          leadSubmissionMsg:
            'Hi {NAME}! Thanks for contacting Superior HVAC Services. We got your message and will respond shortly. [SUPERIOR]',
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Unique constraint, update instead
        business2 = await prisma.businessConfig.update({
          where: { businessName: 'Superior HVAC Services' },
          data: {
            businessPhone: '+15552222222',
            ownerPhone: '+15558888888',
            ownerEmail: 'owner@superiorhvac.com',
            missedCallMessage:
              'We missed your call! Superior HVAC will call you back shortly. Reply here to send your details. [SUPERIOR]',
            leadSubmissionMsg:
              'Hi {NAME}! Thanks for contacting Superior HVAC Services. We got your message and will respond shortly. [SUPERIOR]',
          },
        });
      } else {
        throw e;
      }
    }
    console.log('✓ Business 2 (ID ' + business2.id + '):', business2.businessName);
    console.log('  Phone:', business2.businessPhone);
    console.log('  Email:', business2.ownerEmail);
    console.log('  Message suffix: [SUPERIOR]\n');

    // Business 3: Quick Electric (THIRD BUSINESS - more reusability test)
    let business3;
    try {
      business3 = await prisma.businessConfig.create({
        data: {
          businessName: 'Quick Electric',
          businessPhone: '+15553333333',
          ownerPhone: '+15557777777',
          ownerEmail: 'owner@quickelectric.com',
          missedCallMessage:
            'Quick Electric missed your call! We'll be back shortly. Need fast help? Reply here. [QUICK]',
          leadSubmissionMsg:
            'Hi {NAME}! Quick Electric received your request. We'll get back to you right away. [QUICK]',
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        business3 = await prisma.businessConfig.update({
          where: { businessName: 'Quick Electric' },
          data: {
            businessPhone: '+15553333333',
            ownerPhone: '+15557777777',
            ownerEmail: 'owner@quickelectric.com',
            missedCallMessage:
              'Quick Electric missed your call! We'll be back shortly. Need fast help? Reply here. [QUICK]',
            leadSubmissionMsg:
              'Hi {NAME}! Quick Electric received your request. We'll get back to you right away. [QUICK]',
          },
        });
      } else {
        throw e;
      }
    }
    console.log('✓ Business 3 (ID ' + business3.id + '):', business3.businessName);
    console.log('  Phone:', business3.businessPhone);
    console.log('  Email:', business3.ownerEmail);
    console.log('  Message suffix: [QUICK]\n');

    console.log('✅ === Test Businesses Created! ===\n');
    console.log('Use these businessId values for testing:');
    console.log(`  curl -X POST http://localhost:3000/api/webhooks/lead-submission \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"name":"Test","phone":"+15551234567","serviceRequested":"Test","businessId":1}'`);
    console.log(`\nOr test Business 2:`);
    console.log(`  curl ... -d '{"name":"Test","phone":"+15551234567","serviceRequested":"Test","businessId":${business2.id}}'`);
    console.log(`\nOr test Business 3:`);
    console.log(`  curl ... -d '{"name":"Test","phone":"+15551234567","serviceRequested":"Test","businessId":${business3.id}}'`);
    console.log();
  } catch (error) {
    console.error('❌ Error seeding businesses:', error);
    process.exit(1);
  }
}

seedTestBusinesses();
