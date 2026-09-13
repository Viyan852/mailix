#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function listProjects() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    console.log('No projects found. Create one with: mailix init <name>');
    return;
  }
  const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  if (!data.projects || data.projects.length === 0) {
    console.log('No projects found.');
    return;
  }
  console.log('Projects:');
  for (const project of data.projects) {
    console.log(`  - ${project.name} (${project.id})`);
  }
}

function createProject(name) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  let data = { projects: [] };
  if (fs.existsSync(PROJECTS_FILE)) {
    data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  }
  const crypto = require('crypto');
  const project = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString()
  };
  data.projects.push(project);
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
  console.log(`Project "${name}" created.`);
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'list' || !cmd) {
  listProjects();
} else if (cmd === 'create' && args[1]) {
  createProject(args[1]);
} else {
  console.log('Usage: mailix projects [list|create <name>]');
}