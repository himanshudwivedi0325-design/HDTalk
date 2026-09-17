const { z } = require('zod');

/**
 * Reusable Zod Validation Middleware
 * Validates req.body, req.query, and req.params against provided Zod schemas.
 * On validation failure, rejects immediately with a generic HTTP 400 Bad Request.
 *
 * @param {Object} schemas
 * @param {z.ZodSchema} [schemas.body]
 * @param {z.ZodSchema} [schemas.query]
 * @param {z.ZodSchema} [schemas.params]
 */
const validate = (schemas = {}) => {
  return (req, res, next) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issueList = err.issues || err.errors || [];
        return res.status(400).json({
          success: false,
          message: 'Invalid request data.',
          errors: issueList.map(e => ({
            field: (e.path || []).join('.'),
            message: e.message
          }))
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid request data.'
      });
    }
  };
};

module.exports = validate;
