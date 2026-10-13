const Joi = require('joi');

const STATUSES = ['upcoming', 'completed', 'no-show', 'cancelled', 'blocked'];
const ROLES = ['admin', 'tutor', 'student'];

const credentials = Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).max(255).required(),
    password: Joi.string().min(8).max(128).required()
});

// Login only checks shape, so a wrong password gets a normal 401, not a 400.
const login = Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).max(255).required(),
    password: Joi.string().max(128).required()
});

const adminCreateUser = credentials.keys({
    role: Joi.string().valid(...ROLES).required()
});

const createSession = Joi.object({
    // Ignored for tutors (the server uses their own id), required for admins.
    tutor_id: Joi.number().integer().positive(),
    student_id: Joi.number().integer().positive().allow(null),
    session_date: Joi.date().iso().required(),
    duration: Joi.number().integer().min(15).max(1440).required(),
    status: Joi.string().valid(...STATUSES).default('upcoming'),
    notes: Joi.string().max(500).allow('')
}).custom((value, helpers) => {
    // A real session needs a student; only blocked time can have none.
    if (value.status !== 'blocked' && !value.student_id) {
        return helpers.message('student_id is required unless status is "blocked"');
    }
    return value;
});

// Only the fields sent are updated, so marking a session completed
// no longer wipes its rating and feedback.
const updateSession = Joi.object({
    status: Joi.string().valid(...STATUSES),
    rating: Joi.number().integer().min(1).max(5).allow(null),
    feedback_notes: Joi.string().max(2000).allow('', null),
    notes: Joi.string().max(500).allow('', null)
}).min(1);

// Runs a Joi schema against req.body and replaces it with the cleaned value.
const validateBody = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, { stripUnknown: true });
    if (error) {
        return res.status(400).json({ error: 'Invalid request data', details: error.details[0].message });
    }
    req.body = value;
    next();
};

module.exports = { credentials, login, adminCreateUser, createSession, updateSession, validateBody };
