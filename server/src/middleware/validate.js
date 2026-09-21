// Validates and REPLACES the given request part with the parsed (stripped, coerced) value,
// so controllers only ever see fields that were explicitly allowed by the schema.
export const validate = (schema, part = 'body') => (req, _res, next) => {
  try {
    const parsed = schema.parse(req[part]);
    if (part === 'query') {
      // Express 4 allows reassigning req.query; keep parsed copy separately as well.
      req.validatedQuery = parsed;
    }
    req[part] = parsed;
    next();
  } catch (err) {
    next(err);
  }
};
