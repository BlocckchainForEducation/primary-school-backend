const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const { authen, author } = require("../../acc/protect-middleware");
const connection = require("../../../../db");
const { ROLE } = require("../../acc/role");
const ObjectID = require("mongodb").ObjectID;

router.get("/profile", authen, author(ROLE.TEACHER), async (req, res) => {
  try {
    const col = (await connection).db().collection("Teachers");
    const doc = await col.findOne({ uid: new ObjectID(req.user.uid) });
    return res.json(doc);
  } catch (error) {
    return res.status(500).send(error.toString());
  }
});
router.post("/change-avatar", authen, author(ROLE.TEACHER), upload.single("avatar"), async (req, res) => {
  try {
    const col = (await connection).db().collection("Teachers");
    const imgBase64 = req.file.buffer.toString("base64");
    const imgSrc = `data:${req.file.mimetype};base64,${imgBase64}`;
    const opResult = await col.updateOne({ "profiles.uid": new ObjectID(req.user.uid) }, { $set: { "profiles.$.imgSrc": imgSrc } });
    opResult.result.ok ? res.json(imgSrc) : res.json(opResult);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

module.exports = router;
