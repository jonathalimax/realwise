'use strict';

const admin = require('firebase-admin');
admin.initializeApp();

exports.scheduledBillReminders = require('./clientScheduledBillReminders').scheduledBillReminders;
exports.markBillPaid = require('./markBillPaid').markBillPaid;
