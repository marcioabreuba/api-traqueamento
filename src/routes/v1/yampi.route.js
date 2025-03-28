const express = require('express');
const yampiController = require('../../controllers/yampi.controller');
const auth = require('../../middlewares/auth');

const router = express.Router();

router
  .route('/webhook')
  .post(yampiController.processWebhook);

module.exports = router; 