const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();

const { authen, author } = require("../../acc/protect-middleware");
const { ROLE } = require("../../acc/role");
const connection = require("../../../../db");

const readXlsxFile = require("read-excel-file/node");
const axios = require("axios").default;

const { bufferToStream, addKeyPairIfNeed } = require("../utils");
const { parseExcel, getTeacherById, getStudentsByIds, parseExcelV122 } = require("./helper");

const EDU_PROGRAM_ID = {
  PRIMARY: "Tiểu học cơ sở",
  SECONDARY: "Trung học cơ sở",
  HIGHT_SCHOOL: "Trung học phổ thông",
};

//
router.get("/classes", authen, author(ROLE.STAFF), async (req, res) => {
  try {
    const classCol = (await connection).db().collection("Class");
    const docs = await classCol.find({}).toArray();
    return res.json(docs);
  } catch (error) {
    console.error(error);
    return res.status(500).send(error.toString());
  }
});

//
router.post("/class-level-up", authen, author(ROLE.STAFF), async (req, res) => {
  try {
    const claxx = req.body.claxx;
    const privateKeyHex = req.body.privateKeyHex;

    const newClass = {};
    newClass.classId = Date.now().toString();
    newClass.classGroup = claxx.classGroup + 1;
    newClass.nameOfClass = req.body.nameOfClass;
    newClass.teacher = req.body.teacher;
    newClass.students = claxx.students.map((student) => {
      const { name, birthday, gender, locale, email, privateKey, publicKey, eduProgram } = student;
      return { name, birthday, gender, locale, email, privateKey, publicKey, eduProgram };
    });

    const classPayload = [
      {
        classId: newClass.classId,
        subjectId: newClass.classGroup.toString(),
        credit: newClass.classGroup,
        teacherPublicKey: newClass.teacher.publicKey,
        studentPublicKeys: newClass.students.map((student) => student.publicKey),
      },
    ];

    try {
      await axios.post("/staff/create-classes", { privateKeyHex, classes: classPayload });
      const col = (await connection).db().collection("Class");
      const opResult = await col.insertOne(newClass);
      return res.json({ opResult });
    } catch (error) {
      console.error(error);
      if (error.response) return res.status(502).send(error.response.data);
      else return res.status(500).send(error.toString());
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send(error.toString());
  }
});

router.post("/create-class", authen, author(ROLE.STAFF), async (req, res) => {
  try {
    const claxx = req.body.claxx;
    claxx.classId = Date.now().toString();
    console.log("🚧 --> router.post: /create-class --> claxx", claxx);
    addKeyPairIfNeed(claxx.students);
    claxx.students.forEach((student) => {
      student.eduProgram = {
        eduProgramId: EDU_PROGRAM_ID.PRIMARY,
        name: "Tiểu học cơ sở",
        totalCredit: 0,
        minYear: 0,
        maxYear: 0,
      };
    });

    // create student
    const profiles = claxx.students.map((student) => ({ publicKey: student.publicKey, eduProgram: student.eduProgram }));
    const privateKeyHex = req.body.privateKeyHex;
    try {
      await axios.post("/staff/create-students", { privateKeyHex, profiles });

      const classPayload = [
        {
          classId: claxx.classId,
          subjectId: claxx.classGroup.toString(),
          credit: claxx.classGroup,
          teacherPublicKey: claxx.teacher.publicKey,
          studentPublicKeys: claxx.students.map((student) => student.publicKey),
        },
      ];
      // create class
      await axios.post("/staff/create-classes", { privateKeyHex, classes: classPayload });
    } catch (error) {
      console.error(error);
      if (error.response) return res.status(502).send(error.response.data);
      return res.status(500).send(error.toString());
    }

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
