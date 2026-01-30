/**
 * Test the Skills Registry feature
 * 
 * This script demonstrates how to:
 * 1. Update the local registry from skills.sh API
 * 2. List known skills from the registry
 * 3. Check a skill for duplicates
 */

import {
  SkillsRegistryManager,
  RegistryDuplicateDetector,
  updateSkillsRegistry,
  listRegistrySkills,
  checkDuplicatesAgainstRegistry,
  SKILLS_SH_API,
} from '../src/registry.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Skills Registry Test (skills.sh API)                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`📡 Data source: ${SKILLS_SH_API.baseUrl}${SKILLS_SH_API.endpoints.skills}`);
  console.log(`   Max skills: ${SKILLS_SH_API.maxTotalSkills}`);
  console.log();

  // Update registry
  console.log('🔄 Updating skills registry from skills.sh...');
  try {
    const stats = await updateSkillsRegistry();
    console.log(`   ✅ Fetched: ${stats.updated} skills`);
    console.log(`   ⏱️  Fetch time: ${stats.fetchTime}ms`);
  } catch (error) {
    console.log(`   ⚠️  Update failed: ${error}`);
    console.log('   (This is expected if skills.sh is down or you\'re offline)');
  }
  console.log();

  // List skills in registry
  console.log('📋 Top skills in registry (by installs):');
  const skills = await listRegistrySkills();
  if (skills.length === 0) {
    console.log('   (No skills in registry yet)');
  } else {
    // Sort by installs and show top 15
    const topSkills = [...skills]
      .sort((a, b) => (b.installs || 0) - (a.installs || 0))
      .slice(0, 15);
    
    for (const skill of topSkills) {
      const installs = skill.installs ? `${(skill.installs / 1000).toFixed(1)}K installs` : '';
      console.log(`   - ${skill.name} (${skill.source}) ${installs}`);
    }
    if (skills.length > 15) {
      console.log(`   ... and ${skills.length - 15} more skills`);
    }
  }
  console.log();

  // Test duplicate detection with a sample skill
  console.log('🔍 Testing duplicate detection with sample skills...\n');
  
  // Test 1: A unique skill
  const testSkill1 = {
    name: 'github-search',
    description: 'Search GitHub repositories, issues, and code',
    instructions: 'Use this skill to search for code on GitHub...',
    parameters: {},
  };

  console.log(`   Test 1: "${testSkill1.name}"`);
  console.log(`   Description: ${testSkill1.description}`);

  const result1 = await checkDuplicatesAgainstRegistry(testSkill1);
  
  if (result1.hasDuplicates) {
    console.log('   ⚠️  Potential duplicates found:');
    for (const match of result1.matches) {
      console.log(`      - ${match.skill.name} (${match.matchType})`);
      console.log(`        From: ${match.skill.source}`);
      console.log(`        Similarity: ${(match.similarity * 100).toFixed(1)}%`);
    }
  } else {
    console.log('   ✅ No duplicates found - skill appears original!');
  }
  console.log();

  // Test 2: A skill that might match Anthropic's brand-guidelines
  const testSkill2 = {
    name: 'brand-guidelines',
    description: 'Applies brand colors and typography to documents',
    instructions: 'Use this skill to apply brand styling...',
    parameters: {},
  };

  console.log(`   Test 2: "${testSkill2.name}"`);
  console.log(`   Description: ${testSkill2.description}`);

  const result2 = await checkDuplicatesAgainstRegistry(testSkill2);
  
  if (result2.hasDuplicates) {
    console.log('   ⚠️  Potential duplicates found:');
    for (const match of result2.matches) {
      console.log(`      - ${match.skill.name} (${match.matchType})`);
      console.log(`        From: ${match.skill.source}`);
      console.log(`        Similarity: ${(match.similarity * 100).toFixed(1)}%`);
    }
  } else {
    console.log('   ✅ No duplicates found - skill appears original!');
  }
  console.log();

  // Test 3: A skill with similar description to existing React skills
  const testSkill3 = {
    name: 'react-performance-tips',
    description: 'React and Next.js performance optimization best practices',
    instructions: 'Use this skill to optimize React apps...',
    parameters: {},
  };

  console.log(`   Test 3: "${testSkill3.name}"`);
  console.log(`   Description: ${testSkill3.description}`);

  const result3 = await checkDuplicatesAgainstRegistry(testSkill3);
  
  if (result3.hasDuplicates) {
    console.log('   ⚠️  Potential duplicates found:');
    for (const match of result3.matches) {
      console.log(`      - ${match.skill.name} (${match.matchType})`);
      console.log(`        From: ${match.skill.source}`);
      console.log(`        Similarity: ${(match.similarity * 100).toFixed(1)}%`);
    }
  } else {
    console.log('   ✅ No duplicates found - skill appears original!');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('Test complete!');
}

main().catch(console.error);
