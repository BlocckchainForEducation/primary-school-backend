const express = require("express");
const router = express.Router();

const { authen, author } = require("../../acc/protect-middleware");
const { ROLE } = require("../../acc/role");
const connection = require("../../../../db");
const ObjectID = require("mongodb").ObjectID;

//
router.get("/classes", authen, author(ROLE.TEACHER), async (req, res) => {
  const classCol = (await connection).db().collection("Class");
  const teacherCol = (await connection).db().collection("Teachers");
  const teacher = await teacherCol.findOne({ uid: new ObjectID(req.user.uid) });
  const classes = await classCol.find({ "teacher.teacherId": teacher.teacherId }).toArray();
  return res.json(classes);
});

module.exports = router;
