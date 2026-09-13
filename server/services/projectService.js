const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function getDataPath(filename) {
  return path.join(DATA_DIR, filename);
}

function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Projects
function getAllProjects() {
  ensureDataDir();
  const data = readJSON(getDataPath('projects.json'));
  return data.projects || [];
}

function createProject(name) {
  ensureDataDir();
  const projects = getAllProjects();
  
  // Check for duplicate
  if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Project with this name already exists');
  }
  
  const newProject = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    settings: {},
    apiKeys: [],
    subscribers: [],
    domains: [],
    templates: [],
    branding: {
      primaryColor: '#6366F1',
      secondaryColor: '#8B5CF6',
      senderName: '',
      senderEmail: '',
      replyTo: ''
    }
  };
  
  projects.push(newProject);
  writeJSON(getDataPath('projects.json'), { projects });
  return newProject;
}

function switchProject(projectId) {
  const projects = getAllProjects();
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  // Update active project in data
  writeJSON(getDataPath('projects.json'), {
    projects,
    activeProjectId: projectId
  });
  
  return { project, projects };
}

function deleteProject(projectId) {
  const projects = getAllProjects();
  const index = projects.findIndex(p => p.id === projectId);
  
  if (index === -1) {
    throw new Error('Project not found');
  }
  
  const deleted = projects.splice(index, 1)[0];
  writeJSON(getDataPath('projects.json'), { projects });
  return deleted;
}

module.exports = { getAllProjects, createProject, switchProject, deleteProject };