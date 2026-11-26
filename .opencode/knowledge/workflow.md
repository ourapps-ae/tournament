# Local workflow

Repository: `clodhub/tournament`. Licence: `Apache-2.0` (`LICENCE`, `NOTICE`).
Suite commands (from the package root): `node --test tests/web.test.ts`; `python3 tests/native.py apple`; `python3 tests/native.py android`.
Review a fetched archive: `python3 -m clod review <digest> --store STORE --policy POLICY --trusted --allow-network`.
Always run Python with `-B`; never write bytecode into the repository.
