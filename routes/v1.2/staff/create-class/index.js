const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();

const { authen, author } = require("../../acc/protect-middleware");
const { ROLE } = require("../../acc/role");
const connection = require("../../../../db");

const readXlsxFile = require("read-excel-file/node");
const axios = require("axios").default;

const { bufferToStream } = require("../utils");
const { parseExcel, getTeacherById, getStudentsByIds, parseExcelV122 } = require("./helper");

//
router.get("/classes", authen, author(ROLE.STAFF), async (req, res) => {
  const classCol = (await connection).db().collection("Class");
  const docs = await classCol.find({}).toArray();
  return res.json(docs);
});

router.post("/create-class", authen, author(ROLE.STAFF), async (req, res) => {
  try {
    const claxx = req.body.claxx;
    const col = (await connection).db().collection("Class");
    const opResult = await col.insertOne(claxx);
    return res.json({ opResult });
  } catch (error) {
    console.error(error);
    return res.status(500).send(error);
  }
});

// v1.2.2
router.post("/upload-classes", authen, author(ROLE.STAFF), upload.single("excel-file"), async (req, res) => {
  try {
    const rows = await readXlsxFile(bufferToStream(req.file.buffer));
    const records = parseExcelV122(rows);

    // pre-join students' info, teacher info,
    const classesPromises = records.map(async (claxx) => {
      // TODO: if not found item, --> res to FE to notif user
      claxx.teacher = await getTeacherById(claxx.teacherId);
      claxx.students = await getStudentsByIds(claxx.studentIds);
      return claxx;
    });
    let classes = await Promise.all(classesPromises);

    //
    const payload = classes.map((cls) => ({
      classId: cls.classId,
      subjectId: cls.subject.subjectId,
      credit: cls.subject.credit,
      teacherPublicKey: cls.teacher.publicKey,
      studentPublicKeys: cls.students.map((std) => std.publicKey),
    }));

    try {
      const response = await axios.post("/staff/create-classes", {
        privateKeyHex: req.body.privateKeyHex,
        classes: payload,
      });
      classes.forEach((clx) => {
        clx.txid = response.data.transactions.find((tx) => tx.classId === clx.classId).transactionId;
      });

      const classCol = (await connection).db().collection("Class");
      const result = await classCol.insertMany(classes);
      return res.json(result.ops);
    } catch (error) {
      console.error(error);
      if (error.response) return res.status(502).send(error.response.data);
      return res.status(500).send(error.toString());
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send(error.toString());
  }
});

module.exports = router;
