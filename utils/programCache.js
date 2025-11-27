const Program = require("../models/admin/masters/programModel");

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