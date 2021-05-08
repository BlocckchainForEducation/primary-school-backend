const axios = require("axios").default;

function parseExcel(rows) {
  // skip header
  rows.shift();
  return rows.map((row) => ({
    // school: row[0],
    // department: row[1],
    teacherId: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    publicKey: row[4],
  }));
}

function preparePayload(teachers) {
  return teachers.map((teacher) => {
    let { teacherId, name, publicKey } = teacher;
    return { teacherId, name, publicKey };
  });
}

async function sendToBKC(payload, privateKeyHex) {
  return axios.post("/staff/create-teachers", {
    privateKeyHex,
    profiles: payload,
  });
}

module.exports = { parseExcel, preparePayload, sendToBKC };
