const express = require("express");
const router = express.Router();

router.use(require("./register"));
router.use(require("./upload-teacher"));
router.use(require("./create-class"));
router.use(require("./certificate"));

module.exports = router;
