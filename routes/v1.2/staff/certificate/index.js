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
    const claxx = req.body.claxx;
    const col = (await connection).db().collection("Class");
    // prepare payload, send to bkc, postprocess...
    claxx.students.forEach((student) => {
      student.issueTxid = randomTxid();
    });
    claxx.isIssued = true;
    claxx.issueDate = Date.now();
    claxx.issuer = req.body.issuer || "Huỳnh Quyết Thắng";
    const _id = claxx._id;
    delete claxx._id;
    const opResult = await col.updateOne({ _id: new ObjectID(_id) }, { $set: { ...claxx } });
    return res.json(claxx);
  } catch (error) {
    console.error(error);
    return res.status(500).send(error);
  }
});

module.exports = router;
