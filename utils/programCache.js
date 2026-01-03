const createProgramModel = require("../models/admin/masters/programModel");
const { defaultSequelize } = require("../config/db");

// Create Program model instance with default connection
const Program = createProgramModel(defaultSequelize);

const programCache = {};

async function loadPrograms() {
  const programs = await Program.findAll();
  programs.forEach(p => {
    programCache[p.program_desc] = p.programId;
  });
}

function getProgramId(desc) {
  return programCache[desc] || null;
}

module.exports = { loadPrograms, getProgramId };