const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const pixelConfigSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
    },
    pixelId: {
      type: String,
      required: true,
      trim: true,
    },
    accessToken: {
      type: String,
      required: true,
      trim: true,
      private: true,
    },
    testCode: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
pixelConfigSchema.plugin(toJSON);
pixelConfigSchema.plugin(paginate);

/**
 * @typedef PixelConfig
 */
const PixelConfig = mongoose.model('PixelConfig', pixelConfigSchema);

module.exports = PixelConfig; 