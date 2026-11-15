# Customer creation through the voice/text assistant

Implemented in the existing application. The cause of “Active customer not found” was the credit execution path rejecting a missing customer before entering the existing transaction service. The preview also had no creation/restoration/selection state.

The assistant now prepares one confirmation: **“Mahesh is a new customer. Create Mahesh and add ₹100 udhaar?”**. Confirmation creates the owner-scoped active customer, applies the balance, records the credit history, and stores the idempotent response within one MongoDB transaction. A failure at any stage rolls everything back.

Existing names match case-insensitively with surrounding/repeated whitespace normalized. Exact matches take priority; ambiguous exact matches and partial name matches require choosing an existing customer. Archived matches offer explicit restoration without duplicating or resetting balances. Repayments never create or implicitly restore customers and cannot exceed the active customer's balance.

`CREATE_CUSTOMER` supports standalone commands such as “Create a new customer named Mahesh.”, creating ₹0 outstanding balance after confirmation. If that customer already exists, the preview says so and preserves the existing account/balance. Hindi, Kannada, and English intents are supported by Gemini and the multilingual fallback.

The existing confirmation panel retains the application's styling. Editing a name or amount rechecks the preview before saving is enabled; selecting a candidate checks its authenticated owner and displays the selected account. The existing refreshAll flow updates customers, Dashboard, history, and inventory after saving. The global assistant's delayed-close timer is now cleaned up so it cannot close a subsequent command.

Gemini can return intent fields only. AI-provided MongoDB IDs, owner IDs, and create/restore flags are discarded. The backend always resolves customers from the verified session and rechecks the current state inside the write transaction.

The existing idempotency store is reused for both standalone creation and create-plus-credit. A new partial unique index on `(ownerId, normalizedName)` prevents concurrent duplicate creation through either the ledger or assistant. Existing documents without normalizedName are excluded from that index and remain unchanged; legacy duplicates are presented for selection. No data migration or production writes were performed. No dependency or environment-variable changes were needed.

**Validation**

| Check | Result |
| --- | --- |
| `cd server; npm test` | **53 passed, 0 failed**. Includes all previous authentication/data-isolation regressions plus standalone creation, confirmed create-plus-credit, 100 credit minus 40 repayment = 60, refresh persistence, case/whitespace matching, existing customer reuse, ambiguous selection, archived restoration, standalone restoration without balance reset, concurrent duplicate requests, distinct concurrent request IDs, history/idempotency failure rollback, missing/archived/excess repayments, foreign IDs, Hindi/Kannada/English commands, and strict AI-output validation. |
| `cd client; npm run test:e2e` | **5 passed, 0 failed** in Chrome. Existing complete workflow/mobile tests plus three new text-only tests cover cancellation, standalone creation, refresh, 100 credit/40 repayment/60 balance and history, edited previews, combined creation/credit, archive/restore, and explicit selection between similar names. |
| `cd client; npm run build` | Passed. |
| `cd server; npm run check:client-build` | Passed: no configured backend secrets found in four browser assets. |
| `cd server; npm run check:voice` | Both live Gemini fictional samples passed with the existing key/model: CREATE_CUSTOMER with amount 0 and Hindi ADD_UDHAAR with amount 100, both for Mahesh. This diagnostic imports no database. |
| `git diff --check` | Passed. |

All database/browser tests use isolated temporary MongoDB replica sets and fictional accounts. Production records were never used or modified. Deployment and live microphone recognition were not tested for this change. No commit, push, or deployment was performed for this enhancement.

**Modified and added files**

- [client/src/components/VoiceAssistant.jsx](client/src/components/VoiceAssistant.jsx): create/restore confirmations, customer selection, edited-preview checks, refresh integration, and timer cleanup.
- [client/test/customer-assistant.spec.js](client/test/customer-assistant.spec.js): three browser workflows for this feature.
- [server/controllers/voiceController.js](server/controllers/voiceController.js): owner-scoped customer previews and confirmed execution through the atomic service.
- [server/routes/voiceRoutes.js](server/routes/voiceRoutes.js): authenticated `/api/voice/preview` route for edits and selection.
- [server/services/customerAssistantService.js](server/services/customerAssistantService.js): matching, confirmation plans, atomic create/restore/credit/repayment, and idempotent responses.
- [server/services/dataService.js](server/services/dataService.js): reuses the financial transaction helper and applies normalized matching/uniqueness to ledger creation and editing.
- [server/utils/customerNames.js](server/utils/customerNames.js): shared customer-name normalization and escaped matching patterns.
- [server/models/Customer.js](server/models/Customer.js): normalized name for new/renamed customers and a partial per-owner unique index.
- [server/services/geminiService.js](server/services/geminiService.js): CREATE_CUSTOMER intent, multilingual standalone/credit/repayment parsing, updated Gemini instructions, and strict output allowlist.
- [server/scripts/check-voice.js](server/scripts/check-voice.js): live interpretation diagnostic for standalone creation and Hindi credit.
- [server/test/customer-assistant.test.js](server/test/customer-assistant.test.js): isolated persistence, atomicity, retry, matching, multilingual, and authorization tests.
- [server/test/customer-command.test.js](server/test/customer-command.test.js): AI intent-field and amount validation tests.
- [server/test/workflow.test.js](server/test/workflow.test.js): updates the cross-shop voice check to pass a forbidden foreign customer ID, preserving the ID-isolation assertion with the new creation behavior.
- [VOICE_ASSISTANT_REPORT.md](VOICE_ASSISTANT_REPORT.md): this implementation and validation report.
