# throw-res

Throw responses instead of returning them in Express applications. A lightweight TypeScript package that enables exception-based flow control for HTTP responses.

## Why throw-res?

Traditional Express applications require you to thread response objects through your entire call stack and use early returns, which becomes unwieldy with deeper abstractions:

```typescript
// Traditional approach - response handling gets messy with abstraction
async function validateAndGetUser(id: string, res: Response) {
  if (!id || isNaN(parseInt(id))) {
    res.status(400).json({ error: "Invalid user ID" })
    return null
  }

  const user = await findUser(id)
  if (!user) {
    res.status(404).json({ error: "User not found" })
    return null
  }

  if (!user.isActive) {
    res.redirect("/inactive")
    return null
  }

  return user
}

app.get("/user/:id", async (req, res) => {
  const user = await validateAndGetUser(req.params.id, res)
  if (!user) return // Response already sent

  // Must check if response was already sent...
  if (res.headersSent) return

  res.json(user)
})

// Error handling is even worse
app.get("/user/:id/profile", async (req, res) => {
  try {
    const user = await validateAndGetUser(req.params.id, res)
    if (!user) return

    const profile = await getUserProfile(user.id)
    res.json(profile)
  } catch (error) {
    if (res.headersSent) return
    // Can't easily send different error responses based on context
    res.status(500).json({ error: "Internal server error" })
  }
})
```

With `throw-res`, responses can be thrown from **anywhere** in your call stack and bubble up automatically, just like exceptions:

```typescript
// Clean abstraction - no response object threading needed
async function validateAndGetUser(id: string) {
  if (!id || isNaN(parseInt(id))) {
    throw new ThrowableJson({ error: "Invalid user ID" }, 400)
  }

  const user = await findUser(id)
  if (!user) {
    throw new ThrowableJson({ error: "User not found" }, 404)
  }

  if (!user.isActive) {
    throw new ThrowableRedirect("/inactive")
  }

  return user
}

app.get("/user/:id", async (req, res) => {
  const user = await validateAndGetUser(req.params.id)
  res.json(user)
})

// Error handling becomes powerful and context-aware
app.get("/user/:id/profile", async (req, res) => {
  try {
    const user = await validateAndGetUser(req.params.id)
    const profile = await getUserProfile(user.id)
    res.json(profile)
  } catch (error) {
    if (error.code === "PROFILE_PRIVATE") {
      throw new ThrowableJson({ error: "Profile is private" }, 403)
    }
    if (error.code === "PROFILE_NOT_FOUND") {
      throw new ThrowableJson({ error: "Profile not found" }, 404)
    }
    // Let other errors bubble up to global error handler
    throw error
  }
})
```

### Key advantages:

- **Deep abstraction support**: Response logic can live in utility functions without threading response objects, bubbling up through your call stack automatically
- **Powerful error handling**: Catch blocks can send appropriate HTTP responses based on error context, with responses bubbling through multiple layers
- **Clean separation**: Business logic functions don't need to know about Express response objects
- **Exception-like flow**: Familiar pattern that stops execution and bubbles up through function calls, just like exceptions

## Installation

```bash
npm install throw-res
# or
bun add throw-res
# or
yarn add throw-res
```

## Requirements

- Express ^5.0.0
- TypeScript ^5.0.0

## Usage

### 1. Set up the error handler

First, add the throwable responses error handler to your Express app:

```typescript
import express from "express"
import throwableResponses from "throw-res"

const app = express()

// Your routes and middleware here...

// Add the throwable responses handler (must be added after your routes)
app.use(throwableResponses)

// Your other error handlers...
```

### 2. Throw responses in your handlers

Now you can throw responses anywhere in your route handlers:

```typescript
import { ThrowableJson, ThrowableRedirect } from "throw-res"

app.get("/api/users/:id", async (req, res) => {
  const userId = parseInt(req.params.id)

  if (isNaN(userId)) {
    throw new ThrowableJson({ error: "Invalid user ID" }, 400)
  }

  const user = await getUserById(userId)

  if (!user) {
    throw new ThrowableJson({ error: "User not found" }, 404)
  }

  // Normal response
  res.json(user)
})

app.post("/login", async (req, res) => {
  const { username, password } = req.body

  const user = await authenticateUser(username, password)

  if (!user) {
    throw new ThrowableJson({ error: "Invalid credentials" }, 401)
  }

  if (user.requiresPasswordReset) {
    throw new ThrowableRedirect("/reset-password")
  }

  // Set session and redirect
  req.session.userId = user.id
  throw new ThrowableRedirect("/dashboard")
})
```

## API

### `throwableResponses` (default export)

The Express error handler middleware that catches and processes throwable responses.

**Type:** `ErrorRequestHandler`

### `ThrowableResponse`

Base class for throwable responses.

```typescript
class ThrowableResponse extends Error {
  constructor(public handler: Handler, messageForErrorConstructor?: string)
}
```

**Parameters:**

- `handler`: Express handler function that must terminate the response
- `messageForErrorConstructor`: Optional error message (mainly for debugging)

### `ThrowableJson`

Throws a JSON response with an optional status code.

```typescript
class ThrowableJson extends ThrowableResponse {
  constructor(json: Json, status: number = 200)
}
```

**Parameters:**

- `json`: Any JSON-serializable data
- `status`: HTTP status code (defaults to 200)

**Example:**

```typescript
throw new ThrowableJson({ message: "Success" }, 200)
throw new ThrowableJson({ error: "Not found" }, 404)
throw new ThrowableJson(["item1", "item2"], 200)
```

### `ThrowableRedirect`

Throws a redirect response.

```typescript
class ThrowableRedirect extends ThrowableResponse {
  constructor(location: string | URL, status: 301 | 302 | 303 | 307 | 308 = 302)
}
```

**Parameters:**

- `location`: URL to redirect to (string or URL object)
- `status`: HTTP redirect status code (defaults to 302)

**Example:**

```typescript
throw new ThrowableRedirect("/login")
throw new ThrowableRedirect("https://example.com", 301)
throw new ThrowableRedirect(new URL("/profile", req.get("host")))
```

## Custom Throwable Responses

You can create your own throwable response types by extending `ThrowableResponse`:

```typescript
import { ThrowableResponse } from "throw-res"

class ThrowableHtml extends ThrowableResponse {
  constructor(html: string, status: number = 200) {
    super(
      (_, res) => res.status(status).type("html").send(html),
      `HTML response: ${status}`
    )
  }
}

class ThrowableFile extends ThrowableResponse {
  constructor(filePath: string) {
    super((_, res) => res.sendFile(filePath), `File response: ${filePath}`)
  }
}
```

## Benefits

- **Cleaner control flow**: No more nested if/else chains with early returns
- **Exception-based**: Familiar pattern for developers coming from other languages
- **Type-safe**: Full TypeScript support with proper typing
- **Lightweight**: Minimal overhead and dependencies
- **Flexible**: Easy to extend with custom response types
- **Express-compatible**: Works seamlessly with existing Express applications

## License

MIT © [Zach Sents](https://github.com/zachsents)
