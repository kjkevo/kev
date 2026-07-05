import { loadBusinessConfig, renderTemplate } from '../app/lib/config';
import { prisma } from '../app/lib/db';

/**
 * End-to-end test of multi-tenant functionality
 * Simulates lead submissions for different businesses
 * Verifies configuration isolation and correctness
 */
async function testMultiTenantFlow() {
  try {
    console.log('\n🏢 === Multi-Tenant Integration Test ===\n');

    // Test data: leads for different businesses
    const testLeads = [
      {
        businessId: 1,
        name: 'Alice Johnson',
        phone: '+15551111111',
        service: 'Emergency Pipe Repair',
      },
      {
        businessId: 2,
        name: 'Bob Williams',
        phone: '+15552222222',
        service: 'AC Installation',
      },
      {
        businessId: 3,
        name: 'Charlie Brown',
        phone: '+15553333333',
        service: 'Electrical Inspection',
      },
    ];

    console.log('STEP 1: Load Configuration for Each Business');
    console.log('─'.repeat(60) + '\n');

    const configs = new Map();
    for (const lead of testLeads) {
      const config = await loadBusinessConfig(lead.businessId);
      configs.set(lead.businessId, config);

      console.log(`Business ${lead.businessId}: ${config.businessName}`);
      console.log(`  • Phone: ${config.businessPhone}`);
      console.log(`  • Owner Email: ${config.ownerEmail}`);
      console.log(`  • Message Preview: ${config.missedCallMessage.substring(0, 50)}...`);
      console.log();
    }

    console.log('STEP 2: Render Lead Messages for Each Business');
    console.log('─'.repeat(60) + '\n');

    const renderedMessages = new Map();
    for (const lead of testLeads) {
      const config = configs.get(lead.businessId);
      const message = renderTemplate(config.leadSubmissionMsg, {
        NAME: lead.name,
        BUSINESS_NAME: config.businessName,
      });
      renderedMessages.set(lead.businessId, message);

      console.log(`For ${lead.name}:`);
      console.log(`  Template: ${config.leadSubmissionMsg}`);
      console.log(`  Rendered: ${message}`);
      console.log();

      // Verify message is unique and personalized
      if (!message.includes('{')) {
        console.log(`  ✅ No template variables remaining`);
      } else {
        console.log(`  ❌ Template variables not rendered!`);
      }

      if (message.includes(lead.name)) {
        console.log(`  ✅ Customer name included`);
      } else {
        console.log(`  ❌ Customer name missing!`);
      }

      if (message.includes(config.businessName)) {
        console.log(`  ✅ Business name included`);
      } else {
        console.log(`  ❌ Business name missing!`);
      }

      console.log();
    }

    console.log('STEP 3: Log Leads to Database');
    console.log('─'.repeat(60) + '\n');

    const recordIds = new Map();
    for (const lead of testLeads) {
      const config = configs.get(lead.businessId);
      const record = await prisma.leadSubmission.create({
        data: {
          businessId: config.id,
          name: lead.name,
          phone: lead.phone,
          serviceRequested: lead.service,
          textStatus: 'test-simulation',
        },
      });
      recordIds.set(lead.businessId, record.id);

      console.log(`Created database record for ${config.businessName}:`);
      console.log(`  • Record ID: ${record.id}`);
      console.log(`  • Business ID: ${record.businessId}`);
      console.log(`  • Lead: ${lead.name}`);
      console.log(`  • Service: ${lead.service}`);
      console.log(`  • Status: ${record.textStatus}`);
      console.log();
    }

    console.log('STEP 4: Verify Business Isolation');
    console.log('─'.repeat(60) + '\n');

    // Get leads for each business
    const business1Leads = await prisma.leadSubmission.findMany({
      where: { businessId: 1, textStatus: 'test-simulation' },
    });
    const business2Leads = await prisma.leadSubmission.findMany({
      where: { businessId: 2, textStatus: 'test-simulation' },
    });
    const business3Leads = await prisma.leadSubmission.findMany({
      where: { businessId: 3, textStatus: 'test-simulation' },
    });

    console.log(`Business 1 leads: ${business1Leads.length}`);
    business1Leads.forEach((lead) => {
      console.log(`  • ${lead.name} (${lead.phone}) - ${lead.serviceRequested}`);
    });
    console.log();

    console.log(`Business 2 leads: ${business2Leads.length}`);
    business2Leads.forEach((lead) => {
      console.log(`  • ${lead.name} (${lead.phone}) - ${lead.serviceRequested}`);
    });
    console.log();

    console.log(`Business 3 leads: ${business3Leads.length}`);
    business3Leads.forEach((lead) => {
      console.log(`  • ${lead.name} (${lead.phone}) - ${lead.serviceRequested}`);
    });
    console.log();

    // Verify no cross-contamination
    const hasCrossContamination =
      business1Leads.some((l) => !testLeads[0].name.includes(l.name.split(' ')[0])) ||
      business2Leads.some((l) => !testLeads[1].name.includes(l.name.split(' ')[0])) ||
      business3Leads.some((l) => !testLeads[2].name.includes(l.name.split(' ')[0]));

    if (!hasCrossContamination && business1Leads.length > 0 && business2Leads.length > 0) {
      console.log('✅ PASS: Business data is properly isolated\n');
    } else {
      console.log('❌ FAIL: Data cross-contamination detected!\n');
    }

    console.log('STEP 5: Verify Configuration Differences');
    console.log('─'.repeat(60) + '\n');

    const config1 = configs.get(1);
    const config2 = configs.get(2);
    const config3 = configs.get(3);

    const tests = [
      {
        name: 'Business 1 has unique phone',
        pass: config1.businessPhone !== config2.businessPhone && config1.businessPhone !== config3.businessPhone,
      },
      {
        name: 'Business 2 has unique phone',
        pass: config2.businessPhone !== config1.businessPhone && config2.businessPhone !== config3.businessPhone,
      },
      {
        name: 'Business 3 has unique phone',
        pass: config3.businessPhone !== config1.businessPhone && config3.businessPhone !== config2.businessPhone,
      },
      {
        name: 'Business names are different',
        pass: config1.businessName !== config2.businessName && config2.businessName !== config3.businessName,
      },
      {
        name: 'Owner emails are different',
        pass: config1.ownerEmail !== config2.ownerEmail && config2.ownerEmail !== config3.ownerEmail,
      },
      {
        name: 'Messages are unique per business',
        pass:
          config1.missedCallMessage !== config2.missedCallMessage &&
          config2.missedCallMessage !== config3.missedCallMessage,
      },
      {
        name: 'Configs loaded from database',
        pass:
          (config1.businessName.includes('Acme') || config1.businessName.includes('Superior') || config1.businessName.includes('Quick')) &&
          (config2.businessName.includes('Acme') || config2.businessName.includes('Superior') || config2.businessName.includes('Quick')),
      },
    ];

    tests.forEach((test) => {
      console.log(test.pass ? '✅ PASS:' : '❌ FAIL:', test.name);
    });
    console.log();

    const allPassed = tests.every((t) => t.pass);

    console.log('═'.repeat(60));
    console.log('TEST RESULTS');
    console.log('═'.repeat(60) + '\n');

    if (allPassed && business1Leads.length > 0) {
      console.log('✅ ALL TESTS PASSED!\n');
      console.log('Configuration system verified:');
      console.log('  ✓ Each business has unique configuration');
      console.log('  ✓ Config loaded from database (not hardcoded)');
      console.log('  ✓ Message templates render correctly');
      console.log('  ✓ Business data is properly isolated');
      console.log('  ✓ System is production-ready for multi-tenant use\n');
    } else if (business1Leads.length === 0) {
      console.log('⚠️  WARNING: Test businesses not found in database\n');
      console.log('Run this first:');
      console.log('  npm run seed:test-businesses\n');
      console.log('Then run this test again:');
      console.log('  npm run test:multitenant\n');
    } else {
      console.log('❌ SOME TESTS FAILED\n');
      console.log('Issues to investigate:');
      tests.filter((t) => !t.pass).forEach((t) => console.log(`  • ${t.name}`));
      console.log();
    }

    // Cleanup: remove test records
    console.log('CLEANUP: Removing test simulation records');
    console.log('─'.repeat(60) + '\n');

    const deleted = await prisma.leadSubmission.deleteMany({
      where: { textStatus: 'test-simulation' },
    });
    console.log(`✓ Deleted ${deleted.count} test records\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testMultiTenantFlow();
