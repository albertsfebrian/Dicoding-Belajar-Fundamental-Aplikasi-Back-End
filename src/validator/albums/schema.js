const Joi = require('joi');

const currentYear = new Date().getFullYear();
const acceptedMimeType = ['image/apng', 'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];

const AlbumPayloadSchema = Joi.object({
  name: Joi.string().required(),
  year: Joi.number().integer().min(1900).max(currentYear)
    .required(),
});

const AlbumCoverSchema = Joi.object({
  'content-type': Joi.string().valid(...acceptedMimeType).required(),
}).unknown(true);

module.exports = { AlbumPayloadSchema, AlbumCoverSchema };
