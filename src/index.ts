import type { ErrorRequestHandler, Handler } from "express"

/**
 * Express error handler middleware that catches and processes throwable responses.
 * 
 * This middleware should be added to your Express app after all routes but before
 * other error handlers. It catches instances of ThrowableResponse and executes
 * their handler functions to send the appropriate HTTP response.
 * 
 * @example
 * ```typescript
 * import express from 'express'
 * import throwableResponses from 'throw-res'
 * 
 * const app = express()
 * 
 * // Your routes here...
 * 
 * // Add throwable responses handler
 * app.use(throwableResponses)
 * 
 * // Other error handlers...
 * ```
 */
const throwableResponses: ErrorRequestHandler = (err, req, res, next) => {
    if (err instanceof ThrowableResponse) err.handler(req, res, next)
    else next(err)
}

export default throwableResponses

/**
 * Base class for creating throwable HTTP responses.
 * 
 * This class extends Error to leverage JavaScript's exception handling mechanism
 * for HTTP response flow control. When thrown, the error handler will execute
 * the provided handler function to send the HTTP response.
 * 
 * @example
 * ```typescript
 * // Send HTML content
 * throw new ThrowableResponse(
 *   (_, res) => res.type('html').send('<div>Hello World</div>')
 * )
 * 
 * // Send text with custom headers
 * throw new ThrowableResponse(
 *   (_, res) => res.set('Cache-Control', 'no-cache').text('Plain text response')
 * )
 * 
 * // Custom error page
 * app.get('/admin', (req, res) => {
 *   if (!req.user?.isAdmin) {
 *     throw new ThrowableResponse(
 *       (_, res) => res.status(403).type('html').send(`
 *         <h1>Access Denied</h1>
 *         <p>You don't have permission to access this page.</p>
 *       `)
 *     )
 *   }
 *   res.render('admin-dashboard')
 * })
 * ```
 */
export class ThrowableResponse extends Error {
    /**
     * Creates a new throwable response.
     * 
     * @param handler - Express handler function that must terminate the response.
     *                  This function receives (req, res, next) and should call
     *                  appropriate response methods like res.json(), res.redirect(), etc.
     * @param messageForErrorConstructor - Optional error message for debugging purposes.
     *                                   Defaults to a generic message if not provided.
     * 
     * @example
     * ```typescript
     * const customResponse = new ThrowableResponse(
     *   (req, res) => res.status(418).send("I'm a teapot"),
     *   "Teapot response"
     * )
     * throw customResponse
     * ```
     */
    constructor(
        public handler: Handler,
        messageForErrorConstructor?: string,
    ) {
        super(messageForErrorConstructor ?? "Not an error: response thrown")
    }
}

/**
 * Throwable response for HTTP redirects.
 * 
 * Creates a throwable response that redirects the client to a different URL
 * with the specified HTTP status code. Supports all standard redirect status codes.
 * 
 * @example
 * ```typescript
 * // Simple redirect (defaults to 302)
 * throw new ThrowableRedirect('/login')
 * ```
 */
export class ThrowableRedirect extends ThrowableResponse {
    /**
     * Creates a new throwable redirect response.
     * 
     * @param location - The URL to redirect to. Can be a relative path, absolute URL,
     *                   or a URL object. Will be converted to string automatically.
     * @param status - HTTP redirect status code. Must be one of the standard redirect
     *                 codes: 301 (Moved Permanently), 302 (Found), 303 (See Other),
     *                 307 (Temporary Redirect), or 308 (Permanent Redirect).
     *                 Defaults to 302 (Found).
     * 
     * @throws {TypeError} If an invalid redirect status code is provided
     * 
     * @example
     * ```typescript
     * // Temporary redirect (default)
     * throw new ThrowableRedirect('/dashboard')
     * 
     * // Permanent redirect
     * throw new ThrowableRedirect('/new-home', 301)
     * 
     * // Using URL object
     * const url = new URL('/profile', 'https://example.com')
     * throw new ThrowableRedirect(url, 302)
     * ```
     */
    constructor(location: string | URL, status: 301 | 302 | 303 | 307 | 308 = 302) {
        super((_, res) => res.redirect(status, location.toString()), `Redirecting to ${location}`)
    }
}

type Json =
    | string
    | number
    | boolean
    | null
    | JsonArray
    | JsonObject;

interface JsonArray extends Array<Json> { }

interface JsonObject {
    [key: string]: Json;
}

/**
 * Throwable response for JSON data.
 * 
 * Creates a throwable response that sends JSON data with the specified HTTP status code.
 * The data will be automatically serialized to JSON using Express's res.json() method.
 * 
 * @example
 * ```typescript
 * // Success response
 * throw new ThrowableJson({ message: 'Success', data: user }, 200)
 * 
 * // Error response
 * throw new ThrowableJson({ error: 'User not found' }, 404)
 * ```
 */
export class ThrowableJson extends ThrowableResponse {
    /**
     * Creates a new throwable JSON response.
     * 
     * @param json - The data to serialize as JSON. Must be JSON-serializable
     *               (string, number, boolean, null, array, or object with
     *               JSON-serializable values). Circular references will cause
     *               serialization errors.
     * @param status - HTTP status code for the response. Defaults to 200 (OK).
     *                 Common status codes: 200 (OK), 201 (Created), 400 (Bad Request),
     *                 401 (Unauthorized), 403 (Forbidden), 404 (Not Found),
     *                 422 (Unprocessable Entity), 500 (Internal Server Error).
     * 
     * @example
     * ```typescript
     * // Simple object response
     * throw new ThrowableJson({ success: true })
     * 
     * // Error response with details
     * throw new ThrowableJson({
     *   error: 'Validation failed',
     *   details: ['Email is required', 'Password too short']
     * }, 422)
     * 
     * // Array of items
     * throw new ThrowableJson([
     *   { id: 1, name: 'Item 1' },
     *   { id: 2, name: 'Item 2' }
     * ])
     * ```
     */
    constructor(json: Json, status: number = 200) {
        super((_, res) => res.status(status).json(json), `JSON response: ${status}`)
    }
}
