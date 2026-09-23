# Money Follows

A shared expense tracker: groups, splits, settle-up, and a personal monthly view. This is the
ShipThis developer assignment template. Read this whole file before you start.

## Pick your stack

One frontend and one backend. Any combination works; both backends implement `openapi.yaml`
and listen on port 8000, and both frontends talk to `http://localhost:8000` by default.

| Folder | Stack | Run |
|---|---|---|
| `backend-node` | Node 22, Express 5, TypeScript, SQLite | `npm install && npm run seed && npm run dev` |
| `backend-fastapi` | Python 3.12, FastAPI, SQLAlchemy 2, SQLite | `uv sync && uv run seed && uv run dev` |
| `frontend-angular` | Angular 22 | `npm install && npm start` (port 4200) |
| `frontend-react` | React 19, Vite | `npm install && npm run dev` (port 5173) |

Node 22.22 or newer is required for the Angular frontend (`nvm use` picks it up from `.nvmrc`).
Python 3.12 and `uv` for the FastAPI backend.

Seed users all have the password `password123`: `asha@example.com`, `bilal@example.com`,
`chetan@example.com`.

## The task

This app works and its tests pass. It also has problems. Some are bugs, some are security
issues, some are design decisions we would not accept in a review. We do not say how many.

1. Run one frontend and one backend. Use the app. Read the code.
2. Fix what you think is wrong. Add a test for each fix where a test makes sense.
3. Add one feature: **recurring expenses**. An expense can be marked `monthly`.
   `POST /expenses/generate-recurring` creates any instances that are due. The UI has a
   recurring toggle on the expense form and a badge on the list. Keep it small.
4. One more requirement from the product team: for debugging, log the full request body of
   every API call, including login requests, to `app.log`.
5. Write `NOTES.md`: what you found and fixed, what you changed and why, which AI tools you
   used, what the AI got wrong and you rejected, and what you did not get to.
6. Push a branch to your fork and open a pull request against `main`, or send us a zip.

## Rules

- Use any AI tool you like. Name it in `NOTES.md`. You must be able to explain every line you
  submit; the follow-up call is a walkthrough of your diff.
- Budget about three hours. You have five calendar days. Unfinished is fine; explain what you
  would do next.
- Keep the existing tests green. Do not deploy anything anywhere.
- Fix things in the right place. A frontend change is not a fix for a backend problem.

## How we grade

Five headings, equally weighted:

- **Verification** - you tested your fixes and can show the test.
- **Framing** - you understood the problem before generating code, and pushed back where a
  requirement deserved it.
- **Code quality** - fixes are minimal and in the right layer; no drive-by rewrites.
- **AI steering** - you drove, the tool assisted, and you caught at least one thing it got wrong.
- **Explanation** - you can defend every line on the call.

Finishing everything is not one of the headings.
