const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();

const { authen, author } = require("../../acc/protect-middleware");
const { ROLE } = require("../../acc/role");
const connection = require("../../../../db");

const axios = require("axios").default;
const readXlsxFile = require("read-excel-file/node");
const { bufferToStream, addTxid } = require("../utils");
const { parseExcel, addUniversityName, addStudentInfoByStudentId, preparePayload } = require("./helper");
const { hashObject, randomTxid } = require("../../../utils");
const { encrypt } = require("eciesjs");
const ObjectID = require("mongodb").ObjectID;
const { EDU_PROGRAM_ID } = require("../../../constance");

router.get("/5th-classes", authen, author(ROLE.STAFF), async (req, res) => {
  try {
    const coll = (await connection).db().collection("Class");
    const docs = await coll.find({ classGroup: 5 }).toArray();
    return res.json(docs);
  } catch (error) {
    console.error(error);
    return res.status(500).send(error);
  }
});

router.post("/issue-all", authen, author(ROLE.STAFF), async (req, res) => {
  try {
    const myprofileCol = (await connection).db().collection("MyUniversityProfile");
    const myProfile = await myprofileCol.findOne({});

    const claxx = req.body.claxx;
    const plains = claxx.students.map((student) => {
      return {
        name: student.name,
        birthday: student.birthday,
        gender: student.gender,
        university: myProfile.universityName,
        issusedate: Date.now(),
        headmaster: req.body.issuer,
        eduProgramName: EDU_PROGRAM_ID.PRIMARY,
        publicKey: student.publicKey,
      };
    });
    const ciphers = plains.map((plain) => encrypt(plain.publicKey, Buffer.from(JSON.stringify(plain))).toString("hex"));
    const hashes = plains.map((plain) => hashObject(plain));
    const certificates = claxx.students.map((student, sIndex) => {
      return {
        school: myProfile.universityName,
        eduProgramId: EDU_PROGRAM_ID.PRIMARY,
        studentPublicKey: student.publicKey,
        cipher: ciphers[sIndex],
        hash: hashes[sIndex],
      };
    });

    try {
      const response = await axios.post("/staff/create-certificates", {
        privateKeyHex: req.body.privateKeyHex,
        certificates: certificates,
      });
      console.log("cert response:", response.data);
      claxx.students.forEach((student) => {
        student.issueTxid = response.data.transactions.find((tx) => tx.studentPublicKey === student.publicKey).transactionId;
      });

      claxx.isIssued = true;
      claxx.issueDate = Date.now();
      claxx.issuer = req.body.issuer;
      const _id = claxx._id;
      delete claxx._id;
      const col = (await connection).db().collection("Class");
      const opResult = await col.updateOne({ _id: new ObjectID(_id) }, { $set: { ...claxx } });
      return res.json(claxx);
    } catch (error) {
      console.error(error);
      if (error.response) return res.status(502).send(error.response.data);
      else return res.status(500).send(error.toString());
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send(error);
  }
});

module.exports = router;
