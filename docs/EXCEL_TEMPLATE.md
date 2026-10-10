# Employee Excel Template Guide

Use an `.xlsx` or `.xls` workbook. The preferred worksheet name is **Employees**. If it is absent, Executive Connect reads the first worksheet and shows that choice before import.

## Recommended columns

| Column | Required | Notes |
|---|---:|---|
| Employee ID | No | Format `EMP001` (EMP + at least 3 digits; `emp12` or `EMP-012` are tidied to `EMP012`). Used to update the right employee on re-import. If empty, the row is matched to an existing employee with the same WhatsApp number, or given the next free EMP number. |
| First Name | Yes | Used in message variables |
| Last Name | No | Optional |
| Mobile | Yes | Prefer E.164, e.g. `+971501234567` |
| Email | No | Optional |
| Birthday | No | `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, or Excel date |
| Joining Date | Yes | Same supported date formats |
| Language | No | `EN` or `AR`; defaults to EN |
| Department | No | Optional |
| Company | No | Optional |
| Job Title | No | Optional |
| Country | No | Required when a local phone format needs country context |
| WhatsApp Consent | No | Yes/No; defaults to Yes |
| Active | No | Yes/No; defaults to Yes |

Aliases such as `EmployeeID`, `Employee Id`, `Employee Number`, and `Staff ID` are auto-detected. The mapping screen lets HR correct any detection before validation.

## Import behavior

1. Upload file.
2. Detect columns.
3. Review/map columns.
4. Validate every row.
5. Preview New / Update / Unchanged / Error / Duplicate counts.
6. Confirm. Only then is a PostgreSQL transaction committed.

The same Employee ID is never inserted twice. Invalid rows are not committed. Duplicate Employee IDs inside one uploaded file are flagged as errors because two conflicting versions of the same employee are ambiguous.

Local UAE examples are normalized only when country context is UAE/AE. Ambiguous local numbers without country context are rejected instead of guessed.
