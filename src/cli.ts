#!/usr/bin/env node
/**
 * LGTM Agent Skills CLI
 * 
 * Usage:
 *   lgtm validate <skill-path>        Validate a skill against the spec
 *   lgtm scan <skill-path>            Security scan a skill
 *   lgtm scaffold <name>              Create a new skill template
 *   lgtm deps <skills-dir>            Check for circular dependencies
 *   lgtm analyze <skills-dir>         Full analysis pipeline
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SpecValidator,
  SecurityScanner,
  SkillScaffolder,
  CircularDependencyDetector,
  SkillIntelligencePipeline,
  RawSkill
} from './skill-intelligence.js';

const args = process.argv.slice(2);
const command = args[0];

function parseSkillMd(filePath: string): RawSkill {
  const content = fs.readFileSync(filePath, 'utf-8');
  const dirName = path.basename(path.dirname(filePath));
  
  // Parse frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, unknown> = {};
  
  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        frontmatter[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
  
  return {
    name: (frontmatter.name as string) || dirName,
    description: (frontmatter.description as string) || '',
    content,
    source: { repo: 'local', provider: 'local', priority: 1 },
    path: filePath,
    directoryName: dirName,
    frontmatter,
    hasScriptsDir: fs.existsSync(path.join(path.dirname(filePath), 'scripts')),
    hasReferencesDir: fs.existsSync(path.join(path.dirname(filePath), 'references')),
    hasAssetsDir: fs.existsSync(path.join(path.dirname(filePath), 'assets'))
  };
}

async function main() {
  switch (command) {
    case 'validate': {
      const skillPath = args[1];
      if (!skillPath) {
        console.error('Usage: lgtm validate <skill-path>');
        process.exit(1);
      }
      
      const skillMdPath = skillPath.endsWith('SKILL.md') 
        ? skillPath 
        : path.join(skillPath, 'SKILL.md');
        
      if (!fs.existsSync(skillMdPath)) {
        console.error(`SKILL.md not found at ${skillMdPath}`);
        process.exit(1);
      }
      
      const skill = parseSkillMd(skillMdPath);
      const validator = new SpecValidator();
      const result = validator.validate(skill);
      
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const w of result.warnings) {
          console.log(`  ⚠ [${w.field}] ${w.rule}`);
          if (w.actual) console.log(`    Actual: ${w.actual}`);
        }
      }
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        for (const e of result.errors) {
          console.log(`  ✗ [${e.field}] ${e.rule}`);
          if (e.actual) console.log(`    Actual: ${e.actual}`);
        }
      }
      
      if (result.isValid) {
        console.log(`\n✓ Skill '${skill.name}' is valid`);
        process.exit(0);
      } else {
        console.log(`\n✗ Skill '${skill.name}' has validation errors`);
        process.exit(1);
      }
      break;
    }
    
    case 'scan': {
      const skillPath = args[1];
      if (!skillPath) {
        console.error('Usage: lgtm scan <skill-path>');
        process.exit(1);
      }
      
      const skillMdPath = skillPath.endsWith('SKILL.md') 
        ? skillPath 
        : path.join(skillPath, 'SKILL.md');
        
      if (!fs.existsSync(skillMdPath)) {
        console.error(`SKILL.md not found at ${skillMdPath}`);
        process.exit(1);
      }
      
      const skill = parseSkillMd(skillMdPath);
      const scanner = new SecurityScanner();
      const evaluation = await scanner.evaluate(skill);
      
      console.log('\nSecurity Scan Results:');
      console.log('─'.repeat(40));
      
      for (const obs of evaluation.observations || []) {
        console.log(`  ${obs}`);
      }
      
      if (evaluation.suggestions && evaluation.suggestions.length > 0) {
        console.log('\nFindings:');
        for (const sug of evaluation.suggestions) {
          console.log(`  ${sug}`);
        }
      }
      
      const score = evaluation.scores?.security?.score ?? 100;
      if (score === 100) {
        console.log('\n✓ No security issues detected');
        process.exit(0);
      } else {
        console.log(`\n⚠ Security score: ${score}/100`);
        process.exit(1);
      }
      break;
    }
    
    case 'scaffold': {
      const name = args[1];
      const outputDir = args[2] || '.';
      
      if (!name) {
        console.error('Usage: lgtm scaffold <name> [output-dir]');
        process.exit(1);
      }
      
      const scaffolder = new SkillScaffolder();
      const nameValidation = scaffolder.validateName(name);
      
      if (!nameValidation.valid) {
        console.error('Invalid skill name:');
        for (const err of nameValidation.errors) {
          console.error(`  - ${err}`);
        }
        process.exit(1);
      }
      
      const result = scaffolder.scaffold({
        name,
        includeTests: true,
        includeReferences: true
      });
      
      const skillDir = path.join(outputDir, name);
      fs.mkdirSync(skillDir, { recursive: true });
      
      // Create directories
      for (const dir of result.directories) {
        fs.mkdirSync(path.join(skillDir, dir), { recursive: true });
      }
      
      // Write SKILL.md
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), result.skillMd);
      console.log(`Created ${path.join(skillDir, 'SKILL.md')}`);
      
      // Write test cases
      if (result.testCasesYaml) {
        fs.writeFileSync(path.join(skillDir, 'test', 'cases.yaml'), result.testCasesYaml);
        console.log(`Created ${path.join(skillDir, 'test', 'cases.yaml')}`);
      }
      
      console.log(`\n✓ Scaffolded skill '${name}' at ${skillDir}`);
      break;
    }
    
    case 'deps': {
      const skillsDir = args[1] || '.';
      
      // Find all SKILL.md files
      const skills: RawSkill[] = [];
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
          if (fs.existsSync(skillMdPath)) {
            skills.push(parseSkillMd(skillMdPath));
          }
        }
      }
      
      if (skills.length === 0) {
        console.log('No skills found in', skillsDir);
        process.exit(0);
      }
      
      const detector = new CircularDependencyDetector();
      const result = detector.check(skills);
      
      console.log(`\nAnalyzed ${skills.length} skills`);
      console.log('─'.repeat(40));
      
      // Show dependency graph
      console.log('\nDependency Graph:');
      for (const [name, info] of Object.entries(result.graph)) {
        const version = info.version ? `@${info.version}` : '';
        console.log(`\n${name}${version}`);
        if (info.requires.length > 0) {
          for (const dep of info.requires) {
            const present = dep in result.graph ? '✓' : '✗';
            console.log(`  └── ${present} ${dep}`);
          }
        } else {
          console.log('  └── (no dependencies)');
        }
      }
      
      if (result.hasCircular) {
        console.log('\n⚠ Circular dependencies detected:');
        for (const cycle of result.cycles) {
          console.log(`  ${cycle.join(' → ')}`);
        }
        process.exit(1);
      } else {
        console.log('\n✓ No circular dependencies found');
        process.exit(0);
      }
      break;
    }
    
    default:
      console.log(`
LGTM Agent Skills - Validation & Security Scanner

Usage:
  lgtm validate <skill-path>     Validate a skill against the spec
  lgtm scan <skill-path>         Security scan a skill
  lgtm scaffold <name> [dir]     Create a new skill template
  lgtm deps <skills-dir>         Check for circular dependencies

Examples:
  lgtm validate ./my-skill
  lgtm scan ./my-skill/SKILL.md
  lgtm scaffold my-new-skill ./skills
  lgtm deps ./skills
      `);
      process.exit(command ? 1 : 0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
