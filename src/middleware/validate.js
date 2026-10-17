const { ZodError } = require('zod');
const { AppError } = require('../utils/errors');

/**
 * Middleware factory: validates req.body (or req.query) against a Zod schema.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query'} source - Where to read data from
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed; // Replace with parsed/coerced values
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({
          error: 'Validation failed',
          details,
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
