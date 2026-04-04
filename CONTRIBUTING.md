# Contributing

## CI and merge requirements

Pull requests must pass both CI jobs before merge:

- `backend`
- `frontend`

A `merge-readiness` check is also published and only passes if both jobs succeed.

## Coverage ratchet policy

Coverage thresholds in `coverage-thresholds.json` are ratcheted.

- Thresholds may stay the same or increase.
- Thresholds must **not** be reduced without explicit approval.
- If a reduction is approved, record the approval and reason in the pull request.

## Pull request checklist

Use this checklist in your PR description:

- [ ] If API response fields changed, I added or updated role-visibility tests to cover the change.
- [ ] I did not reduce any coverage thresholds, or I linked explicit approval for the reduction.
