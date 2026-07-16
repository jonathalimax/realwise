# Implementation Plan: Uncategorized Transactions & Analytics Strategy

This plan outlines the transition to a "review-first" categorization model and the implementation of a multi-tier analytics system to monitor both categorization effectiveness and user behavior.

## 1. Uncategorized Transactions (Review-First Model)

Currently, the system forces a category (usually "Outros" or "Diversos") when no match is found. This masks transactions that actually need user attention.

### Objectives
- Allow transactions to have a `null` or `empty` category.
- Clearly identify transactions "Pending Review" in the UI.
- Prevent uncategorized transactions from polluting financial reports.

### Technical Changes
- **`src/services/categorizationService.js`**:
    - Modify `categorizeTransaction` to return `null` instead of a default category if no keyword matches.
    - Update `extractPattern` to be more robust against unique IDs.
- **`src/services/aiCategorizationService.js`**:
    - Update `categorizeWithAI` to return `{ category: null, source: 'none' }` if Gemini fails or confidence is below a threshold (e.g., 0.6).
- **`src/components/TransactionList.jsx` & `ImportModal.jsx`**:
    - Add a visual indicator (e.g., a yellow badge or "Needs Category" text) for items where `!category`.
- **`src/pages/Transactions.jsx`**:
    - Add a "To Review" filter toggle that shows only transactions with `category === null`.

---

## 2. Categorization Effectiveness Analytics

We need to measure how well our algorithms (AI + Rules) are performing to justify the cost of the AI and improve the rule-set.

### Key Metrics
| Metric | Description | Goal |
| :--- | :--- | :--- |
| **Automation Rate** | % of transactions auto-categorized vs. manual. | > 90% |
| **Accuracy (Hit Rate)** | % of auto-assigned categories that were NOT changed by the user. | > 95% |
| **AI Contribution** | % of successful matches provided by Gemini. | Monitor ROI |
| **Correction Latency** | Time between import and manual correction. | < 24h |

### Data Structure Update
Add a `metadata` object to the transaction schema in Firestore:
```json
{
  "description": "IFOOD *RESTAURANTE",
  "category": "Alimentação",
  "metadata": {
    "catSource": "ai" | "user_rule" | "default_rule" | "manual",
    "catConfidence": 0.85,
    "isCorrected": false,
    "originalCategory": "Alimentação",
    "ruleId": "doc_id_if_applicable"
  }
}
```

---

## 3. Client Behavior & Product Analytics

This strategy tracks how users interact with the app to identify friction points and successful features.

### A. Lifecycle Events
- `user_signup`: Initial entry.
- `onboarding_complete`: Completion of the wizard.
- `first_import`: Critical "Aha!" moment.
- `budget_created`: Indicates deep engagement.

### B. Friction Tracking
- **Import Errors**: Log the bank name and error type if a CSV/XLSX parser fails.
- **AI Quota Warning**: Log when a user hits 80% and 100% of their daily free Gemini quota.
- **Empty States**: Track if users visit the "Investments" or "Planning" tabs but have no data there.

---

## 4. Implementation Roadmap

### Phase 1: The "Null" Category (Week 1)
1. Update `categorizationService` to stop defaulting to "Outros".
2. Update UI components to handle `null` category values gracefully.
3. Add the "Pending Review" filter to the transactions page.

### Phase 2: Effectiveness Logging (Week 1-2)
1. Implement the `metadata` field in transaction creation.
2. Add a listener to manual category changes: if a user changes a category assigned by `ai` or `default_rule`, set `isCorrected: true` and log the correction.
3. Create a simple "Admin Dashboard" or internal report to view these percentages.

### Phase 3: Behavioral Events (Week 2-3)
1. Create a `src/services/analyticsService.js` wrapper for Firebase Analytics or a custom `events` collection.
2. Instrument key UI buttons (Import, Add Transaction, Save Budget).
3. Track session duration and "Tab Popularity".

## 5. Success Criteria
1. Users are spending less time manually categorizing (monitored via Accuracy metric).
2. Most "Uncategorized" items are actually unique/rare transactions that shouldn't be auto-mapped.
3. We can identify which banks have the most import errors to prioritize parser updates.
