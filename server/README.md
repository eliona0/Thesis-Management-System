# Backend workflow notes

## Bachelor thesis result communication

The Bachelor workflow ends when the mentor approves the final submitted version. The mentor evaluation deadline is seven calendar days from `ThesisVersion.submittedAt`; it is separate from the regulation's seven-day administrative result-communication period. This backend has no notification or UBT administration communication service, so that communication remains an institutional/future feature and is not represented by an extra thesis status.

## Optional committee workflow

An administrator explicitly assigns a committee to a submitted thesis. The Bachelor final-approval operation does not create or schedule a committee. A committee has exactly one chair and two members, moves from `ASSIGNED` to `SCHEDULED`, and becomes `COMPLETED` after each assigned member records one grade from 6 through 10.

Member evaluations are stored independently. No committee consensus, chair tie-break, or committee final-grade rule is inferred because the platform has no explicit institutional decision policy for those cases. Those rules need institutional definition before a committee result is calculated.

## Document checks

The backend does not claim to validate thesis typography, page layout, word count, bibliography formatting, or plagiarism. No reliable document-analysis or plagiarism service is currently integrated.

## Verification

Run the backend HTTP workflow tests from this directory with `npm test`. They exercise Express routes, JWT role checks, controllers, and services with an in-memory Prisma double; they do not write to the configured PostgreSQL database.
